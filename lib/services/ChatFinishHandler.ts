/**
 * Service for handling chat completion finish events
 * Extracts complex onFinish logic from the main chat route
 */

import { isLangSmithEnabled } from '@/lib/langsmith/client';
import logger from '@/lib/utils/logger';

export interface FinishHandlerParams {
  response: any;
  chatId: string;
  userId: string;
  resolvedModel: string;
  isGPT5Model: boolean;
}

export interface ToolInvocation {
  toolName: string;
  result?: any;
  args?: any;
}

/**
 * Service for handling chat completion finish events
 */
export class ChatFinishHandler {
  /**
   * Handle the completion of a chat stream
   */
  static async handleFinish(params: FinishHandlerParams): Promise<void> {
    const { response, chatId, userId, resolvedModel, isGPT5Model } = params;

    try {
      // Log tool results if any
      await ChatFinishHandler.logToolResults(response, chatId, userId);

      // Extract reasoning for GPT-5 models
      if (isGPT5Model) {
        await ChatFinishHandler.extractAndLogReasoning(
          response,
          chatId,
          userId,
          resolvedModel
        );
      }

      // Update LangSmith if enabled
      if (isLangSmithEnabled()) {
        await ChatFinishHandler.updateLangSmithRun(response, chatId, userId);
      }
    } catch (error) {
      logger.error('Error in finish handler:', error as any);
    }
  }

  /**
   * Log tool invocation results
   */
  private static async logToolResults(
    response: any,
    chatId: string,
    userId: string
  ): Promise<void> {
    if (!response.messages || response.messages.length === 0) {
      return;
    }

    const lastMessage = response.messages.at(-1);
    if (!lastMessage) {
      return;
    }

    // Check for tool invocations in the response
    if (lastMessage.toolInvocations && lastMessage.toolInvocations.length > 0) {
      const toolInvocations = lastMessage.toolInvocations as ToolInvocation[];

      for (const invocation of toolInvocations) {
        logger.info(
          { at: 'api.chat.toolInvocation', invocation },
          'Tool invocation result'
        );

        // Special handling for file search results
        if (invocation.toolName === 'fileSearch' && invocation.result) {
          await ChatFinishHandler.logFileSearchResult(
            invocation,
            chatId,
            userId
          );
        }
      }
    }
  }

  /**
   * Log file search specific results
   */
  private static async logFileSearchResult(
    invocation: ToolInvocation,
    chatId: string,
    userId: string
  ): Promise<void> {
    const result = invocation.result;

    logger.info(
      {
        at: 'api.chat.fileSearchResult',
        success: result.success,
        query: result.query,
        resultsCount: result.results?.length || 0,
        chatId,
        userId,
      },
      'File search completed'
    );

    if (result.results && result.results.length > 0) {
      logger.debug(
        {
          at: 'api.chat.fileSearchResults',
          results: result.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            score: r.score,
          })),
          chatId,
          userId,
        },
        'File search results details'
      );
    }
  }

  /**
   * Extract and log reasoning from GPT-5 responses
   */
  private static async extractAndLogReasoning(
    response: any,
    chatId: string,
    userId: string,
    resolvedModel: string
  ): Promise<void> {
    try {
      // Extract reasoning text from response
      const reasoningText = ChatFinishHandler.extractReasoningText(response);

      if (reasoningText) {
        logger.info(
          {
            at: 'api.chat.reasoningExtracted',
            chatId,
            userId,
            model: resolvedModel,
            reasoningLength: reasoningText.length,
            reasoningPreview: reasoningText.slice(0, 200) + '...',
          },
          'GPT-5 reasoning extracted'
        );

        // TODO: Store reasoning in database or external storage
        // await storeReasoning(chatId, userId, reasoningText);
      }
    } catch (error) {
      logger.error('Failed to extract reasoning:', error as any);
    }
  }

  /**
   * Extract reasoning text from response
   */
  private static extractReasoningText(response: any): string | null {
    // Try different paths where reasoning might be stored
    if (response.reasoning) {
      return response.reasoning;
    }

    if (response.metadata?.reasoning) {
      return response.metadata.reasoning;
    }

    if (response.usage?.reasoning) {
      return response.usage.reasoning;
    }

    // Check in messages for reasoning content
    if (response.messages && response.messages.length > 0) {
      const lastMessage = response.messages.at(-1);
      if (lastMessage?.reasoning) {
        return lastMessage.reasoning;
      }
    }

    return null;
  }

  /**
   * Extract assistant text from response messages
   */
  static extractAssistantText(response: any): string {
    if (!response.messages || response.messages.length === 0) {
      return '';
    }

    const last = response.messages.at(-1);
    if (!last || last.role !== 'assistant') {
      return '';
    }

    if (typeof last.content === 'string') {
      return last.content;
    }

    if (Array.isArray(last.content)) {
      return (last.content as { type?: string; text?: string }[])
        .filter((part) => part.type === 'text')
        .map((part) => part.text || '')
        .join(' ');
    }

    return '';
  }

  /**
   * Update LangSmith run with completion data
   */
  private static async updateLangSmithRun(
    response: any,
    chatId: string,
    userId: string
  ): Promise<void> {
    try {
      // TODO: Implement LangSmith run update
      const assistantText = ChatFinishHandler.extractAssistantText(response);

      logger.debug(
        {
          at: 'api.chat.langsmithUpdate',
          chatId,
          userId,
          responseLength: assistantText.length,
        },
        'LangSmith run update (placeholder)'
      );
    } catch (error) {
      logger.error('Failed to update LangSmith run:', error as any);
    }
  }
}
