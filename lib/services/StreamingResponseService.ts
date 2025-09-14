import type { LanguageModel, ToolSet } from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import {
  createRun,
  isLangSmithEnabled,
  updateRun,
} from '@/lib/langsmith/client';
import logger, { logError } from '@/lib/utils/logger';
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
      onFinish: async ({ response }: { response?: unknown }) => {
        await StreamingResponseService.handleStreamFinish({
          response: response as any,
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
      logger.error({ error: error as any }, 'Failed to create LangSmith run');
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
        await StreamingResponseService.updateLangSmithRun({
          runId,
          response,
          chatId,
          userId,
          resolvedModel,
        });
      }
    } catch (error) {
      logError(error, { at: 'stream.finish' });
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
    try {
      const { response, chatId, userId, resolvedModel } = params;

      // Extract reasoning from AI SDK response
      let reasoning: string | null = null;

      if (response.reasoningText) {
        reasoning = response.reasoningText;
      } else if (response.reasoning && Array.isArray(response.reasoning)) {
        reasoning = response.reasoning
          .map((r: any) => r.text || r.content || String(r))
          .join('\n');
      }

      if (reasoning) {
        // Store reasoning for potential future use (database, cache, etc.)
        const reasoningData = {
          chatId,
          userId,
          model: resolvedModel,
          reasoning,
          timestamp: new Date().toISOString(),
        };

        logger.info(
          {
            chatId,
            userId,
            model: resolvedModel,
            reasoningLength: reasoning.length,
          },
          'Reasoning extracted from GPT-5 response'
        );

        // Storage to database or cache can be implemented here if needed
        // Currently logging the successful extraction
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          chatId: params.chatId,
          model: params.resolvedModel,
        },
        'Failed to extract reasoning from response'
      );
    }
  }

  /**
   * Update LangSmith run with completion data
   */
  private static async updateLangSmithRun(params: {
    runId: string;
    response: any;
    chatId: string;
    userId: string;
    resolvedModel: string;
  }) {
    try {
      const { runId, response, chatId, userId, resolvedModel } = params;

      // Extract completion data from AI SDK response
      const outputs = {
        text: response.text || '',
        finishReason: response.finishReason,
        usage: response.usage,
        toolCalls: response.toolCalls || [],
        toolResults: response.toolResults || [],
        reasoning: response.reasoningText || null,
        chatId,
        userId,
        model: resolvedModel,
      };

      await updateRun({
        runId,
        outputs,
        endTime: new Date(),
      });

      logger.info(
        {
          runId,
          chatId,
          finishReason: response.finishReason,
          toolCallCount: response.toolCalls?.length || 0,
        },
        'LangSmith run updated successfully'
      );
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          runId: params.runId,
          chatId: params.chatId,
        },
        'Failed to update LangSmith run'
      );
    }
  }
}
