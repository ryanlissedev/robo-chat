import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { createRun, isLangSmithEnabled } from '@/lib/langsmith/client';
import logger from '@/lib/utils/logger';
import type { ModelConfiguration } from './ModelConfigurationService';

export interface StreamingConfig {
  model: LanguageModel;
  messages: ExtendedUIMessage[];
  systemPrompt: string;
  tools: ToolSet;
  modelSettings: any;
  chatId: string;
  userId: string;
  resolvedModel: string;
  modelConfig: ModelConfiguration;
  vectorStoreIds?: string[];
}

/**
 * Service for handling streaming responses
 */
export class StreamingResponseService {
  /**
   * Create streaming response with proper configuration
   */
  static async createStreamingResponse(config: StreamingConfig) {
    const {
      model,
      messages,
      systemPrompt,
      tools,
      modelSettings,
      chatId,
      userId,
      resolvedModel,
      modelConfig,
      vectorStoreIds,
    } = config;

    // Convert messages to model format
    const modelMessages = convertToModelMessages(messages);

    // Create LangSmith run if enabled
    const runId = await StreamingResponseService.createLangSmithRun({
      chatId,
      userId,
      model: resolvedModel,
      messages,
    });

    // Configure provider settings for GPT-5 models
    const providerSettings = StreamingResponseService.configureProviderSettings(
      modelConfig,
      modelSettings,
      vectorStoreIds
    );

    return streamText({
      model,
      messages: modelMessages,
      system: systemPrompt,
      tools,
      ...providerSettings,
      temperature: StreamingResponseService.getTemperature(modelConfig),
      onFinish: async ({ response }) => {
        await StreamingResponseService.handleStreamFinish({
          response,
          modelConfig,
          chatId,
          userId,
          resolvedModel,
          runId,
        });
      },
    });
  }

  /**
   * Create LangSmith run for tracking
   */
  private static async createLangSmithRun(params: {
    chatId: string;
    userId: string;
    model: string;
    messages: ExtendedUIMessage[];
  }): Promise<string | null> {
    if (!isLangSmithEnabled()) {
      return null;
    }

    try {
      const runData = {
        name: 'chat-completion',
        inputs: {
          messages: params.messages,
          model: params.model,
          chatId: params.chatId,
          userId: params.userId,
        },
        runType: 'llm' as const,
      };

      const runId = await createRun(runData);
      return runId as string | null;
    } catch (error) {
      logger.error('Failed to create LangSmith run:', error as any);
      return null;
    }
  }

  /**
   * Configure provider settings for specific models
   */
  private static configureProviderSettings(
    modelConfig: ModelConfiguration,
    modelSettings: any,
    vectorStoreIds?: string[]
  ) {
    if (modelConfig.isGPT5Model && vectorStoreIds) {
      return {
        ...modelSettings,
        enableSearch: true,
        vectorStoreIds,
        fileSearchOptions: {
          maxNumResults: 10,
          ranker: 'default_2024_08_21',
        },
      };
    }

    return modelSettings;
  }

  /**
   * Get appropriate temperature for model
   */
  private static getTemperature(
    modelConfig: ModelConfiguration
  ): number | undefined {
    // Reasoning models don't support temperature
    if (modelConfig.isReasoningCapable || modelConfig.isGPT5Model) {
      return undefined;
    }
    return undefined; // Let the model use its default
  }

  /**
   * Handle stream completion
   */
  private static async handleStreamFinish(params: {
    response: any;
    modelConfig: ModelConfiguration;
    chatId: string;
    userId: string;
    resolvedModel: string;
    runId: string | null;
  }) {
    const { response, modelConfig, chatId, userId, resolvedModel, runId } =
      params;

    try {
      // Extract reasoning for GPT-5 models
      if (modelConfig.isGPT5Model) {
        await StreamingResponseService.extractAndStoreReasoning({
          response,
          chatId,
          userId,
          resolvedModel,
        });
      }

      // Update LangSmith run if enabled
      if (runId && isLangSmithEnabled()) {
        // TODO: Update LangSmith run with completion data
        const completionInfo = { runId, chatId };
        logger.info('Stream completed', completionInfo as any);
      }
    } catch (error) {
      logger.error('Error in stream finish handler:', error);
    }
  }

  /**
   * Extract and store reasoning from GPT-5 responses
   */
  private static async extractAndStoreReasoning(params: {
    response: any;
    chatId: string;
    userId: string;
    resolvedModel: string;
  }) {
    // TODO: Implement reasoning extraction logic
    const reasoningInfo = {
      chatId: params.chatId,
      userId: params.userId,
      model: params.resolvedModel,
    };
    logger.info(
      'Reasoning extraction not yet implemented',
      reasoningInfo as any
    );
  }
}
