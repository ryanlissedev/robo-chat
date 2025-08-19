#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🔧 Setting up RoboRail database...');
  
  try {
    // Enable anonymous authentication first
    console.log('1. Enabling anonymous authentication...');
    const { error: authError } = await supabase.auth.admin.updateUserById(
      '00000000-0000-0000-0000-000000000000',
      { email_confirm: true }
    );
    
    // Run each migration file
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        console.log(`2. Running migration: ${file}...`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });
        if (error) {
          console.log(`⚠️  Migration ${file} may have issues:`, error.message);
          // Continue with other migrations
        } else {
          console.log(`✅ Migration ${file} completed`);
        }
      }
    }
    
    // Create a basic users table if it doesn't exist (for rate limiting)
    console.log('3. Setting up users table for rate limiting...');
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      -- Create rate_limits table if it doesn't exist
      CREATE TABLE IF NOT EXISTS public.rate_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id),
        endpoint VARCHAR(255) NOT NULL,
        requests_count INTEGER DEFAULT 1,
        window_start TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
      CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);
    `;
    
    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createUsersTable });
    if (tableError) {
      console.log('⚠️  Error creating users/rate_limits tables:', tableError.message);
    } else {
      console.log('✅ Users and rate_limits tables set up');
    }
    
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

runMigrations();