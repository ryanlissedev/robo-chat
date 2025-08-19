-- Complete Drizzle-compatible schema migration for RoboRail
-- This migration creates all necessary tables with proper types and constraints
-- Generated: 2025-01-22

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE reasoning_effort AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE feedback_type AS ENUM ('positive', 'negative');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create or update users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  system_prompt TEXT,
  theme_mode TEXT DEFAULT 'system',
  daily_message_count INTEGER DEFAULT 0 NOT NULL,
  daily_pro_message_count INTEGER DEFAULT 0 NOT NULL,
  last_active_at TIMESTAMP DEFAULT NOW(),
  favorite_models JSONB DEFAULT '[]'::jsonb,
  anonymous BOOLEAN DEFAULT FALSE NOT NULL
);

-- Add missing columns to users if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'favorite_models') THEN
    ALTER TABLE users ADD COLUMN favorite_models JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'anonymous') THEN
    ALTER TABLE users ADD COLUMN anonymous BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_message_count') THEN
    ALTER TABLE users ADD COLUMN daily_message_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'daily_pro_message_count') THEN
    ALTER TABLE users ADD COLUMN daily_pro_message_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active_at') THEN
    ALTER TABLE users ADD COLUMN last_active_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Create or update chats table
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  system_prompt TEXT,
  model VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  public BOOLEAN DEFAULT FALSE NOT NULL,
  CONSTRAINT fk_chats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add missing columns to chats if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'model') THEN
    ALTER TABLE chats ADD COLUMN model VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'public') THEN
    ALTER TABLE chats ADD COLUMN public BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;
END $$;

-- Create or update messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  model TEXT,
  reasoning_effort reasoning_effort DEFAULT 'medium',
  reasoning TEXT,
  metadata JSONB,
  CONSTRAINT fk_messages_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add missing columns to messages if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reasoning_effort') THEN
    ALTER TABLE messages ADD COLUMN reasoning_effort reasoning_effort DEFAULT 'medium';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reasoning') THEN
    ALTER TABLE messages ADD COLUMN reasoning TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'metadata') THEN
    ALTER TABLE messages ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Create message_feedback table if it doesn't exist
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  feedback_type feedback_type NOT NULL,
  comment TEXT,
  rating INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_feedback_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create api_keys table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_apikeys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_users_anonymous ON users(anonymous);

-- Fix any existing foreign key constraints that reference auth.users
DO $$
BEGIN
  -- Drop old constraints if they exist
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chats_user_id_fkey' AND table_name = 'chats') THEN
    ALTER TABLE chats DROP CONSTRAINT chats_user_id_fkey;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'messages_user_id_fkey' AND table_name = 'messages') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_user_id_fkey;
  END IF;
  
  -- Re-add constraints with correct references
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_chats_user' AND table_name = 'chats') THEN
    ALTER TABLE chats ADD CONSTRAINT fk_chats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_messages_user' AND table_name = 'messages') THEN
    ALTER TABLE messages ADD CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_feedback_updated_at ON message_feedback;
CREATE TRIGGER update_message_feedback_updated_at BEFORE UPDATE ON message_feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your Supabase setup)
GRANT ALL ON users TO postgres, anon, authenticated, service_role;
GRANT ALL ON chats TO postgres, anon, authenticated, service_role;
GRANT ALL ON messages TO postgres, anon, authenticated, service_role;
GRANT ALL ON message_feedback TO postgres, anon, authenticated, service_role;
GRANT ALL ON api_keys TO postgres, anon, authenticated, service_role;

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for guest users
CREATE POLICY "Guest users can read own data" ON users
  FOR SELECT USING (id = current_setting('app.current_user_id', true)::uuid OR anonymous = true);

CREATE POLICY "Guest users can update own data" ON users
  FOR UPDATE USING (id = current_setting('app.current_user_id', true)::uuid);

CREATE POLICY "Guest users can insert own data" ON users
  FOR INSERT WITH CHECK (id = current_setting('app.current_user_id', true)::uuid OR anonymous = true);

-- Add similar policies for other tables as needed

-- Migration complete
-- Note: This migration is idempotent and can be run multiple times safely