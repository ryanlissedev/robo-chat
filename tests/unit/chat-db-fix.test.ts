/**
 * Test for the foreign key constraint fix
 * Tests that chat creation and message saving work correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeAssistantMessage } from '@/app/api/chat/db';
import type { StoreAssistantMessageParams } from '@/app/types/api.types';

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

const mockSupabase = {
  from: vi.fn((tableName: string) => {
    if (tableName === 'chats') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
        insert: mockInsert,
      };
    }
    if (tableName === 'messages') {
      return {
        insert: mockInsert,
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
      insert: mockInsert,
    };
  }),
};

describe('Chat Database Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create chat if it does not exist before saving assistant message', async () => {
    // Mock chat doesn't exist
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows returned' },
    });

    // Mock successful chat creation and message insertion
    mockInsert.mockResolvedValueOnce({
      data: { id: 'test-chat-id' },
      error: null,
    }).mockResolvedValueOnce({
      data: { id: 'test-message-id' },
      error: null,
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

    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Verify chat creation was attempted
    expect(mockSupabase.from).toHaveBeenCalledWith('chats');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should skip message saving if chat cannot be created', async () => {
    // Mock chat doesn't exist
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows returned' },
    });

    // Mock failed chat creation
    mockInsert.mockResolvedValueOnce({
      data: null,
      error: { message: 'Insert failed' },
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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

    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Verify warning was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Chat test-chat-id does not exist and cannot be created')
    );

    consoleSpy.mockRestore();
  });

  it('should proceed normally if chat already exists', async () => {
    // Mock chat exists
    mockSingle.mockResolvedValueOnce({
      data: { id: 'test-chat-id' },
      error: null,
    });

    // Mock successful message insertion
    mockInsert.mockResolvedValueOnce({
      data: { id: 'test-message-id' },
      error: null,
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

    await expect(storeAssistantMessage(params)).resolves.not.toThrow();

    // Verify message insertion was attempted (chat exists, so no chat creation needed)
    expect(mockSupabase.from).toHaveBeenCalledWith('chats');
    expect(mockSupabase.from).toHaveBeenCalledWith('messages');
    expect(mockInsert).toHaveBeenCalled();
  });
});