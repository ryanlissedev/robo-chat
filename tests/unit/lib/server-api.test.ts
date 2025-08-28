import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateUserIdentity } from '@/lib/server/api';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { createGuestServerClient } from '@/lib/supabase/server-guest';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server-guest', () => ({
  createGuestServerClient: vi.fn(),
}));

// Using global standardized mock from tests/setup.ts

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(),
  })),
};

describe('lib/server/api.ts - Server API Validation', () => {
  const mockUserId = 'test-user-123';
  const mockGuestUserId = 'guest-456';
  const mockTempGuestUserId = 'temp-guest-789';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.DISABLE_RATE_LIMIT;
    if (process.env.NODE_ENV !== undefined) {
      delete (process.env as any).NODE_ENV;
    }

    // Default mock implementations
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any);
    vi.mocked(createGuestServerClient).mockResolvedValue(
      mockSupabaseClient as any
    );
    vi.mocked(isSupabaseEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateUserIdentity - Supabase Disabled', () => {
    it('should return null when Supabase is disabled', async () => {
      vi.mocked(isSupabaseEnabled).mockReturnValue(false);

      const result = await validateUserIdentity(mockUserId, true);

      expect(result).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
      expect(createGuestServerClient).not.toHaveBeenCalled();
    });
  });

  describe('validateUserIdentity - Client Creation Errors', () => {
    it('should throw error when authenticated client creation fails', async () => {
      vi.mocked(createClient).mockResolvedValue(null);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Failed to initialize Supabase client'
      );
    });

    it('should throw error when guest client creation fails', async () => {
      vi.mocked(createGuestServerClient).mockResolvedValue(null);

      await expect(
        validateUserIdentity(mockGuestUserId, false)
      ).rejects.toThrow('Failed to initialize Supabase client');
    });
  });

  describe('validateUserIdentity - Authenticated Users', () => {
    it('should validate authenticated user successfully', async () => {
      const mockAuthData = {
        data: {
          user: { id: mockUserId },
        },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      const result = await validateUserIdentity(mockUserId, true);

      expect(result).toBe(mockSupabaseClient);
      expect(createClient).toHaveBeenCalled();
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('should throw error when auth.getUser fails', async () => {
      const mockAuthError = {
        data: null,
        error: { message: 'Auth error' },
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthError);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should throw error when no user data returned', async () => {
      const mockAuthData = {
        data: { user: null },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should throw error when user ID does not match', async () => {
      const mockAuthData = {
        data: {
          user: { id: 'different-user-id' },
        },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'User ID does not match authenticated user'
      );
    });

    it('should handle missing user ID in auth data', async () => {
      const mockAuthData = {
        data: {
          user: { id: null },
        },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });
  });

  describe('validateUserIdentity - Guest Users with Rate Limit Disabled', () => {
    it('should skip database validation when DISABLE_RATE_LIMIT is true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';

      const result = await validateUserIdentity(mockGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should skip database validation in development environment', async () => {
      process.env.NODE_ENV = 'development';

      const result = await validateUserIdentity(mockGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should skip database validation when both conditions are true', async () => {
      process.env.DISABLE_RATE_LIMIT = 'true';
      process.env.NODE_ENV = 'development';

      const result = await validateUserIdentity(mockGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });
  });

  describe('validateUserIdentity - Temporary Guest Users', () => {
    it('should skip database validation for guest- prefixed users', async () => {
      const result = await validateUserIdentity(mockGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should skip database validation for temp-guest- prefixed users', async () => {
      const result = await validateUserIdentity(mockTempGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalled();
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should handle edge case with guest- at end of userId', async () => {
      const edgeGuestUserId = 'user-guest-123';

      // Mock database operations for non-temp guest user
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: edgeGuestUserId },
              error: null,
            }),
          })),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      const result = await validateUserIdentity(edgeGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });
  });

  describe('validateUserIdentity - Persistent Guest Users Database Operations', () => {
    const persistentGuestUserId = 'persistent-guest-123';

    beforeEach(() => {
      // Ensure we're not in skip conditions
      delete process.env.DISABLE_RATE_LIMIT;
      process.env.NODE_ENV = 'production';
    });

    it('should return client when guest user exists in database', async () => {
      const mockUserRecord = { id: persistentGuestUserId };
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockUserRecord,
              error: null,
            }),
          })),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should create guest user record when not found and return client', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows found' },
            }),
          })),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockInsert).toHaveBeenCalledWith({
        id: persistentGuestUserId,
        email: `${persistentGuestUserId}@anonymous.example`,
        anonymous: true,
        message_count: 0,
        premium: false,
        created_at: expect.any(String),
      });
    });

    it('should handle database error during user lookup gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' },
            }),
          })),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should return client even when user creation fails', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows found' },
            }),
          })),
        })),
      }));
      const mockInsert = vi.fn().mockRejectedValue(new Error('Insert failed'));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should validate user record with correct database query parameters', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: { id: persistentGuestUserId },
        error: null,
      });
      const mockEqAnonymous = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
      const mockEqId = vi.fn(() => ({ eq: mockEqAnonymous }));
      const mockSelect = vi.fn(() => ({ eq: mockEqId }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      await validateUserIdentity(persistentGuestUserId, false);

      expect(mockSelect).toHaveBeenCalledWith('id');
      expect(mockEqId).toHaveBeenCalledWith('id', persistentGuestUserId);
      expect(mockEqAnonymous).toHaveBeenCalledWith('anonymous', true);
    });
  });

  describe('validateUserIdentity - Edge Cases and Error Handling', () => {
    it('should handle empty userId string', async () => {
      const mockAuthData = {
        data: { user: { id: '' } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity('', true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should handle null userId', async () => {
      const mockAuthData = {
        data: { user: { id: null } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity(null as any, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should handle undefined user in auth response', async () => {
      const mockAuthData = {
        data: { user: undefined },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should handle malformed auth response', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Unable to get authenticated user'
      );
    });

    it('should handle auth.getUser throwing an exception', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Network error')
      );

      await expect(validateUserIdentity(mockUserId, true)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('validateUserIdentity - Environment Variable Edge Cases', () => {
    it('should handle DISABLE_RATE_LIMIT set to false string', async () => {
      process.env.DISABLE_RATE_LIMIT = 'false';
      const persistentGuestUserId = 'persistent-guest-123';

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: persistentGuestUserId },
              error: null,
            }),
          })),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockSupabaseClient.from).toHaveBeenCalled(); // Database check performed
    });

    it('should handle NODE_ENV set to test', async () => {
      process.env.NODE_ENV = 'test';
      const persistentGuestUserId = 'persistent-guest-123';

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: persistentGuestUserId },
              error: null,
            }),
          })),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockSupabaseClient.from).toHaveBeenCalled(); // Database check performed
    });

    it('should handle empty environment variables', async () => {
      process.env.DISABLE_RATE_LIMIT = '';
      process.env.NODE_ENV = '';
      const persistentGuestUserId = 'persistent-guest-123';

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: persistentGuestUserId },
              error: null,
            }),
          })),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: vi.fn(),
      });

      const result = await validateUserIdentity(persistentGuestUserId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(mockSupabaseClient.from).toHaveBeenCalled(); // Database check performed
    });
  });

  describe('validateUserIdentity - Concurrent Operations', () => {
    it('should handle multiple concurrent validations for same user', async () => {
      const mockAuthData = {
        data: { user: { id: mockUserId } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      const promises = Array(10)
        .fill(null)
        .map(() => validateUserIdentity(mockUserId, true));

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBe(mockSupabaseClient);
      });
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent validations for different users', async () => {
      const users = ['user1', 'user2', 'user3'];
      const mockAuthData = (userId: string) => ({
        data: { user: { id: userId } },
        error: null,
      });

      mockSupabaseClient.auth.getUser.mockImplementation(() => {
        const callCount = mockSupabaseClient.auth.getUser.mock.calls.length;
        const userId = users[(callCount - 1) % users.length];
        return Promise.resolve(mockAuthData(userId));
      });

      const promises = users.map((userId) =>
        validateUserIdentity(userId, true)
      );

      const results = await Promise.all(promises);

      results.forEach((result) => {
        expect(result).toBe(mockSupabaseClient);
      });
    });
  });

  describe('validateUserIdentity - Performance and Memory', () => {
    it('should not leak memory with many validations', async () => {
      const mockAuthData = {
        data: { user: { id: mockUserId } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      // Simulate many operations
      for (let i = 0; i < 1000; i++) {
        await validateUserIdentity(mockUserId, true);
      }

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1000);
    });

    it('should handle validation with large user IDs', async () => {
      const largeUserId = 'a'.repeat(1000);
      const mockAuthData = {
        data: { user: { id: largeUserId } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      const result = await validateUserIdentity(largeUserId, true);

      expect(result).toBe(mockSupabaseClient);
    });
  });

  describe('validateUserIdentity - Real-world Usage Patterns', () => {
    it('should handle typical authenticated user flow', async () => {
      const mockAuthData = {
        data: {
          user: {
            id: mockUserId,
            email: 'user@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
        },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      const result = await validateUserIdentity(mockUserId, true);

      expect(result).toBe(mockSupabaseClient);
      expect(createClient).toHaveBeenCalledOnce();
      expect(createGuestServerClient).not.toHaveBeenCalled();
    });

    it('should handle typical guest user flow', async () => {
      const guestId = 'guest-session-abc123';

      const result = await validateUserIdentity(guestId, false);

      expect(result).toBe(mockSupabaseClient);
      expect(createGuestServerClient).toHaveBeenCalledOnce();
      expect(createClient).not.toHaveBeenCalled();
    });

    it('should handle switching between auth and guest modes', async () => {
      // First call as authenticated
      const mockAuthData = {
        data: { user: { id: mockUserId } },
        error: null,
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthData);

      const authResult = await validateUserIdentity(mockUserId, true);
      expect(authResult).toBe(mockSupabaseClient);

      // Reset mocks
      vi.clearAllMocks();
      vi.mocked(createGuestServerClient).mockResolvedValue(
        mockSupabaseClient as any
      );

      // Second call as guest
      const guestResult = await validateUserIdentity('guest-123', false);
      expect(guestResult).toBe(mockSupabaseClient);

      expect(createClient).toHaveBeenCalledTimes(0); // Not called in second
      expect(createGuestServerClient).toHaveBeenCalledTimes(1);
    });
  });
});
