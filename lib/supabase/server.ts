import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/app/types/database.types';
import { isSupabaseEnabled } from './config';

// Return a broadly-typed client to avoid downstream TS inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createClient = async (): Promise<any | null> => {
  if (!isSupabaseEnabled()) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ignore for middleware
          }
        },
      },
    }
  ) as any;
};
