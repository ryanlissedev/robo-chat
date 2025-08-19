import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE!
    
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    
    console.log('Setting up database tables...')
    
    // Create users table for rate limiting
    const { error: usersError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    })
    
    // Create rate_limits table
    const { error: rateLimitsError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.rate_limits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID,
          endpoint VARCHAR(255) NOT NULL,
          requests_count INTEGER DEFAULT 1,
          window_start TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
        CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);
      `
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database setup completed',
      errors: {
        users: usersError?.message,
        rateLimits: rateLimitsError?.message
      }
    })
  } catch (error) {
    console.error('Database setup error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}