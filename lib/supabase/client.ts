import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/app/types/database.types';
import { isSupabaseEnabled } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any | null {
  if (!isSupabaseEnabled()) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  ) as unknown as any;
}
