import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages } from 'ai';
import { createErrorResponse } from '@/app/api/chat/utils';
import { getMessageContent } from '@/app/types/ai-extended';
import {
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
} from '@/lib/config';
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
import { getModelTemperature } from '@/lib/models/temperature-utils';
import { CredentialService } from './CredentialService';
import { LangSmithService } from './LangSmithService';
import { MessageService } from './MessageService';
import { ModelConfigurationService } from './ModelConfigurationService';
import { StreamingService } from './StreamingService';
import { SystemPromptService } from './SystemPromptService';
import type {
  ChatRequest,
  ExtendedUIMessage,
  SupabaseClientType,
} from './types';

export class ChatService {
  /**
   * Main entry point for processing chat requests
   */
  static async processChatRequest(
    req: Request,
    requestData: ChatRequest
  ): Promise<Response> {
    try {
      // Validate request
      const validationError = MessageService.validateChatRequest(requestData);
      if (validationError) {
        return new Response(JSON.stringify({ error: validationError }), {
          status: 400,
        });
      }

      const {
        messages,
        chatId,
        userId,
        model,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        message_group_id,
        reasoningEffort = 'medium',
        // Default short verbosity across models
        verbosity = 'low',
        reasoningSummary = 'auto',
        context = 'chat',
        personalityMode,
      } = requestData;

      // Resolve model and get configuration
      const resolvedModel = ModelConfigurationService.resolveModelId(model);
      const supabase = await ChatService.validateAndTrackUsage({
        userId,
        model: resolvedModel,
        isAuthenticated,
        hasGuestCredentials:
          !isAuthenticated &&
          Boolean(
            req.headers.get('x-provider-api-key') ||
              req.headers.get('X-Provider-Api-Key')
          ),
      });

      // Handle user message logging
      await ChatService.handleUserMessageLogging({
        supabase,
        userId,
        chatId,
        messages,
        message_group_id,
      });

      // Get model configuration
      const modelConfig = await ModelConfigurationService.getModelConfiguration(
        resolvedModel,
        model
      );

      // Set GPT-5 defaults
      const effectiveSettings =
        ModelConfigurationService.calculateEffectiveSettings(
          reasoningEffort,
          verbosity,
          modelConfig.isGPT5Model
        );

      // Log request context
      ChatService.logRequestContext({
        resolvedModel,
        enableSearch,
        reasoningEffort: effectiveSettings.reasoningEffort,
        verbosity: effectiveSettings.verbosity,
        isGPT5Model: modelConfig.isGPT5Model,
        modelSupportsFileSearchTools: modelConfig.modelSupportsFileSearchTools,
      });

      // Log user query preview
      ChatService.logUserQuery(messages, chatId, userId, resolvedModel);

      // Get effective system prompt and API key
      const effectiveSystemPrompt =
        await SystemPromptService.getEffectiveSystemPrompt(
          systemPrompt,
          enableSearch,
          modelConfig.modelSupportsFileSearchTools,
          { context, personalityMode }
        );

      const credentialResult = await CredentialService.resolveCredentials(
        { isAuthenticated, userId },
        resolvedModel,
        req.headers
      );
      const apiKey = credentialResult.apiKey;

      // Create LangSmith run
      const langsmithRunId = await LangSmithService.createLangSmithRun({
        resolvedModel,
        messages,
        reasoningEffort: effectiveSettings.reasoningEffort,
        enableSearch,
        userId,
        chatId,
      });

      // Configure tools and model settings
      const tools = ChatService.configureTools(
        enableSearch,
        modelConfig.modelSupportsFileSearchTools
      );
      const modelSettings = ModelConfigurationService.getModelSettings(
        modelConfig,
        effectiveSettings.reasoningEffort,
        effectiveSettings.verbosity,
        reasoningSummary
      );

      // Process messages
      const transformedMessages =
        MessageService.transformMessagesToV5Format(messages);
      if (!(transformedMessages && Array.isArray(transformedMessages))) {
        return new Response(
          JSON.stringify({ error: 'Failed to transform messages' }),
          { status: 500 }
        );
      }

      const validatedMessages =
        MessageService.filterValidMessages(transformedMessages);
      if (validatedMessages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No valid messages to process' }),
          { status: 400 }
        );
      }

      const uiMessages =
        MessageService.convertToExtendedUIMessages(validatedMessages);
      const compatibleMessages =
        MessageService.createCompatibleMessages(uiMessages);

      // Create language model
      const languageModel = ChatService.requireApiSdk(modelConfig.modelConfig)(
        apiKey,
        modelSettings
      );

      // Handle fallback retrieval if needed
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
          message_group_id,
          langsmithRunId,
          messages,
        });
      }

      // Convert to model messages and stream
      let modelMessages;
      try {
        modelMessages = convertToModelMessages(compatibleMessages);
      } catch {
        return new Response(
          JSON.stringify({
            error: 'Failed to convert messages to model format',
          }),
          { status: 500 }
        );
      }

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
        message_group_id,
        langsmithRunId
      );
    } catch (err: unknown) {
      const error = err as {
        code?: string;
        message?: string;
        statusCode?: number;
      };

      // Extract model and user info for error tracking
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
          // Use original model if resolution fails
        }
      }

      // Track credential error
      CredentialService.trackCredentialError(err, modelToUse, userIdToUse);

      // Log error
      logger.error({ error: err, at: 'api.chat.POST' }, 'Chat API error');

      return createErrorResponse(error);
    }
  }

  // Private helper methods

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

  private static async handleUserMessageLogging({
    supabase,
    userId,
    chatId,
    messages,
    message_group_id,
  }: {
    supabase: SupabaseClientType | null;
    userId: string;
    chatId: string;
    messages: ExtendedUIMessage[];
    message_group_id?: string;
  }) {
    if (!supabase) return;

    const { incrementMessageCount, logUserMessage } = await import(
      '../../app/api/chat/api'
    );
    const { getMessageContent } = await import('@/app/types/ai-extended');
    type Attachment = import('@ai-sdk/ui-utils').Attachment;

    await incrementMessageCount({ supabase, userId });

    const userMessage = messages.at(-1);
    if (userMessage?.role === 'user') {
      const textContent = getMessageContent(userMessage);
      const attachments = userMessage.experimental_attachments || [];

      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: textContent,
        attachments: attachments as Attachment[],
        message_group_id,
      });
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
      const {
        getProviderForModel,
      } = require('@/lib/openproviders/provider-map');
      const provider = getProviderForModel(resolvedModel);
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
        },
        'chat request'
      );
    } catch {
      // Silently handle error in logging operation
    }
  }

  private static logUserQuery(
    messages: ExtendedUIMessage[],
    chatId: string,
    userId: string,
    resolvedModel: string
  ) {
    try {
      const lastUserMessage = messages.at(-1);
      const userText = lastUserMessage
        ? getMessageContent(lastUserMessage)
        : '';
      logger.info(
        {
          at: 'api.chat.userQuery',
          chatId,
          userId,
          model: resolvedModel,
          preview: ChatService.getPreview(userText),
        },
        'User query preview'
      );
    } catch {
      // ignore logging errors
    }
  }

  private static configureTools(
    enableSearch: boolean,
    modelSupportsFileSearchTools: boolean
  ): ToolSet {
    const useTools = shouldEnableFileSearchTools(
      enableSearch,
      modelSupportsFileSearchTools
    );

    if (!useTools) return {} as ToolSet;

    // Prefer OpenAI native file_search tool when vector stores are configured.
    // Falls back to our custom tool if not available.
    try {
      const { getVectorStoreConfig } = require('@/lib/utils/environment-loader');
      const { createOpenAI, openai } = require('@ai-sdk/openai');
      const { vectorStoreIds } = getVectorStoreConfig();

      if (Array.isArray(vectorStoreIds) && vectorStoreIds.length > 0) {
        logger.info(
          {
            at: 'api.chat.configureTools',
            enableSearch,
            fileSearchToolsCapable: modelSupportsFileSearchTools,
            toolsEnabled: true,
            toolNames: ['file_search'],
            vectorStoreIds,
          },
          'Configuring native OpenAI file_search tool'
        );

        return {
          // Must be exactly 'file_search' per OpenAI spec
          file_search: openai.tools.fileSearch({
            vectorStoreIds,
            maxNumResults: 10,
            ranking: { ranker: 'auto' },
          }),
        } as unknown as ToolSet;
      }
    } catch {
      // ignore and fall back to custom tool
    }

    logger.info(
      {
        at: 'api.chat.configureTools',
        enableSearch,
        fileSearchToolsCapable: modelSupportsFileSearchTools,
        toolsEnabled: true,
        toolNames: ['file_search (custom fallback)'],
      },
      'Configuring custom file_search fallback tool'
    );

    // Expose custom tool under native name for consistency
    return { file_search: file_search } as unknown as ToolSet;
  }

  private static requireApiSdk(modelConfig: unknown) {
    const apiSdk = (modelConfig as { apiSdk?: unknown })?.apiSdk;
    if (typeof apiSdk !== 'function') {
      throw new Error('Model is missing apiSdk configuration');
    }
    return apiSdk as (
      key: string | undefined,
      settings: unknown
    ) => LanguageModel;
  }

  private static getPreview(
    text: string | undefined | null,
    max = 500
  ): string {
    if (!text) {
      return '';
    }
    const trimmed = String(text).trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }

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
    message_group_id,
    langsmithRunId,
    messages,
  }: {
    compatibleMessages: ExtendedUIMessage[];
    languageModel: LanguageModel;
    effectiveSystemPrompt: string;
    apiKey: string | undefined;
    modelSettings: any;
    modelConfig: any;
    chatId: string;
    userId: string;
    resolvedModel: string;
    isGPT5Model: boolean;
    reasoningEffort: string;
    enableSearch: boolean;
    supabase: SupabaseClientType | null;
    message_group_id: string | undefined;
    langsmithRunId: string | null;
    messages: ExtendedUIMessage[];
  }): Promise<Response> {
    const lastUserMessage = messages.at(-1);
    const userQuery = lastUserMessage ? getMessageContent(lastUserMessage) : '';

    let retrieved: {
      fileId: string;
      fileName: string;
      score: number;
      content: string;
      url?: string;
    }[];

    try {
      const mode = selectRetrievalMode(RETRIEVAL_TWO_PASS_ENABLED);
      retrieved =
        mode === 'two-pass'
          ? await retrieveWithGpt41(userQuery, messages, {
              topK: RETRIEVAL_TOP_K,
            })
          : await performVectorRetrieval(userQuery, {
              topK: RETRIEVAL_TOP_K,
            });
    } catch {
      retrieved = await performVectorRetrieval(userQuery, {
        topK: RETRIEVAL_TOP_K,
      });
    }

    const augmentedSystem = buildAugmentedSystemPrompt(
      effectiveSystemPrompt,
      retrieved,
      { budgetTokens: RETRIEVAL_MAX_TOKENS }
    );

    const systemForInjection = augmentedSystem;

    try {
      const modelMessages = convertToModelMessages(compatibleMessages);

      return await StreamingService.createStreamingResponseWithFallback(
        languageModel,
        systemForInjection,
        modelMessages,
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
        message_group_id,
        langsmithRunId
      );
    } catch {
      throw new Error('Failed to convert messages to model format');
    }
  }
}
