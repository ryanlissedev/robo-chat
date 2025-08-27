import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSupabaseUser, getUserProfile } from '@/lib/user/api';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { defaultPreferences } from '@/lib/user-preference-store/utils';

// Mock dependencies
const mockIsSupabaseEnabled = { value: true };
vi.mock('@/lib/supabase/config', () => ({
  get isSupabaseEnabled() {
    return mockIsSupabaseEnabled.value;
  },
}));

const mockDefaultPreferences = { value: {
  layout: 'default',
  prompt_suggestions: true,
  show_tool_invocations: true,
  show_conversation_previews: true,
  multi_model_enabled: false,
  hidden_models: [],
}};
vi.mock('@/lib/user-preference-store/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/user-preference-store/utils')>();
  return {
    ...actual,
    get defaultPreferences() {
      return mockDefaultPreferences.value;
    },
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
const mockCreateClient = vi.mocked(createClient);

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        maybeSingle: vi.fn(),
      })),
    })),
  })),
};

describe('User API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseEnabled.value = true;
    mockDefaultPreferences.value = {
      layout: 'default',
      prompt_suggestions: true,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: false,
      hidden_models: [],
    };
  });

  describe('getSupabaseUser', () => {
    it('should return user and supabase client when user is authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await getSupabaseUser();

      expect(result).toEqual({
        supabase: mockSupabaseClient,
        user: mockUser,
      });
      expect(mockCreateClient).toHaveBeenCalled();
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('should return null user when not authenticated', async () => {
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getSupabaseUser();

      expect(result).toEqual({
        supabase: mockSupabaseClient,
        user: null,
      });
    });

    it('should return null supabase and user when client creation fails', async () => {
      mockCreateClient.mockResolvedValue(null);

      const result = await getSupabaseUser();

      expect(result).toEqual({
        supabase: null,
        user: null,
      });
    });

    it('should handle auth.getUser errors gracefully', async () => {
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Authentication failed', code: 'auth_error' } as any,
      });

      const result = await getSupabaseUser();

      expect(result).toEqual({
        supabase: mockSupabaseClient,
        user: null,
      });
    });

    it('should handle network failures in auth.getUser', async () => {
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      await expect(getSupabaseUser()).rejects.toThrow('Network error');
    });
  });

  describe('getUserProfile', () => {
    describe('Supabase Disabled', () => {
      beforeEach(() => {
        mockIsSupabaseEnabled.value = false;
      });

      it('should return fake guest profile when Supabase is disabled', async () => {
        const result = await getUserProfile();

        expect(result).toEqual({
          id: 'guest',
          email: 'guest@zola.chat',
          display_name: 'Guest',
          profile_image: '',
          anonymous: true,
          preferences: defaultPreferences,
        });
      });
    });

    describe('Supabase Enabled', () => {
      it('should return guest profile when no authenticated user', async () => {
        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const result = await getUserProfile();

        expect(result).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^guest-\d+$/),
            email: 'guest@zola.chat',
            display_name: 'Guest',
            profile_image: '',
            anonymous: true,
            preferences: defaultPreferences,
          })
        );
      });

      it('should return guest profile when Supabase client is null', async () => {
        mockCreateClient.mockResolvedValue(null);

        const result = await getUserProfile();

        expect(result).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^guest-\d+$/),
            email: 'guest@zola.chat',
            display_name: 'Guest',
            profile_image: '',
            anonymous: true,
            preferences: defaultPreferences,
          })
        );
      });

      it('should return full user profile for authenticated user', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.jpg',
          },
        };

        const mockUserProfileData = {
          id: 'user-123',
          email: 'test@example.com',
          display_name: 'Test User',
          profile_image: 'https://example.com/profile.jpg',
          anonymous: false,
          user_preferences: {
            layout: 'sidebar',
            prompt_suggestions: false,
            show_tool_invocations: false,
            show_conversation_previews: false,
            multi_model_enabled: true,
            hidden_models: ['gpt-3.5'],
          },
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUserProfileData,
              error: null,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        expect(result).toEqual({
          ...mockUserProfileData,
          profile_image: 'https://example.com/avatar.jpg',
          display_name: 'Test User',
          preferences: {
            layout: 'sidebar',
            promptSuggestions: false,
            showToolInvocations: false,
            showConversationPreviews: false,
            multiModelEnabled: true,
            hiddenModels: ['gpt-3.5'],
          },
        });

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
        expect(mockSelect).toHaveBeenCalledWith('*, user_preferences(*)');
      });

      it('should return anonymous user profile for anonymous users', async () => {
        const mockUser = {
          id: 'anon-123',
          email: 'anon@example.com',
          user_metadata: {},
        };

        const mockUserProfileData = {
          id: 'anon-123',
          email: 'anon@example.com',
          display_name: 'Anonymous User',
          profile_image: '',
          anonymous: true,
          user_preferences: null,
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUserProfileData,
              error: null,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        expect(result).toEqual({
          id: 'anon-123',
          email: 'anon@example.com',
          display_name: 'Anonymous User',
          profile_image: '',
          anonymous: true,
          preferences: defaultPreferences,
        });
      });

      it('should handle missing user_metadata gracefully', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: null,
        };

        const mockUserProfileData = {
          id: 'user-123',
          email: 'test@example.com',
          display_name: null,
          profile_image: null,
          anonymous: false,
          user_preferences: null,
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUserProfileData,
              error: null,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        expect(result).toEqual({
          ...mockUserProfileData,
          profile_image: '',
          display_name: '',
          preferences: defaultPreferences,
        });
      });

      it('should handle partial user preferences', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        };

        const mockUserProfileData = {
          id: 'user-123',
          email: 'test@example.com',
          anonymous: false,
          user_preferences: {
            layout: 'sidebar',
            prompt_suggestions: null,
            show_tool_invocations: undefined,
            show_conversation_previews: false,
            multi_model_enabled: null,
            hidden_models: null,
          },
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUserProfileData,
              error: null,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        expect(result?.preferences).toEqual({
          layout: 'sidebar',
          promptSuggestions: true,
          showToolInvocations: true,
          showConversationPreviews: false,
          multiModelEnabled: false,
          hiddenModels: [],
        });
      });

      it('should handle database query errors', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found', code: 'not_found' } as any,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        // Should return user with default preferences when DB query fails
        expect(result).toEqual({
          display_name: 'Test User',
          profile_image: '',
          preferences: {
            hidden_models: [],
            layout: 'default',
            multi_model_enabled: false,
            prompt_suggestions: true,
            show_conversation_previews: true,
            show_tool_invocations: true,
          },
        });
      });

      it('should handle network errors in database queries', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: { name: 'Test User' },
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockRejectedValue(new Error('Network error')),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        await expect(getUserProfile()).rejects.toThrow('Network error');
      });

      it('should use fallback values for missing profile data', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {},
        };

        const mockUserProfileData = {
          id: 'user-123',
          email: 'test@example.com',
          display_name: null,
          profile_image: null,
          anonymous: false,
          user_preferences: null,
        };

        mockCreateClient.mockResolvedValue(mockSupabaseClient);
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const mockSelect = vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: mockUserProfileData,
              error: null,
            }),
          })),
        }));
        mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

        const result = await getUserProfile();

        expect(result).toEqual({
          ...mockUserProfileData,
          profile_image: '',
          display_name: '',
          preferences: defaultPreferences,
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent getSupabaseUser calls', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Make concurrent calls
      const promises = Array(10).fill(null).map(() => getSupabaseUser());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toEqual({
          supabase: mockSupabaseClient,
          user: mockUser,
        });
      });
    });

    it('should handle concurrent getUserProfile calls', async () => {
      mockIsSupabaseEnabled.value = false;

      // Make concurrent calls
      const promises = Array(5).fill(null).map(() => getUserProfile());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual({
          id: 'guest',
          email: 'guest@zola.chat',
          display_name: 'Guest',
          profile_image: '',
          anonymous: true,
          preferences: defaultPreferences,
        });
      });
    });

    it('should handle malformed user metadata', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          name: null,
          avatar_url: undefined,
          extra_field: 'should be ignored',
        },
      };

      const mockUserProfileData = {
        id: 'user-123',
        email: 'test@example.com',
        anonymous: false,
        user_preferences: null,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfileData,
            error: null,
          }),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await getUserProfile();

      expect(result?.profile_image).toBe('');
      expect(result?.display_name).toBe('');
    });

    it('should handle very large user preferences objects', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { name: 'Test User' },
      };

      const largeHiddenModels = Array(1000).fill(null).map((_, i) => `model-${i}`);

      const mockUserProfileData = {
        id: 'user-123',
        email: 'test@example.com',
        anonymous: false,
        user_preferences: {
          layout: 'sidebar',
          prompt_suggestions: true,
          show_tool_invocations: true,
          show_conversation_previews: true,
          multi_model_enabled: true,
          hidden_models: largeHiddenModels,
        },
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfileData,
            error: null,
          }),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await getUserProfile();

      expect(result?.preferences?.hiddenModels).toHaveLength(1000);
      expect(result?.preferences?.hiddenModels?.[0]).toBe('model-0');
      expect(result?.preferences?.hiddenModels?.[999]).toBe('model-999');
    });

    it('should handle empty string values in user data', async () => {
      const mockUser = {
        id: 'user-123',
        email: '',
        user_metadata: {
          name: '',
          avatar_url: '',
        },
      };

      const mockUserProfileData = {
        id: 'user-123',
        email: '',
        display_name: '',
        profile_image: '',
        anonymous: false,
        user_preferences: null,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfileData,
            error: null,
          }),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await getUserProfile();

      expect(result).toEqual({
        ...mockUserProfileData,
        profile_image: '',
        display_name: '',
        preferences: defaultPreferences,
      });
    });

    it('should handle guest profile timestamp uniqueness', async () => {
      mockIsSupabaseEnabled.value = true;
      mockCreateClient.mockResolvedValue(null);

      const profile1 = await getUserProfile();
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const profile2 = await getUserProfile();

      expect(profile1?.id).not.toEqual(profile2?.id);
      expect(profile1?.id).toMatch(/^guest-\d+$/);
      expect(profile2?.id).toMatch(/^guest-\d+$/);
    });

    it('should handle anonymous user with missing email', async () => {
      const mockUser = {
        id: 'anon-123',
        email: null,
        user_metadata: {},
      };

      const mockUserProfileData = {
        id: 'anon-123',
        email: null,
        display_name: null,
        profile_image: null,
        anonymous: true,
        user_preferences: null,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: mockUserProfileData,
            error: null,
          }),
        })),
      }));
      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });

      const result = await getUserProfile();

      expect(result).toEqual({
        id: 'anon-123',
        email: 'guest@zola.chat', // Fallback email
        display_name: 'Guest', // Fallback display name
        profile_image: '',
        anonymous: true,
        preferences: defaultPreferences,
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with repeated getUserProfile calls', async () => {
      mockIsSupabaseEnabled.value = false;

      // Create many profiles to test for memory leaks
      const profiles = await Promise.all(
        Array(100).fill(null).map(() => getUserProfile())
      );

      expect(profiles).toHaveLength(100);
      
      // All should be the same guest profile structure
      profiles.forEach(profile => {
        expect(profile).toEqual({
          id: 'guest',
          email: 'guest@zola.chat',
          display_name: 'Guest',
          profile_image: '',
          anonymous: true,
          preferences: defaultPreferences,
        });
      });
    });

    it('should handle rapid successive calls efficiently', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const startTime = Date.now();
      
      // Make rapid calls
      const promises = Array(50).fill(null).map(() => getSupabaseUser());
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (less than 1 second)
      expect(duration).toBeLessThan(1000);
      expect(mockCreateClient).toHaveBeenCalledTimes(50);
    });
  });
});