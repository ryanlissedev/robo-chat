import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGuestServerClient } from '@/lib/supabase/server-guest';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types';
import {
  isGuestUser,
  getGuestUserId,
  DEFAULT_GUEST_PREFERENCES,
  createGuestCookie,
  generateGuestUserId,
} from '@/lib/utils';
import { rateLimit, type RateLimitEndpoint } from '@/lib/middleware/rate-limit';
import {
  sanitizeInput,
  validateOrigin,
  securityHeaders,
} from '@/lib/security/middleware';

export interface AuthResult {
  isGuest: boolean;
  userId: string | null;
  supabase: SupabaseClient<Database> | null;
  user: User | { id: string; anonymous: true } | null;
}

export interface GuestPreferences {
  layout: string;
  prompt_suggestions: boolean;
  show_tool_invocations: boolean;
  show_conversation_previews: boolean;
  multi_model_enabled: boolean;
  hidden_models: readonly string[];
  favorite_models: readonly string[];
}

/**
 * Enhanced authentication with security checks
 * Returns authentication result with proper Supabase client
 */
export async function authenticateRequest(
  request: NextRequest,
  options: {
    requireAuth?: boolean;
    rateLimit?: RateLimitEndpoint;
    validateOrigin?: boolean;
  } = {}
): Promise<AuthResult> {
  // Security checks
  if (options.validateOrigin && !validateOrigin(request)) {
    throw new Error('Invalid origin');
  }

  // Rate limiting check
  if (options.rateLimit) {
    const rateLimitResponse = await rateLimit(request, options.rateLimit);
    if (rateLimitResponse) {
      throw new Error('Rate limit exceeded');
    }
  }

  // Database connection check
  const supabase = await createClient();
  if (!supabase) {
    throw new Error('Database connection failed');
  }

  const isGuest = isGuestUser(request);

  if (isGuest) {
    const guestUserId = getGuestUserId(request);
    const guestSupabase = await createGuestServerClient();

    return {
      isGuest: true,
      userId: guestUserId,
      supabase: guestSupabase || supabase, // Fallback to main client if guest client fails
      user: guestUserId ? { id: guestUserId, anonymous: true } : null,
    };
  }

  // Regular authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // Handle authentication errors
  if (authError) {
    // Log auth error for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.error('Authentication error:', authError);
    }
    throw new Error('Unauthorized');
  }

  if (user?.id) {
    return {
      isGuest: false,
      userId: user.id,
      supabase,
      user,
    };
  }

  // If auth is required and no user found, throw error
  if (options.requireAuth) {
    throw new Error('Authentication required');
  }

  // Return a guest user result when no authenticated user is found
  // The middleware will decide whether to allow this based on allowGuests option
  const guestUserId = generateGuestUserId();
  const guestSupabase = await createGuestServerClient();

  return {
    isGuest: true,
    userId: guestUserId,
    supabase: guestSupabase || supabase, // Fallback to main client if guest client fails
    user: { id: guestUserId, anonymous: true },
  };
}

/**
 * Get user preferences with guest fallback
 */
export async function getUserPreferences(
  request: NextRequest,
  authResult: AuthResult
): Promise<{
  preferences: GuestPreferences;
  headers?: Record<string, string>;
}> {
  if (authResult.isGuest) {
    return getGuestPreferences(request, authResult.userId);
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Get authenticated user preferences
  if (!authResult.supabase) {
    throw new Error('Database not available');
  }

  const { data, error } = await authResult.supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', authResult.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error('Failed to fetch user preferences');
  }

  const preferences: GuestPreferences = data
    ? {
        layout: data.layout || 'fullscreen',
        prompt_suggestions: data.prompt_suggestions ?? true,
        show_tool_invocations: data.show_tool_invocations ?? true,
        show_conversation_previews: data.show_conversation_previews ?? true,
        multi_model_enabled: data.multi_model_enabled ?? false,
        hidden_models: (data.hidden_models || []) as readonly string[],
        favorite_models: [] as readonly string[], // Will be fetched separately
      }
    : DEFAULT_GUEST_PREFERENCES;

  return { preferences };
}

/**
 * Get guest user preferences from cookies with defaults
 */
export function getGuestPreferences(
  request: NextRequest,
  guestUserId: string | null
): { preferences: GuestPreferences; headers?: Record<string, string> } {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader
      .split('; ')
      .filter(Boolean)
      .map((cookie) => {
        const [name, value] = cookie.split('=');
        return [name, decodeURIComponent(value || '')];
      })
  );

  // Parse preferences from cookies or use defaults
  let preferences: GuestPreferences;
  try {
    const savedPrefs = cookies['guest-preferences'];
    preferences = savedPrefs
      ? { ...DEFAULT_GUEST_PREFERENCES, ...JSON.parse(savedPrefs) }
      : { ...DEFAULT_GUEST_PREFERENCES };
  } catch {
    preferences = { ...DEFAULT_GUEST_PREFERENCES };
  }

  // Generate guest ID if missing
  const finalGuestId = guestUserId || generateGuestUserId();

  const headers = {
    'Set-Cookie': [
      createGuestCookie('guest-user-id', finalGuestId),
      createGuestCookie('guest-preferences', JSON.stringify(preferences)),
    ].join(', '),
  };

  return { preferences, headers };
}

/**
 * Update guest user preferences in cookies
 */
export function updateGuestPreferences(
  request: NextRequest,
  updates: Partial<GuestPreferences>
): { preferences: GuestPreferences; headers: Record<string, string> } {
  const { preferences: currentPrefs } = getGuestPreferences(request, null);
  const updatedPreferences = { ...currentPrefs, ...updates };

  const guestUserId = getGuestUserId(request) || generateGuestUserId();

  const headers = {
    'Set-Cookie': [
      createGuestCookie('guest-user-id', guestUserId),
      createGuestCookie(
        'guest-preferences',
        JSON.stringify(updatedPreferences)
      ),
    ].join(', '),
  };

  return { preferences: updatedPreferences, headers };
}

/**
 * Update user preferences with guest fallback
 */
export async function updateUserPreferences(
  request: NextRequest,
  authResult: AuthResult,
  updates: Partial<GuestPreferences>
): Promise<{
  preferences: GuestPreferences;
  headers?: Record<string, string>;
}> {
  if (authResult.isGuest) {
    return updateGuestPreferences(request, updates);
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Update authenticated user preferences
  if (!authResult.supabase) {
    throw new Error('Database not available');
  }

  const { data, error } = await authResult.supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: authResult.user.id,
        ...updates,
      } as never,
      {
        onConflict: 'user_id',
      }
    )
    .select('*')
    .single();

  if (error) {
    throw new Error('Failed to update user preferences');
  }

  const preferences: GuestPreferences = {
    layout: data.layout || 'fullscreen',
    prompt_suggestions: data.prompt_suggestions ?? true,
    show_tool_invocations: data.show_tool_invocations ?? true,
    show_conversation_previews: data.show_conversation_previews ?? true,
    multi_model_enabled: data.multi_model_enabled ?? false,
    hidden_models: (data.hidden_models || []) as readonly string[],
    favorite_models: [] as readonly string[], // Not stored in user_preferences table
  };

  return { preferences };
}

/**
 * Get user favorite models with guest fallback
 */
export async function getUserFavoriteModels(
  request: NextRequest,
  authResult: AuthResult
): Promise<{
  favoriteModels: readonly string[];
  headers?: Record<string, string>;
}> {
  if (authResult.isGuest) {
    const { preferences, headers } = getGuestPreferences(
      request,
      authResult.userId
    );
    return {
      favoriteModels: preferences.favorite_models as readonly string[],
      headers,
    };
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Get authenticated user's favorite models
  if (!authResult.supabase) {
    throw new Error('Database not available');
  }

  const { data, error } = await authResult.supabase
    .from('users')
    .select('favorite_models')
    .eq('id', authResult.user.id)
    .single();

  if (error) {
    throw new Error('Failed to fetch favorite models');
  }

  return {
    favoriteModels: (data.favorite_models || [
      'gpt-5-mini',
    ]) as readonly string[],
  };
}

/**
 * Update user favorite models with guest fallback
 */
export async function updateUserFavoriteModels(
  request: NextRequest,
  authResult: AuthResult,
  favoriteModels: readonly string[]
): Promise<{
  favoriteModels: readonly string[];
  headers?: Record<string, string>;
}> {
  if (authResult.isGuest) {
    const { preferences, headers } = updateGuestPreferences(request, {
      favorite_models: favoriteModels,
    });
    return { favoriteModels: preferences.favorite_models, headers };
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Update authenticated user's favorite models
  if (!authResult.supabase) {
    throw new Error('Database not available');
  }

  const { data, error } = await authResult.supabase
    .from('users')
    .update({ favorite_models: favoriteModels } as never)
    .eq('id', authResult.user.id)
    .select('favorite_models')
    .single();

  if (error) {
    throw new Error('Failed to update favorite models');
  }

  return { favoriteModels: data.favorite_models as readonly string[] };
}

/**
 * Create enhanced unauthorized response with security headers
 */
export function createUnauthorizedResponse(
  message = 'Unauthorized',
  headers?: Record<string, string>
): NextResponse {
  return createErrorResponse(message, 401, headers);
}

/**
 * Create error response with proper headers and security
 */
export function createErrorResponse(
  error: string,
  status = 500,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      error: String(sanitizeInput(error)),
      timestamp: new Date().toISOString(),
      status,
    },
    { status }
  );

  // Apply security headers
  const secureResponse = securityHeaders(response);

  // Apply custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      secureResponse.headers.set(key, value);
    });
  }

  return secureResponse;
}
