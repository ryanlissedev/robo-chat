import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeAssistantMessage } from '@/app/api/chat/db';
import type { Message } from '@/app/types/api.types';
import type { Database } from '@/app/types/database.types';

describe('storeAssistantMessage - TDD London School', () => {
  let mockSupabase: SupabaseClient<Database>;

  // Helper function to create a fresh Supabase mock
  function createSupabaseMock(
    config: {
      chatExists?: boolean;
      chatCreateSuccess?: boolean;
      messageInsertSuccess?: boolean;
      messageInsertError?: string;
    } = {}
  ) {
    const {
      chatExists = true,
      chatCreateSuccess = true,
      messageInsertSuccess = true,
      messageInsertError,
    } = config;

    const mockSingle = vi.fn().mockResolvedValue({
      data: chatExists ? { id: 'test-chat-id' } : null,
      error: chatExists ? null : { message: 'No rows returned' },
    });

    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    const mockChatInsert = vi.fn().mockResolvedValue({
      data: chatCreateSuccess ? [{ id: 'test-chat-id' }] : null,
      error: chatCreateSuccess ? null : { message: 'Chat creation failed' },
    });

    const mockMessageInsert = vi.fn().mockResolvedValue({
      data: messageInsertSuccess ? [{ id: 'test-message-id' }] : null,
      error: messageInsertError
        ? { message: messageInsertError }
        : messageInsertSuccess
          ? null
          : { message: 'Message insert failed' },
    });

    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'chats') {
        return { select: mockSelect, insert: mockChatInsert };
      }
      if (table === 'messages') {
        return { insert: mockMessageInsert };
      }
      return { insert: mockMessageInsert, select: mockSelect };
    });

    return {
      from: mockFrom,
      mocks: {
        from: mockFrom,
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
        chatInsert: mockChatInsert,
        messageInsert: mockMessageInsert,
      },
    } as SupabaseClient<Database> & { mocks: any };
  }

  beforeEach(() => {
    // Create a default successful mock
    mockSupabase = createSupabaseMock();
    vi.clearAllMocks();
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

      // Create a fresh mock that explicitly succeeds
      const successMock = createSupabaseMock({
        chatExists: true,
        messageInsertSuccess: true,
      });

      // Act
      await storeAssistantMessage({
        supabase: successMock,
        chatId,
        messages,
        userId: 'test-user-id', // Provide userId to ensure chat creation can succeed
      });

      // Assert - Verify behavior (interactions)
      expect(successMock.mocks.from).toHaveBeenCalledWith('chats');
      expect(successMock.mocks.single).toHaveBeenCalled();
      expect(successMock.mocks.from).toHaveBeenCalledWith('messages');
      // Note: messages table call happens only when chat exists, which should be the case
      expect(successMock.mocks.messageInsert).toHaveBeenCalledWith({
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

      // Create a fresh mock that explicitly succeeds
      const successMock = createSupabaseMock({
        chatExists: true,
        messageInsertSuccess: true,
      });

      // Act
      await storeAssistantMessage({
        supabase: successMock,
        chatId: 'chat-id',
        messages,
        userId: 'test-user-id', // Provide userId to ensure chat creation can succeed
      });

      // Assert - Focus on collaborations
      expect(successMock.mocks.from).toHaveBeenCalledWith('chats');
      expect(successMock.mocks.from).toHaveBeenCalledWith('messages');
      expect(successMock.mocks.messageInsert).toHaveBeenCalledWith(
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

      // Create a fresh mock that explicitly succeeds
      const successMock = createSupabaseMock({
        chatExists: true,
        messageInsertSuccess: true,
      });

      // Act
      await storeAssistantMessage({
        supabase: successMock,
        chatId: 'chat-id',
        messages,
        userId: 'test-user-id', // Provide userId to ensure chat creation can succeed
      });

      // Assert
      expect(successMock.mocks.from).toHaveBeenCalledWith('chats');
      expect(successMock.mocks.from).toHaveBeenCalledWith('messages');
      expect(successMock.mocks.messageInsert).toHaveBeenCalledWith(
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
      // Arrange - Create mock that will fail message insert
      mockSupabase = createSupabaseMock({
        messageInsertError: 'Database connection failed',
      });

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

    it('should skip saving when chat does not exist and cannot be created', async () => {
      // Arrange - Create mock where chat doesn't exist and no userId provided
      mockSupabase = createSupabaseMock({
        chatExists: false,
      });

      // Act - Note: no userId provided, so chat creation should fail
      await storeAssistantMessage({
        supabase: mockSupabase,
        chatId: 'non-existent-chat-id',
        messages: [
          { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
        ],
        // userId: undefined - this is key to trigger the skip logic
      });

      // Assert - Should check for chat existence but not insert message
      expect(mockSupabase.mocks.from).toHaveBeenCalledWith('chats');
      expect(mockSupabase.mocks.from).not.toHaveBeenCalledWith('messages');
      expect(mockSupabase.mocks.messageInsert).not.toHaveBeenCalled();
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
      expect(mockSupabase.mocks.messageInsert).toHaveBeenCalledWith(
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
      expect(mockSupabase.mocks.messageInsert).toHaveBeenCalledWith(
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
      expect(mockSupabase.mocks.messageInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          parts: [],
        })
      );
    });
  });
});
