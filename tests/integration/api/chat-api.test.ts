import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Set up environment variables before any imports
process.env.ENCRYPTION_KEY = Buffer.from('test'.repeat(8)).toString('base64');
process.env.NODE_ENV = 'test';

import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from '@/app/api/chat/api';
import { storeAssistantMessage as storeAssistantMessageToDb } from '@/app/api/chat/db';
import type {
  ChatApiParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from '@/app/types/api.types';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { sanitizeUserInput } from '@/lib/sanitize';
import { validateUserIdentity } from '@/lib/server/api';
import { checkUsageByModel, incrementUsage } from '@/lib/usage';
import { getUserKey } from '@/lib/user-keys';
import { logWarning } from '@/lib/utils/logger';

// Mock all dependencies
vi.mock('@/app/api/chat/db', () => ({
  storeAssistantMessage: vi.fn(),
}));

vi.mock('@/lib/server/api', () => ({
  validateUserIdentity: vi.fn(),
}));

vi.mock('@/lib/usage', () => ({
  checkUsageByModel: vi.fn(),
  incrementUsage: vi.fn(),
}));

vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(),
}));

vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn(),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeUserInput: vi.fn((input) => input),
}));

vi.mock('@/lib/utils/logger', () => ({
  logWarning: vi.fn(),
}));

vi.mock('@/lib/config', () => ({
  FREE_MODELS_IDS: ['gpt-3.5-turbo', 'claude-3-haiku'],
  NON_AUTH_ALLOWED_MODELS: ['gpt-4o-mini'],
}));

// Mock Supabase client
const mockSupabaseClient: SupabaseClientType = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(),
  })),
  auth: {
    getUser: vi.fn(),
  },
} as any;

describe('app/api/chat/api.ts - Chat API Business Logic', () => {
  const mockUserId = 'test-user-123';
  const mockGuestUserId = 'guest-456';
  const mockChatId = 'chat-789';
  const mockModel = 'gpt-4o-mini';
  const mockMessageGroupId = 'msg-group-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    vi.unstubAllEnvs();

    // Default mock implementations
    vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabaseClient);
    vi.mocked(getProviderForModel).mockReturnValue('openai');
    vi.mocked(getUserKey).mockResolvedValue('sk-test-key');
    vi.mocked(checkUsageByModel).mockResolvedValue({
      dailyProCount: 0,
      limit: 10,
    });
    vi.mocked(incrementUsage).mockResolvedValue(undefined);
    vi.mocked(sanitizeUserInput).mockImplementation((input) => input);
    vi.mocked(storeAssistantMessageToDb).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateAndTrackUsage - Supabase Client Handling', () => {
    it('should return null when validateUserIdentity returns null', async () => {
      vi.mocked(validateUserIdentity).mockResolvedValue(null);

      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBeNull();
      expect(validateUserIdentity).toHaveBeenCalledWith(mockUserId, true);
    });

    it('should return supabase client when validation succeeds', async () => {
      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
      expect(validateUserIdentity).toHaveBeenCalledWith(mockUserId, true);
    });
  });

  describe('validateAndTrackUsage - Authenticated Users', () => {
    it('should allow authenticated user with API key for paid model', async () => {
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue('sk-test-key');

      const params: ChatApiParams = {
        userId: mockUserId,
        model: 'gpt-4',
        isAuthenticated: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
      expect(getUserKey).toHaveBeenCalledWith(mockUserId, 'openai');
      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabaseClient,
        mockUserId,
        'gpt-4',
        true
      );
    });

    it('should allow authenticated user with free model even without API key', async () => {
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue(null);

      const params: ChatApiParams = {
        userId: mockUserId,
        model: 'gpt-3.5-turbo', // Free model
        isAuthenticated: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
      expect(checkUsageByModel).toHaveBeenCalled();
    });

    it('should throw error when authenticated user lacks API key for paid model', async () => {
      vi.mocked(getProviderForModel).mockReturnValue('openai');
      vi.mocked(getUserKey).mockResolvedValue(null);

      const params: ChatApiParams = {
        userId: mockUserId,
        model: 'gpt-4', // Paid model not in FREE_MODELS_IDS
        isAuthenticated: true,
      };

      await expect(validateAndTrackUsage(params)).rejects.toThrow(
        'This model requires an API key for openai. Please add your API key in settings or use a free model.'
      );
    });

    it('should handle ollama models for authenticated users', async () => {
      vi.mocked(getProviderForModel).mockReturnValue('ollama');

      const params: ChatApiParams = {
        userId: mockUserId,
        model: 'ollama:llama2',
        isAuthenticated: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
      expect(getUserKey).not.toHaveBeenCalled(); // Skip API key check for ollama
    });

    it('should handle different provider types', async () => {
      const providers = ['anthropic', 'google', 'mistral'] as const;

      for (const provider of providers) {
        vi.clearAllMocks();
        vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabaseClient);
        vi.mocked(getProviderForModel).mockReturnValue(provider);
        vi.mocked(getUserKey).mockResolvedValue('test-key');

        const params: ChatApiParams = {
          userId: mockUserId,
          model: `${provider}-model`,
          isAuthenticated: true,
        };

        const result = await validateAndTrackUsage(params);

        expect(result).toBe(mockSupabaseClient);
        expect(getUserKey).toHaveBeenCalledWith(mockUserId, provider);
      }
    });
  });

  describe('validateAndTrackUsage - Unauthenticated Users', () => {
    it('should allow unauthenticated user with free model', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'gpt-3.5-turbo', // Free model
        isAuthenticated: false,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabaseClient,
        mockGuestUserId,
        'gpt-3.5-turbo',
        false
      );
    });

    it('should allow unauthenticated user with NON_AUTH_ALLOWED_MODELS', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'gpt-4o-mini', // In NON_AUTH_ALLOWED_MODELS
        isAuthenticated: false,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
    });

    it('should allow unauthenticated user with ollama model', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'ollama:codellama',
        isAuthenticated: false,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
    });

    it('should allow unauthenticated user with BYOK credentials', async () => {
      const params: ChatApiParams & { hasGuestCredentials?: boolean } = {
        userId: mockGuestUserId,
        model: 'gpt-4', // Paid model
        isAuthenticated: false,
        hasGuestCredentials: true,
      };

      const result = await validateAndTrackUsage(params);

      expect(result).toBe(mockSupabaseClient);
    });

    it('should throw error for unauthenticated user with paid model and no BYOK', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'gpt-4', // Paid model
        isAuthenticated: false,
      };

      await expect(validateAndTrackUsage(params)).rejects.toThrow(
        'This model requires authentication or an API key. Please sign in or provide your API key to access this model.'
      );
    });

    it('should handle edge case with model name containing ollama but not starting with ollama:', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'custom-ollama-model', // Contains "ollama" but doesn't start with "ollama:"
        isAuthenticated: false,
      };

      await expect(validateAndTrackUsage(params)).rejects.toThrow(
        'This model requires authentication or an API key'
      );
    });
  });

  describe('validateAndTrackUsage - Usage Tracking', () => {
    it('should call checkUsageByModel with correct parameters', async () => {
      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      await validateAndTrackUsage(params);

      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabaseClient,
        mockUserId,
        mockModel,
        true
      );
    });

    it('should propagate usage check errors', async () => {
      vi.mocked(checkUsageByModel).mockRejectedValue(
        new Error('Usage limit exceeded')
      );

      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      await expect(validateAndTrackUsage(params)).rejects.toThrow(
        'Usage limit exceeded'
      );
    });

    it('should handle usage check for guest users', async () => {
      const params: ChatApiParams = {
        userId: mockGuestUserId,
        model: 'gpt-3.5-turbo',
        isAuthenticated: false,
      };

      await validateAndTrackUsage(params);

      expect(checkUsageByModel).toHaveBeenCalledWith(
        mockSupabaseClient,
        mockGuestUserId,
        'gpt-3.5-turbo',
        false
      );
    });
  });

  describe('incrementMessageCount', () => {
    it('should call incrementUsage with correct parameters', async () => {
      await incrementMessageCount({
        supabase: mockSupabaseClient,
        userId: mockUserId,
      });

      expect(incrementUsage).toHaveBeenCalledWith(
        mockSupabaseClient,
        mockUserId
      );
    });

    it('should return early when supabase is null', async () => {
      await incrementMessageCount({
        supabase: null as any,
        userId: mockUserId,
      });

      expect(incrementUsage).not.toHaveBeenCalled();
    });

    it('should not throw error when incrementUsage fails', async () => {
      vi.mocked(incrementUsage).mockRejectedValue(new Error('Database error'));

      await expect(
        incrementMessageCount({
          supabase: mockSupabaseClient,
          userId: mockUserId,
        })
      ).resolves.not.toThrow();

      expect(incrementUsage).toHaveBeenCalled();
    });

    it('should handle undefined supabase client', async () => {
      await incrementMessageCount({
        supabase: undefined as any,
        userId: mockUserId,
      });

      expect(incrementUsage).not.toHaveBeenCalled();
    });
  });

  describe('logUserMessage - Environment Checks', () => {
    const baseParams = {
      supabase: mockSupabaseClient,
      userId: mockGuestUserId,
      chatId: mockChatId,
      content: 'Test message',
      attachments: undefined,
      message_group_id: mockMessageGroupId,
    };

    it('should return early for null supabase client', async () => {
      await logUserMessage({
        ...baseParams,
        supabase: null as any,
      });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest user when rate limiting is disabled', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      await logUserMessage({
        ...baseParams,
        userId: 'guest-123',
      });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest user in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      await logUserMessage({
        ...baseParams,
        userId: 'temp-guest-456',
      });

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should proceed with database operations for non-guest users', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      await logUserMessage({
        ...baseParams,
        userId: 'regular-user-123', // Not a guest user
      });

      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });
  });

  describe('logUserMessage - Chat Existence and Creation', () => {
    const baseParams = {
      supabase: mockSupabaseClient,
      userId: 'regular-user',
      chatId: mockChatId,
      content: 'Test message',
      attachments: undefined,
      message_group_id: mockMessageGroupId,
    };

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production'); // Ensure database operations run
    });

    it('should proceed when chat exists', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      await logUserMessage(baseParams);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chats');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');
    });

    it('should create chat when it does not exist', async () => {
      const mockSelectForCheck = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: mockSelectForCheck,
            insert: mockInsert,
          };
        }
        return { insert: mockInsert };
      }) as any;

      await logUserMessage(baseParams);

      expect(mockInsert).toHaveBeenCalledWith({
        id: mockChatId,
        user_id: 'regular-user',
        title: 'New Chat',
        model: 'gpt-4o-mini',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
    });

    it('should skip message insertion when chat creation fails', async () => {
      const mockSelectForCheck = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        })),
      }));
      const mockInsertChat = vi.fn().mockResolvedValue({
        error: { message: 'Insert failed' },
      });
      const mockInsertMessage = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: mockSelectForCheck,
            insert: mockInsertChat,
          };
        }
        return { insert: mockInsertMessage };
      }) as any;

      await logUserMessage(baseParams);

      expect(mockInsertChat).toHaveBeenCalled();
      expect(mockInsertMessage).not.toHaveBeenCalled();
      expect(logWarning).toHaveBeenCalledWith(
        expect.stringContaining('Chat'),
        expect.objectContaining({ chatId: mockChatId })
      );
    });

    it('should handle database errors during chat check gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockRejectedValue(new Error('Database error')),
        })),
      }));

      mockSupabaseClient.from = vi.fn(() => ({
        select: mockSelect,
        insert: vi.fn().mockResolvedValue({ error: null }),
      })) as any;

      await logUserMessage(baseParams);

      expect(logWarning).not.toHaveBeenCalled(); // Function handles error internally
    });
  });

  describe('logUserMessage - Message Insertion', () => {
    const baseParams = {
      supabase: mockSupabaseClient,
      userId: 'regular-user',
      chatId: mockChatId,
      content: 'Test message with <script>alert("xss")</script>',
      attachments: [{ id: '1', name: 'file.txt' }] as any,
      message_group_id: mockMessageGroupId,
    };

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');

      // Mock successful chat existence check
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));

      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;
    });

    it('should sanitize user input before insertion', async () => {
      vi.mocked(sanitizeUserInput).mockReturnValue('Sanitized content');

      await logUserMessage(baseParams);

      expect(sanitizeUserInput).toHaveBeenCalledWith(
        'Test message with <script>alert("xss")</script>'
      );

      const mockInsert = mockSupabaseClient.from('messages').insert as any;
      expect(mockInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'user',
        content: 'Sanitized content',
        experimental_attachments: [{ id: '1', name: 'file.txt' }],
        user_id: 'regular-user',
        message_group_id: mockMessageGroupId,
      });
    });

    it('should handle message insertion errors gracefully', async () => {
      const mockInsertMessage = vi.fn().mockResolvedValue({
        error: { message: 'Insertion failed' },
      });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockChatId },
                  error: null,
                }),
              })),
            })),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return { insert: mockInsertMessage };
      }) as any;

      await logUserMessage(baseParams);

      expect(logWarning).toHaveBeenCalledWith('Failed to save user message', {
        error: 'Insertion failed',
      });
    });

    it('should handle null attachments', async () => {
      await logUserMessage({
        ...baseParams,
        attachments: undefined,
      });

      const mockInsert = mockSupabaseClient.from('messages').insert as any;
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_attachments: undefined,
        })
      );
    });

    it('should handle empty attachments array', async () => {
      await logUserMessage({
        ...baseParams,
        attachments: [],
      });

      const mockInsert = mockSupabaseClient.from('messages').insert as any;
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_attachments: [],
        })
      );
    });
  });

  describe('storeAssistantMessage - Environment Checks', () => {
    const baseParams: StoreAssistantMessageParams = {
      supabase: mockSupabaseClient,
      chatId: mockChatId,
      messages: [{ role: 'assistant' as const, content: 'Response' }],
      userId: mockUserId,
      message_group_id: mockMessageGroupId,
      model: mockModel,
    };

    it('should return early for null supabase client', async () => {
      await storeAssistantMessage({
        ...baseParams,
        supabase: null as any,
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest context when rate limiting is disabled', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      await storeAssistantMessage({
        ...baseParams,
        chatId: 'guest-chat-123',
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should skip database operations for guest context in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      await storeAssistantMessage({
        ...baseParams,
        chatId: 'temp-guest-chat-456',
      });

      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });

    it('should proceed with database operations for non-guest context', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      await storeAssistantMessage({
        ...baseParams,
        chatId: 'regular-chat-123',
      });

      expect(storeAssistantMessageToDb).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        chatId: 'regular-chat-123',
        messages: baseParams.messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Database Operations', () => {
    const baseParams: StoreAssistantMessageParams = {
      supabase: mockSupabaseClient,
      chatId: 'regular-chat',
      messages: [
        { role: 'assistant' as const, content: 'First response' },
        { role: 'assistant' as const, content: 'Second response' },
      ],
      userId: mockUserId,
      message_group_id: mockMessageGroupId,
      model: mockModel,
    };

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('should call storeAssistantMessageToDb with correct parameters', async () => {
      await storeAssistantMessage(baseParams);

      expect(storeAssistantMessageToDb).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        chatId: 'regular-chat',
        messages: baseParams.messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle database errors silently', async () => {
      vi.mocked(storeAssistantMessageToDb).mockRejectedValue(
        new Error('Database error')
      );

      await expect(storeAssistantMessage(baseParams)).resolves.not.toThrow();

      expect(storeAssistantMessageToDb).toHaveBeenCalled();
    });

    it('should handle empty messages array', async () => {
      await storeAssistantMessage({
        ...baseParams,
        messages: [],
      });

      expect(storeAssistantMessageToDb).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
        })
      );
    });

    it('should handle messages with different content types', async () => {
      const complexMessages = [
        { role: 'assistant' as const, content: 'Text response' },
        {
          role: 'assistant' as const,
          content: [{ type: 'text', text: 'Complex content' }] as any,
        },
      ];

      await storeAssistantMessage({
        ...baseParams,
        messages: complexMessages,
      });

      expect(storeAssistantMessageToDb).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: complexMessages,
        })
      );
    });
  });

  describe('Integration - Concurrent Operations', () => {
    it('should handle concurrent validateAndTrackUsage calls', async () => {
      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      const promises = Array(10)
        .fill(null)
        .map(() => validateAndTrackUsage(params));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBe(mockSupabaseClient);
      });

      expect(validateUserIdentity).toHaveBeenCalledTimes(10);
      expect(checkUsageByModel).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent message operations', async () => {
      const baseParams = {
        supabase: mockSupabaseClient,
        userId: 'regular-user',
        chatId: mockChatId,
        content: 'Test message',
        attachments: undefined,
        message_group_id: mockMessageGroupId,
      };

      // Mock successful chat operations
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      vi.stubEnv('NODE_ENV', 'production');

      const promises = Array(5)
        .fill(null)
        .map((_, index) =>
          logUserMessage({
            ...baseParams,
            content: `Message ${index}`,
            message_group_id: `group-${index}`,
          })
        );

      await Promise.all(promises);

      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(10); // 5 for chats, 5 for messages
    });
  });

  describe('Integration - Error Recovery', () => {
    it('should recover gracefully from validation errors', async () => {
      vi.mocked(validateUserIdentity).mockRejectedValue(
        new Error('Validation failed')
      );

      const params: ChatApiParams = {
        userId: mockUserId,
        model: mockModel,
        isAuthenticated: true,
      };

      await expect(validateAndTrackUsage(params)).rejects.toThrow(
        'Validation failed'
      );

      // System should continue working after error
      vi.mocked(validateUserIdentity).mockResolvedValue(mockSupabaseClient);

      const result = await validateAndTrackUsage(params);
      expect(result).toBe(mockSupabaseClient);
    });

    it('should handle partial failures in message logging', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      // First call fails
      const mockInsertFail = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });

      // Second call succeeds
      const mockInsertSuccess = vi.fn().mockResolvedValue({ error: null });

      let callCount = 0;
      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockChatId },
                  error: null,
                }),
              })),
            })),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        callCount++;
        return {
          insert: callCount === 1 ? mockInsertFail : mockInsertSuccess,
        };
      }) as any;

      const baseParams = {
        supabase: mockSupabaseClient,
        userId: 'regular-user',
        chatId: mockChatId,
        content: 'Test message',
        attachments: undefined,
        message_group_id: mockMessageGroupId,
      };

      // First call should log warning but not throw
      await logUserMessage({ ...baseParams, content: 'Message 1' });
      expect(logWarning).toHaveBeenCalled();

      // Second call should succeed
      vi.clearAllMocks();
      await logUserMessage({ ...baseParams, content: 'Message 2' });
      expect(logWarning).not.toHaveBeenCalled();
    });
  });

  describe('Integration - Real-world Usage Patterns', () => {
    it('should handle complete chat flow for authenticated user', async () => {
      // 1. Validate and track usage
      const validateParams: ChatApiParams = {
        userId: mockUserId,
        model: 'gpt-4o-mini',
        isAuthenticated: true,
      };

      const supabase = await validateAndTrackUsage(validateParams);
      expect(supabase).toBe(mockSupabaseClient);

      // 2. Increment message count
      await incrementMessageCount({ supabase: supabase!, userId: mockUserId });
      expect(incrementUsage).toHaveBeenCalled();

      // 3. Log user message
      vi.stubEnv('NODE_ENV', 'production');
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      await logUserMessage({
        supabase: supabase!,
        userId: mockUserId,
        chatId: mockChatId,
        content: 'Hello AI',
        attachments: undefined,
        message_group_id: mockMessageGroupId,
      });

      // 4. Store assistant message
      await storeAssistantMessage({
        supabase: supabase!,
        chatId: mockChatId,
        messages: [{ role: 'assistant', content: 'Hello! How can I help?' }],
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: 'gpt-4o-mini',
      });

      expect(storeAssistantMessageToDb).toHaveBeenCalled();
    });

    it('should handle guest user flow with rate limiting disabled', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';
      const guestId = 'guest-session-123';

      // 1. Validate guest user
      const validateParams: ChatApiParams = {
        userId: guestId,
        model: 'gpt-3.5-turbo',
        isAuthenticated: false,
      };

      const supabase = await validateAndTrackUsage(validateParams);
      expect(supabase).toBe(mockSupabaseClient);

      // 2. Message operations should be skipped
      await logUserMessage({
        supabase: supabase!,
        userId: guestId,
        chatId: 'guest-chat-123',
        content: 'Guest message',
        attachments: undefined,
        message_group_id: mockMessageGroupId,
      });

      await storeAssistantMessage({
        supabase: supabase!,
        chatId: 'guest-chat-123',
        messages: [{ role: 'assistant', content: 'Response' }],
        userId: guestId,
        message_group_id: mockMessageGroupId,
        model: 'gpt-3.5-turbo',
      });

      // Database operations should be skipped
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(storeAssistantMessageToDb).not.toHaveBeenCalled();
    });
  });
});
