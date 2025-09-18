import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGuestServerClient } from '@/lib/supabase/server-guest';
import {
  isGuestUser,
  getGuestUserId,
  DEFAULT_GUEST_PREFERENCES,
  createGuestCookie,
  generateGuestUserId,
  isValidUUID
} from '@/lib/utils';

export interface AuthResult {
  isGuest: boolean;
  userId: string | null;
  supabase: any;
  user: any;
}

export interface GuestPreferences {
  layout: string;
  prompt_suggestions: boolean;
  show_tool_invocations: boolean;
  show_conversation_previews: boolean;
  multi_model_enabled: boolean;
  hidden_models: string[];
  favorite_models: string[];
}

/**
 * Authenticate user or handle guest access
 * Returns authentication result with proper Supabase client
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const isGuest = isGuestUser(request);

  if (isGuest) {
    const guestUserId = getGuestUserId(request);
    const supabase = await createGuestServerClient();

    return {
      isGuest: true,
      userId: guestUserId,
      supabase,
      user: guestUserId ? { id: guestUserId, anonymous: true } : null,
    };
  }

  // Regular authenticated user
  const supabase = await createClient();
  if (!supabase) {
    throw new Error('Database connection failed');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    return {
      isGuest: false,
      userId: user.id,
      supabase,
      user,
    };
  }

  // Fallback to guest session when no authenticated user is present
  const guestUserId = getGuestUserId(request) || generateGuestUserId();
  const guestSupabase = await createGuestServerClient();

  return {
    isGuest: true,
    userId: guestUserId,
    supabase: guestSupabase,
    user: { id: guestUserId, anonymous: true },
  };
}

/**
 * Get user preferences with guest fallback
 */
export async function getUserPreferences(
  request: NextRequest,
  authResult: AuthResult
): Promise<{ preferences: GuestPreferences; headers?: Record<string, string> }> {
  if (authResult.isGuest) {
    return getGuestPreferences(request, authResult.userId);
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Get authenticated user preferences
  const { data, error } = await authResult.supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', authResult.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error('Failed to fetch user preferences');
  }

  const preferences = data ? {
    layout: data.layout,
    prompt_suggestions: data.prompt_suggestions,
    show_tool_invocations: data.show_tool_invocations,
    show_conversation_previews: data.show_conversation_previews,
    multi_model_enabled: data.multi_model_enabled,
    hidden_models: data.hidden_models || [],
    favorite_models: [], // Will be fetched separately
  } : DEFAULT_GUEST_PREFERENCES;

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
    cookieHeader.split('; ').map(cookie => {
      const [name, value] = cookie.split('=');
      return [name, decodeURIComponent(value || '')];
    })
  );

  // Parse preferences from cookies or use defaults
  let preferences: GuestPreferences;
  try {
    const savedPrefs = cookies['guest-preferences'];
    preferences = savedPrefs ?
      { ...DEFAULT_GUEST_PREFERENCES, ...JSON.parse(savedPrefs) } :
      { ...DEFAULT_GUEST_PREFERENCES };
  } catch {
    preferences = { ...DEFAULT_GUEST_PREFERENCES };
  }

  // Generate guest ID if missing
  const finalGuestId = guestUserId || generateGuestUserId();

  const headers = {
    'Set-Cookie': [
      createGuestCookie('guest-user-id', finalGuestId),
      createGuestCookie('guest-preferences', JSON.stringify(preferences))
    ].join(', ')
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
      createGuestCookie('guest-preferences', JSON.stringify(updatedPreferences))
    ].join(', ')
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
): Promise<{ preferences: GuestPreferences; headers?: Record<string, string> }> {
  if (authResult.isGuest) {
    return updateGuestPreferences(request, updates);
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Update authenticated user preferences
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
    layout: data.layout,
    prompt_suggestions: data.prompt_suggestions,
    show_tool_invocations: data.show_tool_invocations,
    show_conversation_previews: data.show_conversation_previews,
    multi_model_enabled: data.multi_model_enabled,
    hidden_models: data.hidden_models || [],
    favorite_models: [], // Not stored in user_preferences table
  };

  return { preferences };
}

/**
 * Get user favorite models with guest fallback
 */
export async function getUserFavoriteModels(
  request: NextRequest,
  authResult: AuthResult
): Promise<{ favoriteModels: string[]; headers?: Record<string, string> }> {
  if (authResult.isGuest) {
    const { preferences, headers } = getGuestPreferences(request, authResult.userId);
    return { favoriteModels: preferences.favorite_models, headers };
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Get authenticated user's favorite models
  const { data, error } = await authResult.supabase
    .from('users')
    .select('favorite_models')
    .eq('id', authResult.user.id)
    .single();

  if (error) {
    throw new Error('Failed to fetch favorite models');
  }

  return { favoriteModels: data.favorite_models || ['gpt-5-mini'] };
}

/**
 * Update user favorite models with guest fallback
 */
export async function updateUserFavoriteModels(
  request: NextRequest,
  authResult: AuthResult,
  favoriteModels: string[]
): Promise<{ favoriteModels: string[]; headers?: Record<string, string> }> {
  if (authResult.isGuest) {
    const { preferences, headers } = updateGuestPreferences(request, {
      favorite_models: favoriteModels
    });
    return { favoriteModels: preferences.favorite_models, headers };
  }

  if (!authResult.user) {
    throw new Error('Unauthorized');
  }

  // Update authenticated user's favorite models
  const { data, error } = await authResult.supabase
    .from('users')
    .update({ favorite_models: favoriteModels } as never)
    .eq('id', authResult.user.id)
    .select('favorite_models')
    .single();

  if (error) {
    throw new Error('Failed to update favorite models');
  }

  return { favoriteModels: data.favorite_models };
}

/**
 * Create error response for unauthorized access
 */
export function createUnauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create error response with proper headers for guests
 */
export function createErrorResponse(
  error: string,
  status = 500,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json({ error }, { status });

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}
