-- Fix database schema issues identified in RoboRail application
-- This migration addresses:
-- 1. Foreign key relationships should reference 'users' table, not 'auth.users'
-- 2. Missing columns in chats table (model, public)
-- 3. Missing user_id column in chat_attachments table
-- 4. Ensure proper foreign key constraints

-- Step 1: Add missing columns to chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS model VARCHAR(100),
ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT false;

-- Step 2: Add missing user_id column to chat_attachments table  
ALTER TABLE chat_attachments 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 3: Update chat_attachments to have user_id from associated chat
UPDATE chat_attachments 
SET user_id = chats.user_id 
FROM chats 
WHERE chat_attachments.chat_id = chats.id 
AND chat_attachments.user_id IS NULL;

-- Step 4: Make user_id NOT NULL after populating it
ALTER TABLE chat_attachments 
ALTER COLUMN user_id SET NOT NULL;

-- Step 5: Drop existing foreign key constraints that reference auth.users
-- Note: These might fail if constraints don't exist, which is fine
DO $$ 
BEGIN
    -- Drop chats user_id foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chats_user_id_fkey'
        AND table_name = 'chats'
    ) THEN
        ALTER TABLE chats DROP CONSTRAINT chats_user_id_fkey;
    END IF;
    
    -- Drop projects user_id foreign key if it exists  
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'projects_user_id_fkey'
        AND table_name = 'projects'
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT projects_user_id_fkey;
    END IF;
    
    -- Drop messages user_id foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'messages_user_id_fkey'
        AND table_name = 'messages'
    ) THEN
        ALTER TABLE messages DROP CONSTRAINT messages_user_id_fkey;
    END IF;
END $$;

-- Step 6: Create proper foreign key constraints to users table
ALTER TABLE chats 
ADD CONSTRAINT chats_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE projects 
ADD CONSTRAINT projects_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE messages 
ADD CONSTRAINT messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 7: Add foreign key constraint for chat_attachments user_id
ALTER TABLE chat_attachments 
ADD CONSTRAINT chat_attachments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 8: Update RLS policies for chat_attachments to include user_id check
DROP POLICY IF EXISTS "Users can manage attachments in their chats" ON chat_attachments;

CREATE POLICY "Users can manage attachments in their chats" ON chat_attachments
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 9: Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_model ON chats(model) WHERE model IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chats_public ON chats(public) WHERE public = true;
CREATE INDEX IF NOT EXISTS idx_chat_attachments_user_id ON chat_attachments(user_id);

-- Step 10: Add comments for new columns
COMMENT ON COLUMN chats.model IS 'AI model used for this chat conversation';
COMMENT ON COLUMN chats.public IS 'Whether this chat is publicly accessible';
COMMENT ON COLUMN chat_attachments.user_id IS 'User who owns this attachment (duplicated from chat for performance)';