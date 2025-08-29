import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages } from 'ai';
import { getMessageContent } from '@/app/types/ai-extended';
import {
  FILE_SEARCH_SYSTEM_PROMPT,
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
  SYSTEM_PROMPT_DEFAULT,
} from '@/lib/config';
import { createRun, isLangSmithEnabled } from '@/lib/langsmith/client';
import { getAllModels } from '@/lib/models';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';
import {
  selectRetrievalMode,
  shouldEnableFileSearchTools,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';
import { fileSearchTool } from '@/lib/tools/file-search';
import logger from '@/lib/utils/logger';
import { createErrorResponse } from '@/app/api/chat/utils';
import { CredentialService } from './CredentialService';
import { MessageService } from './MessageService';
import { StreamingService } from './StreamingService';
import type {
  ChatRequest,
  ExtendedUIMessage,
  ModelConfiguration,
  SupabaseClientType,
  TransformedMessage,
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
        verbosity = 'medium',
        context = 'chat',
        personalityMode,
      } = requestData;

      // Resolve model and get configuration
      const resolvedModel = this.resolveModelId(model);
      const supabase = await this.validateAndTrackUsage({
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
      await this.handleUserMessageLogging({
        supabase,
        userId,
        chatId,
        messages,
        message_group_id,
      });

      // Get model configuration
      const modelConfig = await this.getModelConfiguration(
        resolvedModel,
        model
      );

      // Set GPT-5 defaults
      const effectiveSettings = this.calculateEffectiveSettings(
        reasoningEffort,
        verbosity,
        modelConfig.isGPT5Model
      );

      // Log request context
      this.logRequestContext({
        resolvedModel,
        enableSearch,
        reasoningEffort: effectiveSettings.reasoningEffort,
        verbosity: effectiveSettings.verbosity,
        isGPT5Model: modelConfig.isGPT5Model,
        modelSupportsFileSearchTools: modelConfig.modelSupportsFileSearchTools,
      });

      // Log user query preview
      this.logUserQuery(messages, chatId, userId, resolvedModel);

      // Get effective system prompt and API key
      const effectiveSystemPrompt = await this.getEffectiveSystemPrompt(
        systemPrompt,
        enableSearch,
        modelConfig.modelSupportsFileSearchTools,
        { context, personalityMode }
      );

      const apiKey = await CredentialService.getApiKey(
        req,
        isAuthenticated,
        userId,
        resolvedModel
      );

      // Create LangSmith run
      const langsmithRunId = await this.createLangSmithRun({
        resolvedModel,
        messages,
        reasoningEffort: effectiveSettings.reasoningEffort,
        enableSearch,
        userId,
        chatId,
      });

      // Configure tools and model settings
      const tools = this.configureTools(
        enableSearch,
        modelConfig.modelSupportsFileSearchTools
      );
      const modelSettings = this.configureModelSettings(
        effectiveSettings.reasoningEffort,
        effectiveSettings.verbosity,
        modelConfig.isReasoningCapable
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
      const languageModel = this.requireApiSdk(modelConfig.modelConfig)(
        apiKey,
        modelSettings
      ) as LanguageModel;

      // Handle fallback retrieval if needed
      if (
        shouldUseFallbackRetrieval(
          enableSearch,
          modelConfig.modelSupportsFileSearchTools
        )
      ) {
        return await this.handleFallbackRetrieval({
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
        modelMessages = convertToModelMessages(
          compatibleMessages as ExtendedUIMessage[]
        );
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
          modelToUse = this.resolveModelId(requestData.model);
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

  // ... existing private methods (keeping them for now, will refactor later)
  private static resolveModelId(model: string): string {
    return model === 'gpt-4o-mini' ? 'gpt-5-mini' : model;
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

    const { incrementMessageCount, logUserMessage } = await import('../../app/api/chat/api');
    const { getMessageContent } = await import('@/app/types/ai-extended');
    const uiUtils = await import('@ai-sdk/ui-utils');
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

  private static async getModelConfiguration(
    resolvedModel: string,
    originalModel: string
  ): Promise<ModelConfiguration> {
    const allModels = await getAllModels();
    const modelConfig = allModels.find((m) => m.id === resolvedModel);

    if (!modelConfig?.apiSdk) {
      throw new Error(`Model ${originalModel} not found`);
    }

    const isGPT5Model = resolvedModel.startsWith('gpt-5');
    const isReasoningCapable = Boolean(modelConfig?.reasoningText);
    const modelSupportsFileSearchTools = Boolean(
      (modelConfig as { fileSearchTools?: boolean })?.fileSearchTools
    );

    return {
      modelConfig,
      isGPT5Model,
      isReasoningCapable,
      modelSupportsFileSearchTools,
    };
  }

  private static calculateEffectiveSettings(
    reasoningEffort: string,
    verbosity: string,
    isGPT5Model: boolean
  ) {
    let effectiveReasoningEffort = reasoningEffort;
    let effectiveVerbosity = verbosity;

    if (isGPT5Model) {
      effectiveReasoningEffort =
        reasoningEffort === 'medium' ? 'low' : reasoningEffort;
      effectiveVerbosity = verbosity === 'medium' ? 'low' : verbosity;
    }

    return {
      reasoningEffort: effectiveReasoningEffort,
      verbosity: effectiveVerbosity,
    };
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
          temperature: isGPT5Model ? 1 : undefined,
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
          preview: this.getPreview(userText),
        },
        'User query preview'
      );
    } catch {
      // ignore logging errors
    }
  }

  private static async getEffectiveSystemPrompt(
    systemPrompt: string,
    enableSearch: boolean,
    modelSupportsFileSearchTools: boolean,
    options?: {
      context?: 'chat' | 'voice';
      personalityMode?:
        | 'safety-focused'
        | 'technical-expert'
        | 'friendly-assistant';
    }
  ): Promise<string> {
    const context = options?.context;
    const personalityMode = options?.personalityMode;

    if (context === 'voice' && personalityMode) {
      try {
        const { PERSONALITY_CONFIGS } = await import(
          '@/components/app/voice/config/personality-configs'
        );
        if (PERSONALITY_CONFIGS[personalityMode]) {
          return PERSONALITY_CONFIGS[personalityMode].instructions.systemPrompt;
        }
      } catch {
        // Fall back to default prompt selection
      }
    }

    const useSearchPrompt = shouldEnableFileSearchTools(
      enableSearch,
      modelSupportsFileSearchTools
    );

    return useSearchPrompt
      ? FILE_SEARCH_SYSTEM_PROMPT
      : systemPrompt || SYSTEM_PROMPT_DEFAULT;
  }

  private static async createLangSmithRun({
    resolvedModel,
    messages,
    reasoningEffort,
    enableSearch,
    userId,
    chatId,
  }: {
    resolvedModel: string;
    messages: ExtendedUIMessage[];
    reasoningEffort: string;
    enableSearch: boolean;
    userId: string;
    chatId: string;
  }): Promise<string | null> {
    if (!isLangSmithEnabled()) {
      return null;
    }

    try {
      const run = (await createRun({
        name: 'chat-completion',
        inputs: {
          model: resolvedModel,
          messages: messages.map((m: ExtendedUIMessage) => ({
            role: m.role,
            content: getMessageContent(m),
          })),
          reasoningEffort,
          enableSearch,
        },
        runType: 'chain',
        metadata: {
          userId,
          chatId,
          model: resolvedModel,
          reasoningEffort,
          enableSearch,
        },
      })) as { id?: string } | null;

      return run?.id || null;
    } catch {
      return null;
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

    if (useTools) {
      logger.info(
        {
          at: 'api.chat.configureTools',
          enableSearch,
          fileSearchToolsCapable: modelSupportsFileSearchTools,
          toolsEnabled: true,
          toolNames: ['fileSearch'],
        },
        'Configuring file search tool'
      );
    }

    return useTools ? { fileSearch: fileSearchTool } : ({} as ToolSet);
  }

  private static configureModelSettings(
    reasoningEffort: string,
    verbosity?: string,
    isReasoningCapable?: boolean
  ) {
    return {
      enableSearch: false,
      reasoningEffort,
      verbosity,
      headers: isReasoningCapable
        ? {
            'X-Reasoning-Effort': reasoningEffort,
            ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
          }
        : undefined,
    };
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

    let retrieved = [] as {
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
      const modelMessages = convertToModelMessages(
        compatibleMessages as ExtendedUIMessage[]
      );

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
