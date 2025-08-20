import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/types/database.types';
import { isSupabaseEnabled } from './config';

export async function createGuestServerClient() {
  if (!isSupabaseEnabled) {
    return null;
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    }
  );
}
