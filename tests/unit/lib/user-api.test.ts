import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseUser, getUserProfile } from '@/lib/user/server-api';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
  isDevelopmentMode: vi.fn(() => false),
  isRealtimeEnabled: vi.fn(() => false),
}));

import { createClient } from '@/lib/supabase/server';
import { isSupabaseEnabled } from '@/lib/supabase/config';

// Get the mocked version for use in tests
const mockIsSupabaseEnabled = vi.mocked(isSupabaseEnabled);

describe('User API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsSupabaseEnabled.mockReturnValue(true);
  });

  describe('getSupabaseUser', () => {
    it('should return user and supabase client when user is authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabaseClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      };
      vi.mocked(createClient).mockReturnValue(mockSupabaseClient as any);

      const { supabase, user } = await getSupabaseUser();

      expect(user).toEqual(mockUser);
      expect(supabase).toEqual(mockSupabaseClient);
    });

    it('should return null user when not authenticated', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockReturnValue(mockSupabaseClient as any);

      const { supabase, user } = await getSupabaseUser();

      expect(user).toBeNull();
      expect(supabase).toEqual(mockSupabaseClient);
    });
  });

  describe('getUserProfile', () => {
    it('should return guest profile when supabase is disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);
      
      const profile = await getUserProfile();
      
      expect(profile).toEqual({
        id: 'guest',
        email: 'guest@zola.chat',
        display_name: 'Guest',
        profile_image: '',
        anonymous: true,
        preferences: {
          layout: 'fullscreen',
          promptSuggestions: true,
          showToolInvocations: true,
          showConversationPreviews: true,
          multiModelEnabled: false,
          hiddenModels: [],
        },
      });
    });

    it('should return guest profile when user is not authenticated', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: null }, error: null }),
        },
      };
      vi.mocked(createClient).mockReturnValue(mockSupabaseClient as any);

      const profile = await getUserProfile();
      expect(profile.anonymous).toBe(true);
      expect(profile.display_name).toBe('Guest');
    });

    it('should return user profile when user is authenticated', async () => {
      // Ensure Supabase is enabled for this test
      mockIsSupabaseEnabled.mockReturnValue(true);
      
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.jpg'
        },
      };
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User Profile',
        anonymous: false,
        user_preferences: null,
      };
      const mockSupabaseClient = {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      };
      vi.mocked(createClient).mockReturnValue(mockSupabaseClient as any);

      const profile = await getUserProfile();

      expect(profile).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        display_name: 'Test User', // From user_metadata.name
        profile_image: 'https://example.com/avatar.jpg', // From user_metadata.avatar_url
        anonymous: false,
        user_preferences: null, // This property gets spread from the database result
        preferences: {
          layout: 'fullscreen',
          promptSuggestions: true,
          showToolInvocations: true,
          showConversationPreviews: true,
          multiModelEnabled: false,
          hiddenModels: [],
        },
      });
    });
  });
});
