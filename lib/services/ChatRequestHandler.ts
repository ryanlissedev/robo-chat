import { isLangSmithEnabled } from '@/lib/langsmith/client';
import logger from '@/lib/utils/logger';
import type { ChatRequest } from './types';

/**
 * Handles the initial parsing and validation of chat requests
 */
export class ChatRequestHandler {
  /**
   * Parse and validate the incoming request
   */
  static async parseRequest(req: any): Promise<{
    data: ChatRequest;
    resolvedModel: string;
  }> {
    const requestData = (await req.json()) as ChatRequest;

    // Basic validation - implement proper validation as needed
    if (!requestData.messages || !Array.isArray(requestData.messages)) {
      throw new Error('Invalid messages array');
    }

    // Simple model resolution - implement proper resolution as needed
    const resolvedModel = requestData.model || 'gpt-4';

    return {
      data: requestData,
      resolvedModel,
    };
  }

  /**
   * Log debug information about the request
   */
  static logDebugInfo(): void {
    const debugInfo = {
      enabled: isLangSmithEnabled(),
      apiKey: !!process.env.LANGSMITH_API_KEY,
      project: process.env.LANGSMITH_PROJECT,
      endpoint: process.env.LANGSMITH_ENDPOINT,
      tracing: process.env.LANGSMITH_TRACING,
      tracingV2: process.env.LANGSMITH_TRACING_V2,
    };

    logger.debug('[LangSmith Config]:', debugInfo as any);
  }

  /**
   * Extract and validate request parameters
   */
  static extractRequestParams(requestData: ChatRequest) {
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

    return {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      messageGroupId,
      reasoningEffort,
      verbosity,
      reasoningSummary,
      context,
      personalityMode,
    };
  }
}
