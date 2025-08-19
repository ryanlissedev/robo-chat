#!/usr/bin/env node

// Direct script to create users table via Supabase client
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createUsersTable() {
  console.log('🔧 Creating users table with correct schema...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      message_count INTEGER DEFAULT 0,
      daily_message_count INTEGER DEFAULT 0,
      daily_reset TIMESTAMPTZ DEFAULT NOW(),
      anonymous BOOLEAN DEFAULT FALSE,
      premium BOOLEAN DEFAULT FALSE,
      daily_pro_message_count INTEGER DEFAULT 0,
      daily_pro_reset TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_users_anonymous ON public.users(anonymous);
    CREATE INDEX IF NOT EXISTS idx_users_premium ON public.users(premium);
    CREATE INDEX IF NOT EXISTS idx_users_daily_reset ON public.users(daily_reset);

    -- Enable RLS
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    -- RLS policies for users table
    DROP POLICY IF EXISTS "Users can manage their own user record" ON public.users;
    CREATE POLICY "Users can manage their own user record" ON public.users
      FOR ALL
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);

    -- Create updated_at trigger function if it doesn't exist
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Add updated_at trigger
    DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error && error.message.includes('Could not find the function')) {
      // Try using direct SQL if exec_sql is not available
      console.log('exec_sql not available, trying direct approach...');
      
      // Create table via multiple queries
      const queries = [
        `CREATE TABLE IF NOT EXISTS public.users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          message_count INTEGER DEFAULT 0,
          daily_message_count INTEGER DEFAULT 0,
          daily_reset TIMESTAMPTZ DEFAULT NOW(),
          anonymous BOOLEAN DEFAULT FALSE,
          premium BOOLEAN DEFAULT FALSE,
          daily_pro_message_count INTEGER DEFAULT 0,
          daily_pro_reset TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS idx_users_anonymous ON public.users(anonymous)`,
        `CREATE INDEX IF NOT EXISTS idx_users_premium ON public.users(premium)`,
        `CREATE INDEX IF NOT EXISTS idx_users_daily_reset ON public.users(daily_reset)`,
        `ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`
      ];
      
      for (const query of queries) {
        try {
          await supabase.rpc('exec_sql', { sql: query });
        } catch (err) {
          console.log(`Query failed: ${query.substring(0, 50)}... - ${err.message}`);
        }
      }
    } else if (error) {
      console.error('❌ Error creating users table:', error);
    } else {
      console.log('✅ Users table created successfully');
    }
    
    // Check if table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users');
      
    if (tableError) {
      console.log('Could not verify table creation:', tableError.message);
    } else if (tables && tables.length > 0) {
      console.log('✅ Users table exists in database');
    } else {
      console.log('⚠️  Users table may not have been created');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createUsersTable().then(() => {
  console.log('🎉 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});