import { createClient as createServerClient } from '@/lib/supabase/server';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { convertFromApiFormat, defaultPreferences } from '@/lib/user-preference-store/utils';
import type { UserProfile } from './types';

export async function getSupabaseUser() {
  const supabase = await createServerClient();
  if (!supabase) {
    return { supabase: null, user: null } as const;
  }

  const { data } = await supabase.auth.getUser();
  return {
    supabase,
    user: data.user ?? null,
  } as const;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  if (!isSupabaseEnabled) {
    return {
      id: 'guest',
      email: 'guest@zola.chat',
      display_name: 'Guest',
      profile_image: '',
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile;
  }

  const { supabase, user } = await getSupabaseUser();
  if (!(supabase && user)) {
    return {
      id: `guest-${Date.now()}`,
      email: 'guest@zola.chat',
      display_name: 'Guest',
      profile_image: '',
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile;
  }

  const { data: userProfileData } = await supabase
    .from('users')
    .select('*, user_preferences(*)')
    .eq('id', user.id)
    .single();

  if (userProfileData?.anonymous) {
    return {
      id: userProfileData.id,
      email: userProfileData.email || 'guest@zola.chat',
      display_name: userProfileData.display_name || 'Guest',
      profile_image: userProfileData.profile_image || '',
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile;
  }

  const formattedPreferences = userProfileData?.user_preferences
    ? convertFromApiFormat({
        layout: userProfileData.user_preferences.layout ?? undefined,
        prompt_suggestions:
          userProfileData.user_preferences.prompt_suggestions ?? undefined,
        show_tool_invocations:
          userProfileData.user_preferences.show_tool_invocations ?? undefined,
        show_conversation_previews:
          userProfileData.user_preferences.show_conversation_previews ?? undefined,
        multi_model_enabled:
          userProfileData.user_preferences.multi_model_enabled ?? undefined,
        hidden_models:
          userProfileData.user_preferences.hidden_models ?? undefined,
      })
    : undefined;

  return {
    ...userProfileData,
    profile_image: user.user_metadata?.avatar_url ?? '',
    display_name: user.user_metadata?.name ?? '',
    preferences: formattedPreferences ?? defaultPreferences,
  } as UserProfile;
}
