import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { shouldEnableFileSearchTools } from '@/lib/retrieval/gating';
import { SystemPromptService } from '@/lib/services/SystemPromptService';

// Mock dependencies - London School focuses on interactions
vi.mock('@/lib/retrieval/gating');

const mockShouldEnableFileSearchTools = vi.mocked(shouldEnableFileSearchTools);

describe('SystemPromptService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEffectiveSystemPrompt', () => {
    it('should use file search prompt when search tools are enabled', async () => {
      mockShouldEnableFileSearchTools.mockReturnValue(true);

      const result = await SystemPromptService.getEffectiveSystemPrompt(
        'custom-system-prompt',
        true,
        true
      );

      expect(mockShouldEnableFileSearchTools).toHaveBeenCalledWith(true, true);
      expect(result).toBe(FILE_SEARCH_SYSTEM_PROMPT);
    });

    it('should use provided system prompt when search tools disabled', async () => {
      mockShouldEnableFileSearchTools.mockReturnValue(false);

      const result = await SystemPromptService.getEffectiveSystemPrompt(
        'custom-system-prompt',
        false,
        false
      );

      expect(mockShouldEnableFileSearchTools).toHaveBeenCalledWith(
        false,
        false
      );
      expect(result).toBe('custom-system-prompt');
    });

    it('should fall back to default system prompt when none provided', async () => {
      mockShouldEnableFileSearchTools.mockReturnValue(false);

      const result = await SystemPromptService.getEffectiveSystemPrompt(
        '',
        false,
        false
      );

      expect(result).toBe(SYSTEM_PROMPT_DEFAULT);
    });

    it('should handle chat context with personality mode', async () => {
      mockShouldEnableFileSearchTools.mockReturnValue(false);

      const result = await SystemPromptService.getEffectiveSystemPrompt(
        'custom-prompt',
        false,
        false,
        {
          context: 'chat',
          personalityMode: 'safety-focused',
        }
      );

      expect(mockShouldEnableFileSearchTools).toHaveBeenCalledWith(
        false,
        false
      );
      expect(result).toBe('custom-prompt');
    });
  });

  describe('hasValidPersonalityMode', () => {
    it('should return true for valid personality modes', () => {
      expect(
        SystemPromptService.hasValidPersonalityMode('safety-focused')
      ).toBe(true);
      expect(
        SystemPromptService.hasValidPersonalityMode('technical-expert')
      ).toBe(true);
      expect(
        SystemPromptService.hasValidPersonalityMode('friendly-assistant')
      ).toBe(true);
    });

    it('should return false for invalid personality modes', () => {
      expect(SystemPromptService.hasValidPersonalityMode('unknown')).toBe(
        false
      );
      expect(SystemPromptService.hasValidPersonalityMode(undefined)).toBe(
        false
      );
      expect(SystemPromptService.hasValidPersonalityMode('')).toBe(false);
    });
  });
});
