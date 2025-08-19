-- ====================================================================
-- Fix Guest User Support Migration
-- Date: 2025-08-19
-- Purpose: Fix missing columns and constraints for guest user functionality
-- ====================================================================

-- 1. Add message_count column to users table if it doesn't exist
-- --------------------------------------------------------------------
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'message_count') THEN
    ALTER TABLE users ADD COLUMN message_count INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- 2. Remove or make foreign key constraint deferrable for guest users
-- --------------------------------------------------------------------
-- First, drop the existing foreign key constraint if it exists
DO $$
BEGIN
  -- Drop the constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'fk_chats_user' 
             AND table_name = 'chats') THEN
    ALTER TABLE chats DROP CONSTRAINT fk_chats_user;
  END IF;
  
  -- Re-add the constraint with ON DELETE SET NULL to handle guest users better
  -- This allows chats to exist even if the user is not in the users table
  ALTER TABLE chats 
    ADD CONSTRAINT fk_chats_user 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;
END $$;

-- 3. Create a function to handle guest user chats
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_guest_chat(
  p_user_id UUID,
  p_title TEXT,
  p_model TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_chat_id UUID;
BEGIN
  -- Generate a new chat ID
  v_chat_id := gen_random_uuid();
  
  -- Insert the chat without checking user existence
  INSERT INTO chats (id, user_id, title, model, created_at, updated_at)
  VALUES (v_chat_id, p_user_id, p_title, p_model, NOW(), NOW());
  
  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Create or update the messages table to handle guest messages
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- Make the foreign key constraint on messages table deferrable as well
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'messages_chat_id_fkey' 
             AND table_name = 'messages') THEN
    ALTER TABLE messages DROP CONSTRAINT messages_chat_id_fkey;
  END IF;
  
  ALTER TABLE messages 
    ADD CONSTRAINT messages_chat_id_fkey 
    FOREIGN KEY (chat_id) 
    REFERENCES chats(id) 
    ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;
END $$;

-- 5. Add indexes for better performance
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_message_count ON users(message_count);
CREATE INDEX IF NOT EXISTS idx_chats_user_id_created ON chats(user_id, created_at DESC);

-- 6. Grant necessary permissions for RLS policies
-- --------------------------------------------------------------------
-- Enable RLS on tables if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for guest users (allow insert without authentication)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Guest users can create chats" ON chats;
  DROP POLICY IF EXISTS "Guest users can view their chats" ON chats;
  DROP POLICY IF EXISTS "Guest users can create messages" ON messages;
  DROP POLICY IF EXISTS "Guest users can view their messages" ON messages;
  
  -- Create new policies that allow guest operations
  CREATE POLICY "Guest users can create chats" ON chats
    FOR INSERT
    WITH CHECK (true);
    
  CREATE POLICY "Guest users can view their chats" ON chats
    FOR SELECT
    USING (true);
    
  CREATE POLICY "Guest users can create messages" ON messages
    FOR INSERT
    WITH CHECK (true);
    
  CREATE POLICY "Guest users can view their messages" ON messages
    FOR SELECT
    USING (true);
END $$;

-- 7. Create a simplified guest user creation function
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_guest_user(
  p_user_id UUID
) RETURNS UUID AS $$
BEGIN
  -- Insert a minimal guest user record
  INSERT INTO users (id, email, created_at, updated_at, message_count, daily_message_count)
  VALUES (
    p_user_id,
    p_user_id::TEXT || '@guest.local', -- Temporary email for guest
    NOW(),
    NOW(),
    0,
    0
  )
  ON CONFLICT (id) DO UPDATE
  SET updated_at = NOW();
  
  RETURN p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_guest_chat TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_guest_user TO anon, authenticated;