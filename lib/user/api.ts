import { toast } from '@/components/ui/toast';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import {
  convertFromApiFormat,
  defaultPreferences,
} from '@/lib/user-preference-store/utils';
import type { UserProfile } from './types';

// Server-only APIs moved to lib/user/server-api.ts to avoid importing server-only
// modules (like next/headers) into client components. Keep this file client-safe.


export async function fetchUserProfile(
  id: string
): Promise<UserProfile | null> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return null;
  }

  // Don't return anonymous users
  if (data.anonymous) {
    return null;
  }

  return {
    ...data,
    profile_image: data.profile_image || '',
    display_name: data.display_name || '',
  };
}

export async function updateUserProfile(
  id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  const supabase = createBrowserClient();
  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from('users').update(updates).eq('id', id);

  if (error) {
    return false;
  }

  return true;
}

export async function signOutUser(): Promise<boolean> {
  const supabase = createBrowserClient();
  if (!supabase) {
    toast({
      title: 'Sign out is not supported in this deployment',
      status: 'info',
    });
    return false;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return false;
  }

  return true;
}

export function subscribeToUserUpdates(
  userId: string,
  onUpdate: (newData: Partial<UserProfile>) => void
) {
  const supabase = createBrowserClient();
  if (!supabase) {
    return () => {};
  }

  const channel = supabase
    .channel(`public:users:id=eq.${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        onUpdate(payload.new as Partial<UserProfile>);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}