import type { LanguageModel, ToolSet } from 'ai';
import { StreamingService } from './StreamingService';
import type { SupabaseClientType } from './types';

/** Narrow type for model settings; pass-through from model configuration. */
type ModelSettings = Record<string, unknown>;

export class AIStreamHandler {
  /**
   * Creates a streaming response using the provided language model and configuration.
   */
  static async createStreamingResponse({
    languageModel,
    effectiveSystemPrompt,
    modelMessages,
    tools,
    isGPT5Model,
    chatId,
    userId,
    resolvedModel,
    reasoningEffort,
    enableSearch,
    supabase,
    messageGroupId,
    langsmithRunId,
  }: {
    languageModel: LanguageModel;
    effectiveSystemPrompt: string;
    modelMessages: ReturnType<typeof import('ai').convertToModelMessages>;
    tools: ToolSet;
    isGPT5Model: boolean;
    chatId: string;
    userId: string;
    resolvedModel: string;
    reasoningEffort: string;
    enableSearch: boolean;
    supabase: SupabaseClientType | null;
    messageGroupId?: string;
    langsmithRunId: string | null;
  }): Promise<Response> {
    return await StreamingService.createStreamingResponse(
      languageModel,
      effectiveSystemPrompt,
      modelMessages,
      tools,
      isGPT5Model,
      chatId,
      userId,
      resolvedModel,
      reasoningEffort,
      enableSearch,
      supabase,
      messageGroupId,
      langsmithRunId
    );
  }

  /**
   * Creates a streaming response with fallback retrieval handling.
   */
  static async createStreamingResponseWithFallback({
    languageModel,
    augmentedSystemPrompt,
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
    messageGroupId,
    langsmithRunId,
  }: {
    languageModel: LanguageModel;
    augmentedSystemPrompt: string;
    modelMessages: ReturnType<typeof import('ai').convertToModelMessages>;
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
    messageGroupId?: string;
    langsmithRunId: string | null;
  }): Promise<Response> {
    return await StreamingService.createStreamingResponseWithFallback(
      languageModel,
      augmentedSystemPrompt,
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
      messageGroupId,
      langsmithRunId
    );
  }

  /**
   * Handles streaming response errors and provides appropriate error responses.
   */
  static handleStreamingError(
    error: unknown,
    context: {
      chatId: string;
      userId: string;
      resolvedModel: string;
      operation: string;
    }
  ): Response {
    const { chatId, userId, resolvedModel, operation } = context;

    // Create a user-friendly error response
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while processing your request';

    return new Response(
      JSON.stringify({
        error: 'streaming_error',
        message: errorMessage,
        details: {
          operation,
          model: resolvedModel,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Validates streaming parameters before creating a response.
   */
  static validateStreamingParameters({
    languageModel,
    modelMessages,
    chatId,
    userId,
    resolvedModel,
  }: {
    languageModel: LanguageModel;
    modelMessages: unknown;
    chatId: string;
    userId: string;
    resolvedModel: string;
  }): void {
    if (!languageModel) {
      throw new Error('Language model is required for streaming');
    }

    if (
      !modelMessages ||
      (Array.isArray(modelMessages) && modelMessages.length === 0)
    ) {
      throw new Error('Model messages are required and cannot be empty');
    }

    if (!chatId) {
      throw new Error('Chat ID is required for streaming');
    }

    if (!userId) {
      throw new Error('User ID is required for streaming');
    }

    if (!resolvedModel) {
      throw new Error('Resolved model is required for streaming');
    }
  }

  /**
   * Prepares streaming configuration based on model type and settings.
   */
  static prepareStreamingConfig({
    isGPT5Model,
    reasoningEffort,
    enableSearch,
    tools,
  }: {
    isGPT5Model: boolean;
    reasoningEffort: string;
    enableSearch: boolean;
    tools: ToolSet;
  }): {
    supportsStreaming: boolean;
    toolsEnabled: boolean;
    streamingOptions: Record<string, unknown>;
  } {
    return {
      supportsStreaming: true, // Most models support streaming
      toolsEnabled: enableSearch && Object.keys(tools).length > 0,
      streamingOptions: {
        isGPT5Model,
        reasoningEffort,
        enableSearch,
        toolCount: Object.keys(tools).length,
      },
    };
  }
}
