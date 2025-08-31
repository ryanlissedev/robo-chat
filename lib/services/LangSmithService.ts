import {
  type ExtendedUIMessage,
  getMessageContent,
} from '@/app/types/ai-extended';
import { createRun, isLangSmithEnabled } from '@/lib/langsmith/client';

/**
 * LangSmithService
 *
 * Handles LangSmith integration logic extracted from chat service.
 * Manages run creation and tracing for observability.
 */
export class LangSmithService {
  /**
   * Creates a LangSmith run for tracing chat completions.
   *
   * @param params - Parameters for creating the run
   * @returns Promise<string | null> - The run ID if successful, null otherwise
   */
  static async createLangSmithRun({
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
      const run = await createRun({
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
      });

      return (run as any)?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if LangSmith is enabled in the current environment.
   *
   * @returns boolean - True if LangSmith is enabled, false otherwise
   */
  static isLangSmithEnabled(): boolean {
    return isLangSmithEnabled();
  }
}
