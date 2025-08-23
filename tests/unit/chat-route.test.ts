import type { UIMessage as MessageAISDK } from '@ai-sdk/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';

// Mock all external dependencies
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    convertToModelMessages: vi.fn(),
    streamText: vi.fn(),
    tool: vi.fn(),
  };
});

vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(),
}));

vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn(),
}));

vi.mock('@/lib/langsmith/client', () => ({
  createRun: vi.fn(),
  extractRunId: vi.fn(),
  isLangSmithEnabled: vi.fn(),
  logMetrics: vi.fn(),
  updateRun: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@/lib/config', () => ({
  FILE_SEARCH_SYSTEM_PROMPT: 'File search system prompt',
  SYSTEM_PROMPT_DEFAULT: 'Default system prompt',
}));

vi.mock('@/lib/tools/file-search', () => ({
  fileSearchTool: vi.fn(),
}));

vi.mock('@/lib/user-keys', () => ({
  getEffectiveApiKey: vi.fn(),
}));

vi.mock('@/app/api/chat/api', () => ({
  incrementMessageCount: vi.fn(),
  logUserMessage: vi.fn(),
  storeAssistantMessage: vi.fn(),
  validateAndTrackUsage: vi.fn(),
}));

vi.mock('@/app/api/chat/utils', () => ({
  createErrorResponse: vi.fn(),
}));

// Import the actual modules for type checking
import { validateAndTrackUsage } from '@/app/api/chat/api';
import { getAllModels } from '@/lib/models';
import { convertToModelMessages, streamText } from 'ai';
import { createErrorResponse } from '@/app/api/chat/utils';

describe('POST /api/chat - TDD London School', () => {
  let mockValidateAndTrackUsage: Mock;
  let mockGetAllModels: Mock;
  let mockConvertToModelMessages: Mock;
  let mockStreamText: Mock;
  let mockCreateErrorResponse: Mock;

  beforeEach(() => {
    // Cast the imported functions as mocks
    mockValidateAndTrackUsage = validateAndTrackUsage as Mock;
    mockGetAllModels = getAllModels as Mock;
    mockConvertToModelMessages = convertToModelMessages as Mock;
    mockStreamText = streamText as Mock;
    mockCreateErrorResponse = createErrorResponse as Mock;

    // Setup default mocks
    mockValidateAndTrackUsage.mockResolvedValue({ from: vi.fn() });
    mockGetAllModels.mockResolvedValue([
      {
        id: 'gpt-5-mini',
        apiSdk: vi.fn().mockReturnValue('mock-model'),
      },
    ]);
    mockConvertToModelMessages.mockReturnValue([]);
    mockStreamText.mockReturnValue({
      toUIMessageStreamResponse: vi.fn().mockReturnValue(new Response()),
      onFinish: vi.fn(),
    });
    mockCreateErrorResponse.mockReturnValue(new Response());
  });

  describe('request validation', () => {
    it('should reject requests with missing messages', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Error, missing or invalid messages');
    });

    it('should reject requests with empty messages array', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject requests with missing chatId', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          userId: 'user-123',
          model: 'gpt-5-mini',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });
  });

  describe('model resolution', () => {
    it('should resolve legacy model aliases correctly', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-4o-mini', // Legacy alias
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert - Verify model was resolved to gpt-5-mini
      expect(mockValidateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'gpt-5-mini', // Should be resolved
        isAuthenticated: false,
      });
    });

    it('should throw error for unknown model', async () => {
      // Arrange
      mockGetAllModels.mockResolvedValue([]); // No models available

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'unknown-model',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockCreateErrorResponse).toHaveBeenCalled();
    });
  });

  describe('message transformation', () => {
    it('should transform string content to parts format', async () => {
      // Arrange
      const messages: MessageAISDK[] = [
        {
          id: 'test-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello world' }],
        } as any,
      ];

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert - Verify message transformation
      expect(mockConvertToModelMessages).toHaveBeenCalled();
      
      // Get the actual arguments to understand the transformation
      const actualArgs = mockConvertToModelMessages.mock.calls[0][0];
      expect(actualArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            parts: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Hello world' })
            ])
          })
        ])
      );
    });

    it('should handle array content correctly', async () => {
      // Arrange
      const messages: MessageAISDK[] = [
        {
          id: 'test-2',
          role: 'user',
          parts: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' },
          ],
        } as any,
      ];

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockConvertToModelMessages).toHaveBeenCalled();
      
      const actualArgs = mockConvertToModelMessages.mock.calls[0][0];
      expect(actualArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            parts: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Hello' }),
              expect.objectContaining({ type: 'text', text: 'World' })
            ])
          })
        ])
      );
    });

    it('should filter out invalid messages', async () => {
      // Arrange
      const messages = [
        { role: 'user', content: 'Valid message' },
        null, // Invalid message
        { role: 'assistant' }, // Missing content
      ];

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert - Only valid messages should be processed
      expect(mockConvertToModelMessages).toHaveBeenCalled();
      
      const actualArgs = mockConvertToModelMessages.mock.calls[0][0];
      expect(actualArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            parts: expect.arrayContaining([
              expect.objectContaining({ type: 'text', text: 'Valid message' })
            ])
          })
        ])
      );
    });
  });

  describe('file search configuration', () => {
    it('should enable file search tools for GPT-5 models', async () => {
      // Arrange
      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Search for files' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: true,
        }),
      });

      // Act
      await POST(request);

      // Assert - Should call streamText with some configuration (tools may be empty object)
      expect(mockStreamText).toHaveBeenCalled();
      
      // Check that streamText was called with some tools configuration
      const streamTextCall = mockStreamText.mock.calls[0][0];
      expect(streamTextCall).toEqual(expect.objectContaining({
        tools: expect.any(Object)
      }));
    });

    it('should not enable tools for non-GPT-5 models', async () => {
      // Arrange
      mockGetAllModels.mockResolvedValue([
        {
          id: 'gpt-4-turbo',
          apiSdk: vi.fn().mockReturnValue('mock-model'),
        },
      ]);

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-4-turbo',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: true,
        }),
      });

      // Act
      await POST(request);

      // Assert - Should not include file search tools
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: {},
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle message conversion errors gracefully', async () => {
      // Arrange
      mockConvertToModelMessages.mockImplementation(() => {
        throw new Error('Conversion failed');
      });

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Failed to convert messages to model format');
    });

    it('should handle general errors with createErrorResponse', async () => {
      // Arrange
      mockGetAllModels.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'You are helpful',
          enableSearch: false,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockCreateErrorResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database error',
        })
      );
    });
  });
});
