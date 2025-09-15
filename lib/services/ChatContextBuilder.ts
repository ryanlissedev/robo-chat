import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages } from 'ai';
import { requireApiSdk } from '@/lib/models/api-sdk';
import { getModelTemperature } from '@/lib/models/temperature-utils';
import type { ModelConfig } from '@/lib/models/types';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { shouldEnableFileSearchTools } from '@/lib/retrieval/gating';
import { file_search } from '@/lib/tools/file-search';
import logger from '@/lib/utils/logger';
import { CredentialService } from './CredentialService';
import { LangSmithService } from './LangSmithService';
import { ModelConfigurationService } from './ModelConfigurationService';
import { SystemPromptService } from './SystemPromptService';
import type { ExtendedUIMessage } from './types';

/** Narrow type for model settings; pass-through from model configuration. */
type ModelSettings = Record<string, unknown>;

export interface ChatContext {
  languageModel: LanguageModel;
  effectiveSystemPrompt: string;
  modelMessages: ReturnType<typeof convertToModelMessages>;
  tools: ToolSet;
  modelSettings: ModelSettings;
  apiKey: string | undefined;
  langsmithRunId: string | null;
  modelConfig: ModelConfig;
  effectiveSettings: {
    reasoningEffort: string;
    verbosity: string;
  };
}

export class ChatContextBuilder {
  /**
   * Builds the complete chat context including model, credentials, tools, and settings.
   */
  static async buildChatContext({
    resolvedModel,
    model,
    compatibleMessages,
    userId,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    reasoningEffort,
    verbosity,
    reasoningSummary,
    context,
    personalityMode,
    chatId,
    headers,
  }: {
    resolvedModel: string;
    model: string;
    compatibleMessages: ExtendedUIMessage[];
    userId: string;
    isAuthenticated: boolean;
    systemPrompt?: string;
    enableSearch: boolean;
    reasoningEffort: string;
    verbosity: string;
    reasoningSummary: string;
    context: string;
    personalityMode?: string;
    chatId: string;
    headers: Headers;
  }): Promise<ChatContext> {
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

    // Log request context (best-effort).
    ChatContextBuilder.logRequestContext({
      resolvedModel,
      enableSearch,
      reasoningEffort: effectiveSettings.reasoningEffort,
      verbosity: effectiveSettings.verbosity,
      isGPT5Model: modelConfig.isGPT5Model,
      modelSupportsFileSearchTools: modelConfig.modelSupportsFileSearchTools,
    });

    // Compose the effective system prompt (may embed search/tool hints).
    const effectiveSystemPrompt =
      await SystemPromptService.getEffectiveSystemPrompt(
        systemPrompt || '',
        enableSearch,
        modelConfig.modelSupportsFileSearchTools,
        {
          context: context as 'chat',
          personalityMode: personalityMode as
            | 'safety-focused'
            | 'technical-expert'
            | 'friendly-assistant'
            | undefined,
        }
      );

    // Resolve provider credentials (user-level or guest API key delegation).
    const { apiKey } = await CredentialService.resolveCredentials(
      { isAuthenticated, userId },
      resolvedModel,
      headers
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
    const tools = ChatContextBuilder.configureTools(
      enableSearch,
      modelConfig.modelSupportsFileSearchTools
    );

    const modelSettings: ModelSettings =
      ModelConfigurationService.getModelSettings(
        modelConfig,
        effectiveSettings.reasoningEffort,
        effectiveSettings.verbosity,
        reasoningSummary as 'auto' | 'detailed' | undefined
      );

    // Convert to model messages once.
    const modelMessages =
      ChatContextBuilder.toModelMessagesOrThrow(compatibleMessages);

    // Create the language model instance from the provider SDK.
    const languageModel = requireApiSdk(modelConfig.modelConfig)(
      apiKey,
      modelSettings
    ) as LanguageModel;

    return {
      languageModel,
      effectiveSystemPrompt,
      modelMessages,
      tools,
      modelSettings,
      apiKey,
      langsmithRunId,
      modelConfig: modelConfig.modelConfig,
      effectiveSettings,
    };
  }

  /**
   * Configures tools based on search enablement and model capabilities.
   */
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
   * Single place to convert messages and surface conversion errors uniformly.
   */
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

  /**
   * Logs request context for debugging and monitoring.
   */
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

      const provider = ChatContextBuilder.resolveProvider(resolvedModel);

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

  /**
   * Logs user query for debugging and monitoring.
   */
  static logUserQuery(
    messages: ExtendedUIMessage[],
    chatId: string,
    userId: string,
    resolvedModel: string
  ) {
    try {
      const userText = ChatContextBuilder.getLastUserText(messages);
      const userTextPreview = ChatContextBuilder.getPreview(userText);
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
    return last ? (last.content?.toString() ?? '') : '';
  }

  private static getPreview(
    text: string | undefined | null,
    max = 500
  ): string {
    if (!text) return '';
    const trimmed = String(text).trim();
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
  }

  private static resolveProvider(resolvedModel: string): string | undefined {
    try {
      return getProviderForModel(resolvedModel);
    } catch {
      return undefined;
    }
  }
}
