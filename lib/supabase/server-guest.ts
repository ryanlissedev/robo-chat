import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/types/database.types';
import { isSupabaseEnabled } from './config';

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
        setAll: () => {
          /* no-op in guest server client */
        },
      },
    }
  ) as unknown as any;
}
