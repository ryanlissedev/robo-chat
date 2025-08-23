// Check if Supabase is properly configured (not using placeholder values)
export const isSupabaseEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder_anon_key'
);

export const isDevelopmentMode = process.env.NODE_ENV === 'development';

// For development, we can disable realtime features to avoid connection errors
export const isRealtimeEnabled = isSupabaseEnabled && !isDevelopmentMode;
