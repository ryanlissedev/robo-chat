/**
 * Comprehensive unit tests for chat API functions
 * Ensuring 100% test coverage for production validation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from '@/app/api/chat/api';
import type { ChatApiParams, SupabaseClientType } from '@/app/types/api.types';

// Mock dependencies
vi.mock('@/lib/server/api', () => ({
  validateUserIdentity: vi.fn(),
}));

vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn(),
}));

vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(),
}));

vi.mock('@/lib/usage', () => ({
  checkUsageByModel: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeUserInput: vi.fn((input: string) => input),
}));

vi.mock('@/lib/utils/logger', () => ({
  logWarning: vi.fn(),
}));

vi.mock('@/app/api/chat/db', () => ({
  storeAssistantMessage: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  FREE_MODELS_IDS: ['gpt-4o-mini', 'claude-3-haiku'],
  NON_AUTH_ALLOWED_MODELS: ['gpt-3.5-turbo'],
}));

import { storeAssistantMessage as storeAssistantMessageToDb } from '@/app/api/chat/db';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { sanitizeUserInput } from '@/lib/sanitize';
// Import mocked functions for assertions
import { validateUserIdentity } from '@/lib/server/api';
import { checkUsageByModel, incrementUsage } from '@/lib/usage';
import { getUserKey } from '@/lib/user-keys';
import { logWarning } from '@/lib/utils/logger';

describe('Chat API Functions', () => {
  let mockSupabase: SupabaseClientType;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
        insert: vi.fn(),
      }),
    } as unknown as SupabaseClientType;

    // Reset environment variables
    process.env.NODE_ENV = 'test';
    process.env.DISABLE_RATE_LIMIT = '';
    process.env.AI_GATEWAY_API_KEY = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAndTrackUsage', () => {
    const baseParams: ChatApiParams = {
      userId: 'user-123',
      model: 'gpt-4',
      isAuthenticated: true,
    };

    it('should return null if user identity validation fails', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(null);

      const result = await validateAndTrackUsage(baseParams);

      expect(result).toBeNull();
      expect(validateUserIdentity).toHaveBeenCalledWith('user-123', true);
    });

    it('should validate authenticated user with valid API key', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue('valid-api-key');
      vi.mocked(checkUsageByModel).mockResolvedValue();

      const result = await validateAndTrackUsage(baseParams);

      expect(result).toBe(mockSupabase);
      expect(getProviderForModel).toHaveBeenCalledWith('gpt-4');
      expect(getUserKey).toHaveBeenCalledWith('user-123', 'openai');
      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        'gpt-4',
        true
      );
    });

    it('should allow authenticated user with free model even without API key', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue(null);
      vi.mocked(checkUsageByModel).mockResolvedValue();

      const result = await validateAndTrackUsage({
        ...baseParams,
        model: 'gpt-4o-mini', // Free model
      });

      expect(result).toBe(mockSupabase);
    });

    it('should throw error for authenticated user without API key for paid model', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue(null);

      await expect(validateAndTrackUsage(baseParams)).rejects.toThrow(
        'This model requires an API key for openai. Please add your API key in settings or use a free model.'
      );
    });

    it('should allow unauthenticated user with free model', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(checkUsageByModel).mockResolvedValue();

      const result = await validateAndTrackUsage({
        ...baseParams,
        isAuthenticated: false,
        model: 'gpt-4o-mini',
      });

      expect(result).toBe(mockSupabase);
    });

    it('should allow unauthenticated user with guest credentials', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(checkUsageByModel).mockResolvedValue();

      const result = await validateAndTrackUsage({
        ...baseParams,
        isAuthenticated: false,
        hasGuestCredentials: true,
      });

      expect(result).toBe(mockSupabase);
    });

    it('should allow unauthenticated user when AI Gateway is configured', async () => {
      process.env.AI_GATEWAY_API_KEY = 'gateway-key';
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(checkUsageByModel).mockResolvedValue();

      const result = await validateAndTrackUsage({
        ...baseParams,
        isAuthenticated: false,
      });

      expect(result).toBe(mockSupabase);
    });

    it('should throw error for unauthenticated user with paid model and no credentials', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);

      await expect(
        validateAndTrackUsage({
          ...baseParams,
          isAuthenticated: false,
        })
      ).rejects.toThrow(
        'This model requires authentication or an API key. Please sign in or provide your API key to access this model.'
      );
    });

    it('should handle usage check properly', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(checkUsageByModel).mockResolvedValue();

      await validateAndTrackUsage({
        ...baseParams,
        model: 'gpt-4o-mini',
      });

      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabase,
        'user-123',
        'gpt-4o-mini',
        true
      );
    });
  });

  describe('incrementMessageCount', () => {
    it('should increment usage successfully', async () => {
      vi.mocked(incrementUsage).mockResolvedValue();

      await incrementMessageCount({
        supabase: mockSupabase,
        userId: 'user-123',
      });

      expect(incrementUsage).toHaveBeenCalledWith(mockSupabase, 'user-123');
    });

    it('should handle increment usage error gracefully', async () => {
      vi.mocked(incrementUsage).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(
        incrementMessageCount({
          supabase: mockSupabase,
          userId: 'user-123',
        })
      ).resolves.not.toThrow();
    });

    it('should return early if supabase is null', async () => {
      await incrementMessageCount({
        supabase: null as unknown as SupabaseClientType,
        userId: 'user-123',
      });

      expect(incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe('logUserMessage', () => {
    const baseLogParams = {
      supabase: mockSupabase,
      userId: 'user-123',
      chatId: 'chat-456',
      content: 'Hello world',
      attachments: [],
      message_group_id: 'group-1',
    };

    beforeEach(() => {
      // Mock successful chat check
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'chat-456' },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      });
    });

    it('should return early if supabase is null', async () => {
      await logUserMessage({
        ...baseLogParams,
        supabase: null as unknown as SupabaseClientType,
      });

      expect(sanitizeUserInput).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest user in development', async () => {
      process.env.NODE_ENV = 'development';

      await logUserMessage({
        ...baseLogParams,
        userId: 'guest-123',
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest user when rate limit disabled', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      await logUserMessage({
        ...baseLogParams,
        userId: 'temp-guest-456',
      });

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should create chat if it does not exist', async () => {
      const mockFrom = vi.fn();
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Chat not found'),
          }),
        }),
      });

      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'chats') {
          return {
            select: mockSelect,
            insert: mockInsert,
          };
        }
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });

      mockSupabase.from = mockFrom;

      await logUserMessage(baseLogParams);

      expect(mockInsert).toHaveBeenCalledWith({
        id: 'chat-456',
        user_id: 'user-123',
        title: 'New Chat',
        model: 'gpt-4o-mini',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should log user message successfully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'chat-456' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: mockInsert };
      });

      await logUserMessage(baseLogParams);

      expect(sanitizeUserInput).toHaveBeenCalledWith('Hello world');
      expect(mockInsert).toHaveBeenCalledWith({
        chat_id: 'chat-456',
        role: 'user',
        content: 'Hello world',
        experimental_attachments: [],
        user_id: 'user-123',
        message_group_id: 'group-1',
      });
    });

    it('should handle message insert error gracefully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        error: new Error('Database constraint violation'),
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'chat-456' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { insert: mockInsert };
      });

      await logUserMessage(baseLogParams);

      expect(logWarning).toHaveBeenCalledWith('Failed to save user message', {
        error: 'Database constraint violation',
      });
    });

    it('should return early if chat creation fails', async () => {
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'chats') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Chat not found'),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({
              error: new Error('Failed to create chat'),
            }),
          };
        }
        return { insert: vi.fn() };
      });

      await logUserMessage(baseLogParams);

      // Should not attempt to insert message if chat creation fails
      const messageInsert = mockSupabase.from('messages');
      expect(messageInsert.insert).not.toHaveBeenCalled();
    });
  });

  describe('storeAssistantMessage', () => {
    const baseStoreParams = {
      supabase: mockSupabase,
      chatId: 'chat-456',
      messages: [],
      userId: 'user-123',
      message_group_id: 'group-1',
      model: 'gpt-4',
      langsmithRunId: 'run-123',
    };

    it('should return early if supabase is null', async () => {
      await storeAssistantMessage({
        ...baseStoreParams,
        supabase: null as unknown as SupabaseClientType,
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should skip storage for guest user in development', async () => {
      process.env.NODE_ENV = 'development';

      await storeAssistantMessage({
        ...baseStoreParams,
        chatId: 'guest-chat-456',
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should skip storage for guest user when rate limit disabled', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      await storeAssistantMessage({
        ...baseStoreParams,
        chatId: 'temp-guest-chat-456',
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should store assistant message successfully', async () => {
      vi.mocked(storeAssistantMessageToDb).mockResolvedValue();

      await storeAssistantMessage(baseStoreParams);

      expect(storeAssistantMessageToDb).toHaveBeenCalledWith({
        supabase: mockSupabase,
        chatId: 'chat-456',
        messages: [],
        userId: 'user-123',
        message_group_id: 'group-1',
        model: 'gpt-4',
        langsmithRunId: 'run-123',
      });
    });

    it('should handle storage error gracefully', async () => {
      vi.mocked(storeAssistantMessageToDb).mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(
        storeAssistantMessage(baseStoreParams)
      ).resolves.not.toThrow();
    });
  });

  describe('Environment-specific behavior', () => {
    it('should handle production environment correctly', async () => {
      process.env.NODE_ENV = 'production';

      await logUserMessage({
        supabase: mockSupabase,
        userId: 'guest-123',
        chatId: 'chat-456',
        content: 'Hello',
        attachments: [],
        message_group_id: 'group-1',
      });

      // Guest users should still be processed in production
      expect(sanitizeUserInput).toHaveBeenCalled();
    });

    it('should handle different guest user ID formats', async () => {
      const guestIds = ['guest-123', 'temp-guest-456'];

      process.env.DISABLE_RATE_LIMIT = 'true';

      for (const userId of guestIds) {
        await logUserMessage({
          supabase: mockSupabase,
          userId,
          chatId: 'chat-456',
          content: 'Hello',
          attachments: [],
          message_group_id: 'group-1',
        });
      }

      // Should skip database operations for all guest user formats
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle validateUserIdentity throwing error', async () => {
      vi.mocked(validateUserIdentity).mockRejectedValue(
        new Error('Auth error')
      );

      await expect(
        validateAndTrackUsage({
          userId: 'user-123',
          model: 'gpt-4',
          isAuthenticated: true,
        })
      ).rejects.toThrow('Auth error');
    });

    it('should handle checkUsageByModel throwing error', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(checkUsageByModel).mockRejectedValue(
        new Error('Usage limit exceeded')
      );

      await expect(
        validateAndTrackUsage({
          userId: 'user-123',
          model: 'gpt-4o-mini',
          isAuthenticated: true,
        })
      ).rejects.toThrow('Usage limit exceeded');
    });

    it('should handle getUserKey throwing error', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabase);
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockRejectedValue(new Error('Key fetch error'));

      await expect(
        validateAndTrackUsage({
          userId: 'user-123',
          model: 'gpt-4',
          isAuthenticated: true,
        })
      ).rejects.toThrow('Key fetch error');
    });
  });
});
