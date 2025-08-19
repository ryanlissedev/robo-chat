#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING environment variable');
  process.exit(1);
}

async function runMigrations() {
  console.log('🔧 Setting up RoboRail database with direct PostgreSQL connection...');
  
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Run each migration file
    const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        console.log(`Running migration: ${file}...`);
        const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        try {
          await client.query(sqlContent);
          console.log(`✅ Migration ${file} completed`);
        } catch (error) {
          console.log(`⚠️  Migration ${file} error:`, error.message);
          // Continue with other migrations
        }
      }
    }
    
    // Create a basic users table if it doesn't exist (for rate limiting)
    console.log('Setting up users table for rate limiting...');
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
    
    try {
      await client.query(createUsersTable);
      console.log('✅ Users and rate_limits tables set up');
    } catch (error) {
      console.log('⚠️  Error creating users/rate_limits tables:', error.message);
    }
    
    // Check what tables we have
    console.log('Checking database tables...');
    const { rows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('📋 Current tables:', rows.map(r => r.table_name).join(', '));
    
    console.log('🎉 Database setup completed!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    await client.end();
  }
}

runMigrations();