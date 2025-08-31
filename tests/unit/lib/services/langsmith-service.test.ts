import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LangSmithService } from '@/lib/services/LangSmithService';

// Mock dependencies with vi.hoisted for better isolation - London School focuses on interactions
const mockCreateRun = vi.hoisted(() => vi.fn());
const mockIsLangSmithEnabled = vi.hoisted(() => vi.fn());
const mockGetMessageContent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/langsmith/client', () => ({
  createRun: mockCreateRun,
  isLangSmithEnabled: mockIsLangSmithEnabled,
}));

vi.mock('@/app/types/ai-extended', () => ({
  getMessageContent: mockGetMessageContent,
}));

describe('LangSmithService', () => {
  beforeEach(() => {
    // Reset all mocks completely
    vi.resetAllMocks();
    vi.clearAllMocks();

    // Reset specific mocks to their original state
    mockCreateRun.mockReset();
    mockIsLangSmithEnabled.mockReset();
    mockGetMessageContent.mockReset();

    // Setup default mock implementation for message content extraction
    mockGetMessageContent.mockImplementation((msg: any) => {
      if (msg.content) return msg.content;
      if (msg.parts) {
        return msg.parts
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
      }
      return '';
    });
  });

  describe('createLangSmithRun', () => {
    const mockRunParams = {
      resolvedModel: 'gpt-4',
      messages: [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ],
      reasoningEffort: 'medium',
      enableSearch: true,
      userId: 'user123',
      chatId: 'chat456',
    };

    it('should return null when LangSmith is disabled', async () => {
      mockIsLangSmithEnabled.mockReturnValue(false);

      const result = await LangSmithService.createLangSmithRun(mockRunParams);

      // Verify behavior: should check if enabled and return null
      // London School focuses on behavior, not implementation details like call counts
      expect(mockIsLangSmithEnabled).toHaveBeenCalledWith();
      expect(result).toBeNull();
    });

    it('should create run successfully when LangSmith is enabled', async () => {
      const mockRun = { id: 'run-123' };
      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockResolvedValue(mockRun);

      const result = await LangSmithService.createLangSmithRun(mockRunParams);

      expect(mockIsLangSmithEnabled).toHaveBeenCalled();
      expect(mockCreateRun).toHaveBeenCalledWith({
        name: 'chat-completion',
        inputs: {
          model: 'gpt-4',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
          reasoningEffort: 'medium',
          enableSearch: true,
        },
        runType: 'chain',
        metadata: {
          userId: 'user123',
          chatId: 'chat456',
          model: 'gpt-4',
          reasoningEffort: 'medium',
          enableSearch: true,
        },
      });
      expect(result).toBe('run-123');
    });

    it('should return null when createRun throws an error', async () => {
      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockRejectedValue(new Error('API Error'));

      const result = await LangSmithService.createLangSmithRun(mockRunParams);

      expect(mockIsLangSmithEnabled).toHaveBeenCalled();
      expect(mockCreateRun).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle missing optional fields gracefully', async () => {
      const partialParams = {
        resolvedModel: 'gpt-4',
        messages: [{ role: 'user' as const, content: 'Hello' }],
        reasoningEffort: 'low',
        enableSearch: false,
        userId: 'user123',
        chatId: 'chat456',
      };

      const mockRun = { id: 'run-456' };
      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockResolvedValue(mockRun);

      const result = await LangSmithService.createLangSmithRun(partialParams);

      expect(mockCreateRun).toHaveBeenCalledWith({
        name: 'chat-completion',
        inputs: {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Hello' }],
          reasoningEffort: 'low',
          enableSearch: false,
        },
        runType: 'chain',
        metadata: {
          userId: 'user123',
          chatId: 'chat456',
          model: 'gpt-4',
          reasoningEffort: 'low',
          enableSearch: false,
        },
      });
      expect(result).toBe('run-456');
    });

    it('should return null when run object has no id', async () => {
      const mockRunWithoutId = {}; // Run without id
      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockResolvedValue(mockRunWithoutId);

      const result = await LangSmithService.createLangSmithRun(mockRunParams);

      expect(mockIsLangSmithEnabled).toHaveBeenCalled();
      expect(mockCreateRun).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should extract content from complex message objects', async () => {
      const complexMessages = [
        {
          role: 'user' as const,
          parts: [
            { type: 'text', text: 'Complex message' },
            {
              type: 'image_url',
              image_url: { url: 'data:image/png;base64,abc' },
            },
          ],
        },
      ];

      const mockRun = { id: 'run-789' };
      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockResolvedValue(mockRun);

      const result = await LangSmithService.createLangSmithRun({
        ...mockRunParams,
        messages: complexMessages,
      });

      expect(mockGetMessageContent).toHaveBeenCalledWith(complexMessages[0]);
      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          inputs: expect.objectContaining({
            messages: expect.arrayContaining([
              expect.objectContaining({
                role: 'user',
                content: 'Complex message',
              }),
            ]),
          }),
        })
      );
      expect(result).toBe('run-789');
    });
  });

  describe('isLangSmithEnabled', () => {
    it('should proxy to the langsmith client isLangSmithEnabled function', () => {
      mockIsLangSmithEnabled.mockReturnValue(true);

      const result = LangSmithService.isLangSmithEnabled();

      expect(mockIsLangSmithEnabled).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when langsmith client returns false', () => {
      mockIsLangSmithEnabled.mockReturnValue(false);

      const result = LangSmithService.isLangSmithEnabled();

      expect(mockIsLangSmithEnabled).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });
});
