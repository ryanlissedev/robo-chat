import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types';
import { createClient } from '@/lib/supabase/server';
import { createGuestServerClient } from '@/lib/supabase/server-guest';
import { isSupabaseEnabled } from '../supabase/config';
import { GuestAuthService } from '@/lib/guest-auth';
import { isValidUUID } from '@/lib/utils';

/**
 * Validates the user's identity
 * @param userId - The ID of the user.
 * @param isAuthenticated - Whether the user is authenticated.
 * @param request - Optional request object to check for guest headers.
 * @returns The Supabase client.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean,
  request?: Request
): Promise<SupabaseClient<Database> | null> {
  if (!isSupabaseEnabled()) {
    return null;
  }

  // Check if this is a guest user request via headers
  const isGuestRequest = request ? isGuestUserRequest(request) : false;
  const guestUserId = request ? getGuestUserIdFromRequest(request) : null;

  // For guest requests, validate the guest user ID
  if (isGuestRequest && guestUserId) {
    if (!isValidUUID(guestUserId)) {
      throw new Error('Invalid guest user ID format');
    }
    // Use the guest user ID from headers if provided
    userId = guestUserId;
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
      return supabase as unknown as SupabaseClient<Database>;
    }

    // For guest users with temporary IDs, skip database validation
    if (userId.startsWith('guest-') || userId.startsWith('temp-guest-') || isGuestRequest) {
      return supabase as unknown as SupabaseClient<Database>;
    }

    // Only validate database record for persistent guest users with valid UUIDs
    if (isValidUUID(userId)) {
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
          return supabase as unknown as SupabaseClient<Database>;
        }
      }
    }
  }

  return supabase as unknown as SupabaseClient<Database>;
}

/**
 * Check if a request is from a guest user based on headers
 */
function isGuestUserRequest(request: Request): boolean {
  const guestValidation = GuestAuthService.validateGuestFromHeaders(request.headers);
  return guestValidation !== null;
}

/**
 * Extract guest user ID from request headers
 */
function getGuestUserIdFromRequest(request: Request): string | null {
  const guestValidation = GuestAuthService.validateGuestFromHeaders(request.headers);
  return guestValidation?.userId || null;
}
