import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { shouldEnableFileSearchTools } from '@/lib/retrieval/gating';

/**
 * SystemPromptService
 *
 * Handles system prompt configuration logic extracted from chat route.
 * Supports voice context with personality modes and file search integration.
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
      context?: 'chat' | 'voice';
      personalityMode?:
        | 'safety-focused'
        | 'technical-expert'
        | 'friendly-assistant';
    }
  ): Promise<string> {
    const context = options?.context;
    const personalityMode = options?.personalityMode;

    // For voice context with personality mode, use personality-specific prompts
    if (context === 'voice' && personalityMode) {
      try {
        // Import personality configs dynamically to get voice-specific prompts
        const { PERSONALITY_CONFIGS } = await import(
          '@/components/app/voice/config/personality-configs'
        );
        if (PERSONALITY_CONFIGS[personalityMode]) {
          return PERSONALITY_CONFIGS[personalityMode].instructions.systemPrompt;
        }
      } catch {
        // Fall back to standard prompt selection on import error
      }
    }

    // For chat context or when no personality mode, use standard prompt selection
    const useSearchPrompt = shouldEnableFileSearchTools(
      enableSearch,
      modelSupportsFileSearchTools
    );

    return useSearchPrompt
      ? FILE_SEARCH_SYSTEM_PROMPT
      : systemPrompt || SYSTEM_PROMPT_DEFAULT;
  }

  /**
   * Determines if the given context is voice context.
   *
   * @param context - The context to check
   * @returns boolean - True if context is voice, false otherwise
   */
  static isVoiceContext(context: 'chat' | 'voice' | undefined): boolean {
    return context === 'voice';
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
