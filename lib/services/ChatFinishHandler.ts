/**
 * Service for handling chat completion finish events
 * Extracts complex onFinish logic from the main chat route
 */

import {
  createRun,
  isLangSmithEnabled,
  updateRun,
} from '@/lib/langsmith/client';
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
    response: any
  ): Promise<ToolInvocation[]> {
    try {
      const toolInvocations: ToolInvocation[] = [];

      // Extract tool calls from AI SDK response structure
      if (response.toolCalls && Array.isArray(response.toolCalls)) {
        for (const toolCall of response.toolCalls) {
          toolInvocations.push({
            toolName: toolCall.toolName,
            args: toolCall.args || toolCall.input || {},
            result: undefined, // Tool calls don't have results yet
          });
        }
      }

      // Extract tool results if available
      if (response.toolResults && Array.isArray(response.toolResults)) {
        for (const toolResult of response.toolResults) {
          const existingInvocation = toolInvocations.find(
            (inv) => inv.toolName === toolResult.toolName
          );

          if (existingInvocation) {
            existingInvocation.result = toolResult.result;
          } else {
            // Create new invocation for orphaned results
            toolInvocations.push({
              toolName: toolResult.toolName,
              args: {},
              result: toolResult.result,
            });
          }
        }
      }

      // Also check for legacy toolInvocations format
      if (response.toolInvocations && Array.isArray(response.toolInvocations)) {
        for (const invocation of response.toolInvocations) {
          toolInvocations.push({
            toolName: invocation.toolName,
            args: invocation.args || {},
            result: invocation.result,
          });
        }
      }

      return toolInvocations;
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to extract tool invocations'
      );
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
      const { chatId, userId, model, toolInvocations } = params;

      // Create a completion event run in LangSmith
      const runData = {
        name: 'chat-completion-finish',
        inputs: {
          chatId,
          userId,
          model,
          toolCount: toolInvocations.length,
        },
        runType: 'chain' as const,
        metadata: {
          event: 'finish',
          toolInvocations: toolInvocations.map((inv) => ({
            toolName: inv.toolName,
            hasArgs: Object.keys(inv.args || {}).length > 0,
            hasResult: inv.result !== undefined,
          })),
        },
      };

      const runId = await createRun(runData);

      if (runId) {
        // Update the run with completion outputs
        await updateRun({
          runId: runId as string,
          outputs: {
            success: true,
            toolInvocationsCount: toolInvocations.length,
            toolNames: toolInvocations.map((inv) => inv.toolName),
            completedAt: new Date().toISOString(),
          },
          endTime: new Date(),
        });

        logger.debug(
          {
            runId,
            chatId,
            toolCount: toolInvocations.length,
          },
          'Chat completion logged to LangSmith'
        );
      }
    } catch (error) {
      logger.warn(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to log to LangSmith'
      );
    }
  }
}
