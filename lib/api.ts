import { APP_DOMAIN } from '@/lib/config';
import type { UserProfile } from '@/lib/user/types';
import { fetchClient } from './fetch';
import { API_ROUTE_CREATE_GUEST, API_ROUTE_UPDATE_CHAT_MODEL } from './routes';
import { createClient } from './supabase/client';

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
export async function signInWithGoogle(supabase: any) {
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
  if (user?.id) {
    return user.id;
  }

  const supabase = createClient();

  if (!supabase) {
    return null;
  }

  const existingGuestSessionUser = await supabase.auth.getUser();
  if (existingGuestSessionUser.data?.user?.is_anonymous) {
    const anonUserId = existingGuestSessionUser.data.user.id;

    const profileCreationAttempted = localStorage.getItem(
      `guestProfileAttempted_${anonUserId}`
    );

    if (!profileCreationAttempted) {
      try {
        await createGuestUser(anonUserId);
        localStorage.setItem(`guestProfileAttempted_${anonUserId}`, 'true');
      } catch {
        return null;
      }
    }
    return anonUserId;
  }

  try {
    const { data: anonAuthData, error: anonAuthError } =
      await supabase.auth.signInAnonymously();

    if (anonAuthError) {
      return null;
    }

    if (!anonAuthData?.user) {
      return null;
    }

    const guestIdFromAuth = anonAuthData.user.id;
    await createGuestUser(guestIdFromAuth);
    localStorage.setItem(`guestProfileAttempted_${guestIdFromAuth}`, 'true');
    return guestIdFromAuth;
  } catch {
    return null;
  }
};
