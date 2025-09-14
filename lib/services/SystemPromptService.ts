import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { shouldEnableFileSearchTools } from '@/lib/retrieval/gating';

/**
 * SystemPromptService
 *
 * Handles system prompt configuration logic extracted from chat route.
 * Supports chat context with personality modes and file search integration.
 */
export class SystemPromptService {
  /**
   * Gets the effective system prompt based on context and configuration.
   *
   * @param systemPrompt - Base system prompt
   * @param enableSearch - Whether search functionality is enabled
   * @param modelSupportsFileSearchTools - Whether the model supports file search tools
   * @param options - Additional options for context and personality mode
   * @returns Promise<string> - The effective system prompt to use
   */
  static async getEffectiveSystemPrompt(
    systemPrompt: string,
    enableSearch: boolean,
    modelSupportsFileSearchTools: boolean,
    options?: {
      context?: 'chat';
      personalityMode?:
        | 'safety-focused'
        | 'technical-expert'
        | 'friendly-assistant';
    }
  ): Promise<string> {
    // Note: Personality mode handling removed with voice functionality
    // Use standard prompt selection
    const useSearchPrompt = shouldEnableFileSearchTools(
      enableSearch,
      modelSupportsFileSearchTools
    );

    return useSearchPrompt
      ? FILE_SEARCH_SYSTEM_PROMPT
      : systemPrompt || SYSTEM_PROMPT_DEFAULT;
  }

  /**
   * Validates if the personality mode is valid.
   *
   * @param personalityMode - The personality mode to validate
   * @returns boolean - True if valid personality mode, false otherwise
   */
  static hasValidPersonalityMode(personalityMode: string | undefined): boolean {
    if (!personalityMode) return false;
    return [
      'safety-focused',
      'technical-expert',
      'friendly-assistant',
    ].includes(personalityMode);
  }
}
