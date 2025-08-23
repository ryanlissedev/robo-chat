import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeAssistantMessage } from '@/app/api/chat/db';
import type { Message } from '@/app/types/api.types';
import type { Database } from '@/app/types/database.types';

describe('storeAssistantMessage - TDD London School', () => {
  let mockSupabase: SupabaseClient<Database>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Supabase client using London School approach
    mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    mockSupabase = { from: mockFrom } as unknown as SupabaseClient<Database>;
  });

  describe('when processing assistant messages with text content', () => {
    it('should extract and save text content correctly', async () => {
      // Arrange
      const chatId = 'test-chat-id';
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Hello world' },
            { type: 'text', text: 'How are you?' },
          ],
        },
      ];

      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId,
        messages,
      });

      // Assert - Verify behavior (interactions)
      expect(mockFrom).toHaveBeenCalledWith('messages');
      expect(mockInsert).toHaveBeenCalledWith({
        chat_id: chatId,
        role: 'assistant',
        content: 'Hello world\n\nHow are you?',
        parts: expect.arrayContaining([
          { type: 'text', text: 'Hello world' },
          { type: 'text', text: 'How are you?' },
        ]),
        message_group_id: undefined,
        model: undefined,
      });
    });
  });

  describe('when processing tool invocations', () => {
    it('should correctly handle tool invocation workflow', async () => {
      // Arrange
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                step: 0,
                toolCallId: 'tool-123',
                toolName: 'search',
                args: { query: 'test' },
              },
            },
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'tool-123',
              toolName: 'search',
              result: { data: 'found' },
            },
          ],
        },
      ];

      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'chat-id',
        messages,
      });

      // Assert - Focus on collaborations
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool-invocation',
              toolInvocation: expect.objectContaining({
                state: 'result',
                toolCallId: 'tool-123',
                toolName: 'search',
                result: { data: 'found' },
              }),
            }),
          ]),
        })
      );
    });
  });

  describe('when processing reasoning content', () => {
    it('should transform reasoning parts correctly', async () => {
      // Arrange
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'reasoning', text: 'Let me think about this...' }],
        },
      ];

      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'chat-id',
        messages,
      });

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: expect.arrayContaining([
            {
              type: 'reasoning',
              reasoningText: 'Let me think about this...',
              details: [
                {
                  type: 'text',
                  text: 'Let me think about this...',
                },
              ],
            },
          ]),
        })
      );
    });
  });

  describe('when database operation fails', () => {
    it('should throw descriptive error', async () => {
      // Arrange
      const dbError = { message: 'Database connection failed' };
      mockInsert.mockResolvedValue({ error: dbError });

      // Act & Assert
      await expect(
        storeAssistantMessage({
          supabase: mockSupabase,
          chatId: 'chat-id',
          messages: [],
        })
      ).rejects.toThrow(
        'Failed to save assistant message: Database connection failed'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages array', async () => {
      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'chat-id',
        messages: [],
      });

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '',
          parts: [],
        })
      );
    });

    it('should handle messages with null content', async () => {
      // Arrange
      const messages: Message[] = [{ role: 'assistant', content: null }];

      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'chat-id',
        messages,
      });

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '',
          parts: [],
        })
      );
    });

    it('should handle tool invocations without toolCallId', async () => {
      // Arrange
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                step: 0,
                toolCallId: '', // Empty toolCallId should be skipped
                toolName: 'search',
                args: { query: 'test' },
              },
            },
          ],
        },
      ];

      // Act
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'chat-id',
        messages,
      });

      // Assert - Should not include the tool invocation
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [],
        })
      );
    });
  });
});
