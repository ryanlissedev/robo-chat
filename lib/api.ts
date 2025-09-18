import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_DOMAIN } from '@/lib/config';
import type { UserProfile } from '@/lib/user/types';
import { fetchClient } from './fetch';
import { API_ROUTE_CREATE_GUEST, API_ROUTE_UPDATE_CHAT_MODEL } from './routes';
import { createClient } from './supabase/client';
import { generateGuestUserId, isValidUUID } from './utils';

/**
 * Creates a guest user record on the server
 */
export async function createGuestUser(guestId: string) {
  const res = await fetchClient(API_ROUTE_CREATE_GUEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: guestId }),
  });
  const responseData = await res.json();
  if (!res.ok) {
    throw new Error(
      responseData.error ||
        `Failed to create guest user: ${res.status} ${res.statusText}`
    );
  }

  return responseData;
}

export class UsageLimitError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.code = 'DAILY_LIMIT_REACHED';
  }
}

/**
 * Checks the user's daily usage and increments both overall and daily counters.
 * Resets the daily counter if a new day (UTC) is detected.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 *
 * @param supabase - Your Supabase client.
 * @param userId - The ID of the user.
 * @returns The remaining daily limit.
 */
export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  const res = await fetchClient(
    `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  const responseData = await res.json();
  if (!res.ok) {
    throw new Error(
      responseData.error ||
        `Failed to check rate limits: ${res.status} ${res.statusText}`
    );
  }
  return responseData;
}

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, model }),
  });
  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(
      responseData.error ||
        `Failed to update chat model: ${res.status} ${res.statusText}`
    );
  }

  return responseData;
}

/**
 * Signs in user with Google OAuth via Supabase
 */
// Use `any` here to avoid type incompatibilities between different SupabaseClient generic signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function signInWithGoogle(supabase: SupabaseClient) {
  const isDev = process.env.NODE_ENV === 'development';

  // Get base URL dynamically (will work in both browser and server environments)
  const baseUrl = isDev
    ? 'http://localhost:3000'
    : typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_VERCEL_URL
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : APP_DOMAIN;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }

  // Return the provider URL
  return data;
}

export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  // STRATEGY 1: If user already has a valid ID, use it immediately
  if (user?.id && isValidUUID(user.id)) {
    console.log('[GuestUser] Using existing user ID:', user.id);
    return user.id;
  }

  console.log('[GuestUser] No valid user ID found, attempting guest user creation...');

  // STRATEGY 2: Check if we're in guest mode (browser-only)
  const isInGuestMode = typeof window !== 'undefined' &&
    (document.cookie.includes('guest-user-id=') ||
     window.location.pathname.includes('/guest') ||
     !user?.id || // No authenticated user
     user?.anonymous === true); // User object indicates guest

  if (isInGuestMode) {
    console.log('[GuestUser] Operating in guest mode, skipping Supabase operations');

    // For guest mode, directly use localStorage-based ID
    const guestId = getLocalStorageGuestId();

    // Try to create guest profile on server (non-blocking)
    try {
      await createGuestUserWithRetry(guestId);
      console.log('[GuestUser] Guest profile created successfully');
    } catch (profileError) {
      console.warn('[GuestUser] Guest profile creation failed, but continuing:', profileError);
    }

    return guestId;
  }

  // STRATEGY 3: For authenticated users or server-side, try Supabase
  const supabase = createClient();

  // STRATEGY 4: If Supabase is not available, fallback to localStorage UUID
  if (!supabase) {
    console.warn('[GuestUser] Supabase not available, using localStorage fallback');
    return getLocalStorageGuestId();
  }

  try {
    // STRATEGY 5: Check for existing anonymous session (only for authenticated flow)
    console.log('[GuestUser] Checking for existing anonymous session...');
    const existingSession = await supabase.auth.getUser();

    if (existingSession.data?.user?.is_anonymous) {
      const anonUserId = existingSession.data.user.id;
      console.log('[GuestUser] Found existing anonymous user:', anonUserId);

      // Try to create guest profile for this anonymous user
      try {
        await createGuestUserWithRetry(anonUserId);
        return anonUserId;
      } catch (profileError) {
        console.warn('[GuestUser] Failed to create guest profile, but using anonymous ID:', profileError);
        return anonUserId; // Still use the anonymous ID even if profile creation fails
      }
    }

    // STRATEGY 6: If we reach here and anonymous sign-ins are disabled, fallback to localStorage
    console.log('[GuestUser] No existing anonymous session, but anonymous sign-ins may be disabled');
    console.log('[GuestUser] Falling back to localStorage guest ID');
    return getLocalStorageGuestId();

  } catch (error) {
    console.error('[GuestUser] Supabase operations failed:', error);

    // STRATEGY 7: Final fallback to localStorage
    console.log('[GuestUser] Falling back to localStorage guest ID');
    return getLocalStorageGuestId();
  }
};

/**
 * Get or create a guest user ID using localStorage as fallback
 */
function getLocalStorageGuestId(): string {
  if (typeof localStorage === 'undefined') {
    console.warn('[GuestUser] localStorage not available, generating new UUID');
    return generateGuestUserId();
  }

  const STORAGE_KEY = 'guest-user-id';
  let guestId = localStorage.getItem(STORAGE_KEY);

  if (guestId && isValidUUID(guestId)) {
    console.log('[GuestUser] Using existing localStorage guest ID:', guestId);
    return guestId;
  }

  // Generate new guest ID and store it
  guestId = generateGuestUserId();
  try {
    localStorage.setItem(STORAGE_KEY, guestId);
    console.log('[GuestUser] Created new localStorage guest ID:', guestId);
  } catch (error) {
    console.warn('[GuestUser] Failed to store guest ID in localStorage:', error);
  }

  return guestId;
}

/**
 * Create guest user with retry logic
 */
async function createGuestUserWithRetry(guestId: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GuestUser] Creating guest user profile (attempt ${attempt}/${maxRetries})`);
      await createGuestUser(guestId);
      console.log('[GuestUser] Guest user profile created successfully');
      return;
    } catch (error) {
      console.warn(`[GuestUser] Guest user creation failed (attempt ${attempt}/${maxRetries}):`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
