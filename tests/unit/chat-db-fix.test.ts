/**
 * Test for the foreign key constraint fix
 * Tests that chat creation and message saving work correctly
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeAssistantMessage } from '@/app/api/chat/db';
import type { StoreAssistantMessageParams } from '@/app/types/api.types';

// Mock the logger
vi.mock('@/lib/utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logDebug: vi.fn(),
  logTrace: vi.fn(),
}));

describe('Chat Database Fix', () => {
  // Helper function to create a Supabase mock
  function createSupabaseMock(config: {
    chatExists?: boolean;
    chatCreateSuccess?: boolean;
    messageInsertSuccess?: boolean;
  } = {}) {
    const {
      chatExists = true,
      chatCreateSuccess = true,
      messageInsertSuccess = true,
    } = config;

    const mockSingle = vi.fn().mockResolvedValue({
      data: chatExists ? { id: 'test-chat-id' } : null,
      error: chatExists ? null : { message: 'No rows returned' },
    });

    const mockChatInsert = vi.fn().mockResolvedValue({
      data: chatCreateSuccess ? [{ id: 'test-chat-id' }] : null,
      error: chatCreateSuccess ? null : { message: 'Insert failed' },
    });

    const mockMessageInsert = vi.fn().mockResolvedValue({
      data: messageInsertSuccess ? [{ id: 'test-message-id' }] : null,
      error: messageInsertSuccess ? null : { message: 'Message insert failed' },
    });

    const mockFrom = vi.fn().mockImplementation((tableName: string) => {
      if (tableName === 'chats') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle,
            })),
          })),
          insert: mockChatInsert,
        };
      }
      if (tableName === 'messages') {
        return {
          insert: mockMessageInsert,
        };
      }
      return {};
    });

    return {
      from: mockFrom,
      mocks: {
        from: mockFrom,
        single: mockSingle,
        chatInsert: mockChatInsert,
        messageInsert: mockMessageInsert,
      },
    };
  }

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should create chat if it does not exist before saving assistant message', async () => {
    // Arrange - Chat doesn't exist initially, but creation succeeds
    const mockSupabase = createSupabaseMock({
      chatExists: false,
      chatCreateSuccess: true,
      messageInsertSuccess: true,
    });

    const params: StoreAssistantMessageParams = {
      supabase: mockSupabase as any,
      chatId: 'test-chat-id',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      ],
      userId: 'test-user-id',
      message_group_id: 'test-group-id',
      model: 'gpt-4o-mini',
    };

    // Act
    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Assert
    expect(mockSupabase.mocks.from).toHaveBeenCalledWith('chats');
    expect(mockSupabase.mocks.from).toHaveBeenCalledWith('messages');
    expect(mockSupabase.mocks.chatInsert).toHaveBeenCalled();
    expect(mockSupabase.mocks.messageInsert).toHaveBeenCalled();
  });

  it('should skip message saving if chat cannot be created', async () => {
    // Arrange - Chat doesn't exist and creation fails
    const mockSupabase = createSupabaseMock({
      chatExists: false,
      chatCreateSuccess: false, // This will cause the skip logic to trigger
    });

    const params: StoreAssistantMessageParams = {
      supabase: mockSupabase as any,
      chatId: 'test-chat-id',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      ],
      userId: 'test-user-id',
      message_group_id: 'test-group-id',
      model: 'gpt-4o-mini',
    };

    // Act
    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Assert - Get the mocked logger and check it was called
    const { logWarning } = await import('@/lib/utils/logger');
    expect(logWarning).toHaveBeenCalledWith(
      'Chat does not exist and cannot be created. Skipping message save.',
      { chatId: 'test-chat-id' }
    );
    
    // Verify message insert was not attempted
    expect(mockSupabase.mocks.messageInsert).not.toHaveBeenCalled();
  });

  it('should proceed normally if chat already exists', async () => {
    // Arrange - Chat exists
    const mockSupabase = createSupabaseMock({
      chatExists: true,
      messageInsertSuccess: true,
    });

    const params: StoreAssistantMessageParams = {
      supabase: mockSupabase as any,
      chatId: 'test-chat-id',
      messages: [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      ],
      userId: 'test-user-id',
      message_group_id: 'test-group-id',
      model: 'gpt-4o-mini',
    };

    // Act
    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Assert - Verify both chats and messages tables are accessed
    expect(mockSupabase.mocks.from).toHaveBeenCalledWith('chats');
    expect(mockSupabase.mocks.from).toHaveBeenCalledWith('messages');
    expect(mockSupabase.mocks.messageInsert).toHaveBeenCalled();
  });
});