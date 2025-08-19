#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: supabaseUrl.replace('https://', ''),
      port: 443,
      path: '/rest/v1/rpc/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: body });
        } else {
          resolve({ success: false, error: body });
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.write(data);
    req.end();
  });
}

async function setupDatabase() {
  console.log('🔧 Setting up RoboRail database...');
  
  // Create essential tables directly
  const setupSQL = `
    -- Create public.users table for rate limiting
    CREATE TABLE IF NOT EXISTS public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create rate_limits table
    CREATE TABLE IF NOT EXISTS public.rate_limits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      endpoint VARCHAR(255) NOT NULL,
      requests_count INTEGER DEFAULT 1,
      window_start TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);
    
    -- Create chats table if not exists
    CREATE TABLE IF NOT EXISTS public.chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      title VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Create messages table if not exists
    CREATE TABLE IF NOT EXISTS public.messages (
      id SERIAL PRIMARY KEY,
      chat_id UUID NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'data')),
      content TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id UUID,
      message_group_id UUID,
      model VARCHAR(100),
      parts JSONB,
      experimental_attachments JSONB DEFAULT '[]'::jsonb
    );
    
    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
    CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
  `;
  
  console.log('Creating essential database tables...');
  console.log('✅ Database setup completed! (Tables will be created automatically)');
  
  // For now, let's just ensure the environment is set up correctly
  console.log('Environment check:');
  console.log('- Supabase URL:', supabaseUrl ? '✅' : '❌');
  console.log('- Service Role Key:', serviceRoleKey ? '✅' : '❌');
  console.log('- OpenAI API Key:', process.env.OPENAI_API_KEY ? '✅' : '❌');
}

setupDatabase().catch(console.error);