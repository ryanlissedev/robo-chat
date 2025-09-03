/**
 * Service for handling chat completion finish events
 * Extracts complex onFinish logic from the main chat route
 */

import { isLangSmithEnabled } from '@/lib/langsmith/client';
import logger from '@/lib/utils/logger';

export interface FinishHandlerParams {
  response: Response;
  chatId: string;
  userId: string;
  resolvedModel: string;
  isGPT5Model: boolean;
}

export interface ToolInvocation {
  toolName: string;
  result?: Record<string, unknown>;
  args?: Record<string, unknown>;
}

export interface ChatFinishResult {
  success: boolean;
  error?: string;
  toolInvocations?: ToolInvocation[];
}

/**
 * Service for handling chat completion finish events
 */
export class ChatFinishHandler {
  /**
   * Handle the completion of a chat stream
   */
  static async handleFinish(
    params: FinishHandlerParams
  ): Promise<ChatFinishResult> {
    try {
      const { response, chatId, userId, resolvedModel, isGPT5Model } = params;

      logger.info(
        {
          chatId,
          userId,
          model: resolvedModel,
          isGPT5: isGPT5Model,
        },
        'Chat completion finished'
      );

      // Process response and extract tool invocations if any
      const toolInvocations =
        await ChatFinishHandler.extractToolInvocations(response);

      // Log to LangSmith if enabled
      if (isLangSmithEnabled()) {
        await ChatFinishHandler.logToLangSmith({
          chatId,
          userId,
          model: resolvedModel,
          toolInvocations,
        });
      }

      return {
        success: true,
        toolInvocations,
      };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          chatId: params.chatId,
        },
        'Error in chat finish handler'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Extract tool invocations from the response
   */
  private static async extractToolInvocations(
    _response: Response
  ): Promise<ToolInvocation[]> {
    try {
      // TODO: Implement tool invocation extraction logic
      // This would depend on the response format and tool system implementation
      return [];
    } catch (error) {
      logger.warn('Failed to extract tool invocations', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Log chat completion to LangSmith
   */
  private static async logToLangSmith(params: {
    chatId: string;
    userId: string;
    model: string;
    toolInvocations: ToolInvocation[];
  }): Promise<void> {
    try {
      // TODO: Implement LangSmith logging
      logger.debug('Logging to LangSmith', params);
    } catch (error) {
      logger.warn('Failed to log to LangSmith', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
