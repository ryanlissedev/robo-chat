import { isSupabaseEnabled } from '@/lib/supabase/config';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  convertFromApiFormat,
  defaultPreferences,
} from '@/lib/user-preference-store/utils';
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

  const { data: userProfileData } = await (supabase as any)
    .from('users')
    .select('*, user_preferences(*)')
    .eq('id', user.id)
    .single();

  if ((userProfileData as any)?.anonymous) {
    return {
      id: (userProfileData as any).id,
      email: (userProfileData as any).email || 'guest@zola.chat',
      display_name: (userProfileData as any).display_name || 'Guest',
      profile_image: (userProfileData as any).profile_image || '',
      anonymous: true,
      preferences: defaultPreferences,
    } as UserProfile;
  }

  const formattedPreferences = (userProfileData as any)?.user_preferences
    ? convertFromApiFormat({
        layout: (userProfileData as any).user_preferences.layout ?? undefined,
        prompt_suggestions:
          (userProfileData as any).user_preferences.prompt_suggestions ??
          undefined,
        show_tool_invocations:
          (userProfileData as any).user_preferences.show_tool_invocations ??
          undefined,
        show_conversation_previews:
          (userProfileData as any).user_preferences
            .show_conversation_previews ?? undefined,
        multi_model_enabled:
          (userProfileData as any).user_preferences.multi_model_enabled ??
          undefined,
        hidden_models:
          (userProfileData as any).user_preferences.hidden_models ?? undefined,
      })
    : undefined;

  return {
    ...(userProfileData as any),
    profile_image: user.user_metadata?.avatar_url ?? '',
    display_name: user.user_metadata?.name ?? '',
    preferences: formattedPreferences ?? defaultPreferences,
  } as UserProfile;
}
