import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/types/database.types';
import { isSupabaseEnabled } from './config';

// Return a broadly-typed client to avoid downstream TS inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createGuestServerClient(): Promise<any | null> {
  if (!isSupabaseEnabled()) {
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
  ) as any;
}
