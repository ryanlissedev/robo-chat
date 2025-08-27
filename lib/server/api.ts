import { createClient } from '@/lib/supabase/server';
import { createGuestServerClient } from '@/lib/supabase/server-guest';
import { isSupabaseEnabled } from '../supabase/config';

/**
 * Validates the user's identity
 * @param userId - The ID of the user.
 * @param isAuthenticated - Whether the user is authenticated.
 * @returns The Supabase client.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean
) {
  if (!isSupabaseEnabled) {
    return null;
  }

  const supabase = isAuthenticated
    ? await createClient()
    : await createGuestServerClient();

  if (!supabase) {
    throw new Error('Failed to initialize Supabase client');
  }

  if (isAuthenticated) {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user?.id) {
      throw new Error('Unable to get authenticated user');
    }

    if (authData.user.id !== userId) {
      throw new Error('User ID does not match authenticated user');
    }
  } else {
    // For guest users, check if rate limiting is disabled or in development
    const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isRateLimitDisabled || isDevelopment) {
      // Skip database validation for guest users when rate limiting is disabled
      return supabase;
    }

    // For guest users with temporary IDs, skip database validation
    if (userId.startsWith('guest-') || userId.startsWith('temp-guest-')) {
      return supabase;
    }

    // Only validate database record for persistent guest users
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .eq('anonymous', true)
      .maybeSingle();

    if (userError || !userRecord) {
      // For guest users, create the record if it doesn't exist
      try {
        await supabase.from('users').insert({
          id: userId,
          email: `${userId}@anonymous.example`,
          anonymous: true,
          message_count: 0,
          premium: false,
          created_at: new Date().toISOString(),
        } as never);
      } catch {
        // If creation fails, still allow the request for guest users
        return supabase;
      }
    }
  }

  return supabase;
}
