import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages } from 'ai';
import { createErrorResponse } from '@/app/api/chat/utils';
import { getMessageContent } from '@/app/types/ai-extended';
import {
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
} from '@/lib/config';
import { getModelTemperature } from '@/lib/models/temperature-utils';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';
import {
  selectRetrievalMode,
  shouldEnableFileSearchTools,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';
import { file_search } from '@/lib/tools/file-search';
import logger from '@/lib/utils/logger';
import { CredentialService } from './CredentialService';
import { LangSmithService } from './LangSmithService';
import { MessageService } from './MessageService';
import { ModelConfigurationService } from './ModelConfigurationService';
import { StreamingService } from './StreamingService';
import { SystemPromptService } from './SystemPromptService';
import type {
  ExtendedUIMessage,
  SupabaseClientType,
  ValidatedChatRequest,
} from './types';

/** Narrow type for model settings; pass-through from model configuration. */
type ModelSettings = Record<string, unknown>;

/** Shape for retrieved context chunks used to augment the system prompt. */
type RetrievedChunk = {
  fileId: string;
  fileName: string;
  score: number;
  content: string;
  url?: string;
};

export class ChatService {
  /**
   * Entry point: process a chat request and return a streamed Response.
   */
  static async processChatRequest(
    req: Request,
    requestData: ValidatedChatRequest
  ): Promise<Response> {
    try {
      const {
        messages,
        chatId,
        userId,
        model,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        messageGroupId,
        reasoningEffort = 'medium',
        verbosity = 'medium',
        reasoningSummary = 'auto',
        context = 'chat',
        personalityMode,
      } = requestData;

      // Resolve model id and validate usage (also yields Supabase client for logging/quotas).
      const resolvedModel = ModelConfigurationService.resolveModelId(model);
      const supabase = await ChatService.validateAndTrackUsage({
        userId,
        model: resolvedModel,
        isAuthenticated,
        hasGuestCredentials: ChatService.hasGuestCredentials(req),
      });

      // Prepare messages early so downstream logging/integrations use a consistent shape.
      const compatibleMessages = ChatService.prepareCompatibleMessages(messages);

      // Log user message + increment counters (best-effort; do not block).
      await ChatService.handleUserMessageLogging({
        supabase,
        userId,
        chatId,
        messages: compatibleMessages,
        messageGroupId,
      });

      // Pull model configuration and derive effective runtime settings.
      const modelConfig = await ModelConfigurationService.getModelConfiguration(
        resolvedModel,
        model
      );

      const effectiveSettings =
        ModelConfigurationService.calculateEffectiveSettings(
          reasoningEffort,
          verbosity,
          modelConfig.isGPT5Model
        );

      // Context log (best-effort).
      ChatService.logRequestContext({
        resolvedModel,
        enableSearch,
        reasoningEffort: effectiveSettings.reasoningEffort,
        verbosity: effectiveSettings.verbosity,
        isGPT5Model: modelConfig.isGPT5Model,
        modelSupportsFileSearchTools: modelConfig.modelSupportsFileSearchTools,
      });

      // User query preview log (best-effort).
      ChatService.logUserQuery(compatibleMessages, chatId, userId, resolvedModel);

      // Compose the effective system prompt (may embed search/tool hints).
      const effectiveSystemPrompt =
        await SystemPromptService.getEffectiveSystemPrompt(
          systemPrompt,
          enableSearch,
          modelConfig.modelSupportsFileSearchTools,
          { context, personalityMode }
        );

      // Resolve provider credentials (user-level or guest API key delegation).
      const { apiKey } = await CredentialService.resolveCredentials(
        { isAuthenticated, userId },
        resolvedModel,
        req.headers
      );

      // Create a LangSmith run (optional; best-effort by the service).
      const langsmithRunId = await LangSmithService.createLangSmithRun({
        resolvedModel,
        messages: compatibleMessages,
        reasoningEffort: effectiveSettings.reasoningEffort,
        enableSearch,
        userId,
        chatId,
      });

      // Tools + model settings (strict pass-through).
      const tools = ChatService.configureTools(
        enableSearch,
        modelConfig.modelSupportsFileSearchTools
      );

      const modelSettings: ModelSettings =
        ModelConfigurationService.getModelSettings(
          modelConfig,
          effectiveSettings.reasoningEffort,
          effectiveSettings.verbosity,
          reasoningSummary
        );

      // Convert to model messages once.
      const modelMessages = ChatService.toModelMessagesOrThrow(
        compatibleMessages
      );

      // Create the language model instance from the provider SDK.
      const languageModel = ChatService.requireApiSdk(modelConfig.modelConfig)(
        apiKey,
        modelSettings
      ) as LanguageModel;

      // Decide on retrieval strategy. If tools are not available or disabled, run fallback retrieval.
      if (
        shouldUseFallbackRetrieval(
          enableSearch,
          modelConfig.modelSupportsFileSearchTools
        )
      ) {
        return await ChatService.handleFallbackRetrieval({
          compatibleMessages,
          languageModel,
          effectiveSystemPrompt,
          apiKey,
          modelSettings,
          modelConfig: modelConfig.modelConfig,
          chatId,
          userId,
          resolvedModel,
          isGPT5Model: modelConfig.isGPT5Model,
          reasoningEffort: effectiveSettings.reasoningEffort,
          enableSearch,
          supabase,
          messageGroupId,
          langsmithRunId,
          messages: compatibleMessages,
          // We already have modelMessages; reuse to avoid duplicate conversion work.
          precomputedModelMessages: modelMessages,
        });
      }

      // Stream the response with the baseline system prompt and tools.
      return await StreamingService.createStreamingResponse(
        languageModel,
        effectiveSystemPrompt,
        modelMessages,
        tools,
        modelConfig.isGPT5Model,
        chatId,
        userId,
        resolvedModel,
        effectiveSettings.reasoningEffort,
        enableSearch,
        supabase,
        messageGroupId,
        langsmithRunId
      );
    } catch (err: unknown) {
      // Normalize and track.
      const error = err as {
        code?: string;
        message?: string;
        statusCode?: number;
      };

      let modelToUse = 'unknown-model';
      let userIdToUse = 'unknown-user';

      if (requestData) {
        modelToUse = requestData.model || 'unknown-model';
        userIdToUse = requestData.userId || 'unknown-user';
        try {
          modelToUse = ModelConfigurationService.resolveModelId(
            requestData.model
          );
        } catch {
          // leave as original if resolution fails
        }
      }

      CredentialService.trackCredentialError(err, modelToUse, userIdToUse);
      logger.error({ error: err, at: 'api.chat.POST' }, 'Chat API error');

      return createErrorResponse(error);
    }
  }

  // ---------------------------
  // Internal helpers (static)
  // ---------------------------

  private static hasGuestCredentials(req: Request): boolean {
    // Support common header casings; do not throw if headers absent.
    const h = req.headers;
    return Boolean(h.get('x-provider-api-key') || h.get('X-Provider-Api-Key'));
  }

  private static async validateAndTrackUsage({
    userId,
    model,
    isAuthenticated,
    hasGuestCredentials,
  }: {
    userId: string;
    model: string;
    isAuthenticated: boolean;
    hasGuestCredentials: boolean;
  }) {
    const { validateAndTrackUsage } = await import('../../app/api/chat/api');
    return await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
      hasGuestCredentials,
    });
  }

  /**
   * Increment message counters and persist the last user message preview + attachments.
   * Best-effort; never throws.
   */
  private static async handleUserMessageLogging({
    supabase,
    userId,
    chatId,
    messages,
    messageGroupId,
  }: {
    supabase: SupabaseClientType | null;
    userId: string;
    chatId: string;
    messages: ExtendedUIMessage[];
    messageGroupId?: string;
  }) {
    if (!supabase) return;

    try {
      const { incrementMessageCount, logUserMessage } = await import(
        '../../app/api/chat/api'
      );
      type Attachment = import('@ai-sdk/ui-utils').Attachment;

      await incrementMessageCount({ supabase, userId });

      const lastUser = messages.at(-1);
      if (lastUser?.role === 'user') {
        const textContent = getMessageContent(lastUser);
        const attachments = (lastUser.experimental_attachments ||
          []) as Attachment[];

        await logUserMessage({
          supabase,
          userId,
          chatId,
          content: textContent,
          attachments,
          message_group_id: messageGroupId,
        });
      }
    } catch (e) {
      // Swallow logging errors; do not impact the main flow.
      logger.warn(
        { at: 'userMessageLogging', error: e },
        'Non-fatal logging error'
      );
    }
  }

  private static logRequestContext(options: {
    resolvedModel: string;
    enableSearch: boolean;
    reasoningEffort: string;
    verbosity?: string;
    isGPT5Model?: boolean;
    modelSupportsFileSearchTools?: boolean;
  }) {
    try {
      const {
        resolvedModel,
        enableSearch,
        reasoningEffort,
        verbosity,
        isGPT5Model,
        modelSupportsFileSearchTools,
      } = options;

      const provider = ChatService.resolveProvider(resolvedModel);

      logger.info(
        {
          at: 'api.chat.POST',
          model: resolvedModel,
          provider,
          enableSearch,
          reasoningEffort,
          verbosity,
          temperature: getModelTemperature(resolvedModel),
          fileSearchToolsCapable: modelSupportsFileSearchTools,
          isGPT5Model,
        },
        'chat request'
      );
    } catch {
      // Never throw from logging.
    }
  }

  private static logUserQuery(
    messages: ExtendedUIMessage[],
    chatId: string,
    userId: string,
    resolvedModel: string
  ) {
    try {
      const userText = ChatService.getLastUserText(messages);
      const userTextPreview = ChatService.getPreview(userText);
      logger.info(
        {
          at: 'api.chat.POST',
          model: resolvedModel,
          chatId,
          userId,
          preview: userTextPreview,
        },
        'user query'
      );
    } catch {
      // Never throw from logging.
    }
  }

  private static getLastUserText(messages: ExtendedUIMessage[]): string {
    const last = messages.at(-1);
    return last ? (getMessageContent(last) ?? '') : '';
  }

  private static getPreview(
    text: string | undefined | null,
    max = 500
  ): string {
    if (!text) return '';
    const trimmed = String(text).trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }

  /**
   * Fallback retrieval path when file-search tools are not enabled/supported.
   * Builds an augmented system prompt with retrieved chunks and streams with a fallback method.
   */
  private static async handleFallbackRetrieval({
    compatibleMessages,
    languageModel,
    effectiveSystemPrompt,
    apiKey,
    modelSettings,
    modelConfig,
    chatId,
    userId,
    resolvedModel,
    isGPT5Model,
    reasoningEffort,
    enableSearch,
    supabase,
    messageGroupId,
    langsmithRunId,
    messages,
    precomputedModelMessages,
  }: {
    compatibleMessages: ExtendedUIMessage[];
    languageModel: LanguageModel;
    effectiveSystemPrompt: string;
    apiKey: string | undefined;
    modelSettings: ModelSettings;
    modelConfig: unknown;
    chatId: string;
    userId: string;
    resolvedModel: string;
    isGPT5Model: boolean;
    reasoningEffort: string;
    enableSearch: boolean;
    supabase: SupabaseClientType | null;
    messageGroupId: string | undefined;
    langsmithRunId: string | null;
    messages: ExtendedUIMessage[];
    precomputedModelMessages: ReturnType<typeof convertToModelMessages>;
  }): Promise<Response> {
    const userQuery = ChatService.getLastUserText(messages);

    let retrieved: RetrievedChunk[];

    // Choose retrieval mode, with two-pass preferred when flagged.
    try {
      const mode = selectRetrievalMode(RETRIEVAL_TWO_PASS_ENABLED);
      retrieved =
        mode === 'two-pass'
          ? await retrieveWithGpt41(userQuery, messages, {
              topK: RETRIEVAL_TOP_K,
            })
          : await performVectorRetrieval(userQuery, { topK: RETRIEVAL_TOP_K });
    } catch (e) {
      // On failure, fall back to vector retrieval.
      logger.warn(
        { at: 'fallbackRetrieval', error: e },
        'two-pass retrieval failed; falling back to vector retrieval'
      );
      retrieved = await performVectorRetrieval(userQuery, {
        topK: RETRIEVAL_TOP_K,
      });
    }

    // Build augmented system prompt with token budget.
    const augmentedSystem = buildAugmentedSystemPrompt(
      effectiveSystemPrompt,
      retrieved,
      { budgetTokens: RETRIEVAL_MAX_TOKENS }
    );

    // Stream using the service variant that is aware of the augmented system.
    return await StreamingService.createStreamingResponseWithFallback(
      languageModel,
      augmentedSystem,
      precomputedModelMessages,
      apiKey,
      modelSettings,
      modelConfig,
      chatId,
      userId,
      resolvedModel,
      isGPT5Model,
      reasoningEffort,
      enableSearch,
      supabase,
      messageGroupId,
      langsmithRunId
    );
  }

  private static configureTools(
    enableSearch: boolean,
    modelSupportsFileSearchTools: boolean
  ): ToolSet {
    // Respect both user toggle and model capability; otherwise empty toolset.
    const canUseFileSearch = shouldEnableFileSearchTools(
      enableSearch,
      modelSupportsFileSearchTools
    );
    const tools: ToolSet = {};
    if (canUseFileSearch) {
      tools.file_search = file_search;
    }
    return tools;
  }

  /**
   * Prepare messages for the provider:
   *  - transform ➜ filter valid ➜ convert to Extended UI format ➜ make compatible
   */
  private static prepareCompatibleMessages(raw: unknown[]): ExtendedUIMessage[] {
    const transformed = MessageService.transformMessagesToV5Format(raw);
    if (!Array.isArray(transformed)) {
      throw new Error('Failed to transform messages');
    }

    const validated = MessageService.filterValidMessages(transformed);
    if (validated.length === 0) {
      const err = new Error('No valid messages to process');
      // Throw to be shaped by the outer catch into a Response.
      throw err;
    }

    const uiMessages = MessageService.convertToExtendedUIMessages(validated);
    return MessageService.createCompatibleMessages(uiMessages);
  }

  /** Single place to convert and surface conversion errors uniformly. */
  private static toModelMessagesOrThrow(
    compatibleMessages: ExtendedUIMessage[]
  ) {
    try {
      return convertToModelMessages(compatibleMessages);
    } catch (e) {
      logger.error({ error: e }, 'Failed to convert messages to model format');
      throw new Error('Failed to convert messages to model format');
    }
  }

  private static resolveProvider(resolvedModel: string): string | undefined {
    try {
      const {
        getProviderForModel,
      } = require('@/lib/openproviders/provider-map');
      return getProviderForModel(resolvedModel);
    } catch {
      return undefined;
    }
  }

  private static requireApiSdk(modelConfig: unknown) {
    const { requireApiSdk } = require('@/lib/models/api-sdk');
    return requireApiSdk(modelConfig);
  }
}
