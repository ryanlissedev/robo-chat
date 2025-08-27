import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseUser, getUserProfile } from '@/lib/user/server-api';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: true,
}));

import { createClient } from '@/lib/supabase/server';

describe('User API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
      vi.mocked(require('@/lib/supabase/config')).isSupabaseEnabled = false;
      const profile = await getUserProfile();
      expect(profile.anonymous).toBe(true);
      expect(profile.display_name).toBe('Guest');
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
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {},
      };
      const mockProfile = {
        id: 'user-123',
        display_name: 'Test User',
        anonymous: false,
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

      expect(profile).toEqual(expect.objectContaining(mockProfile));
    });
  });
});
