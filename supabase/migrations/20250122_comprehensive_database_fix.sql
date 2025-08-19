-- ====================================================================
-- Comprehensive Database Fix Migration for RoboRail
-- Date: 2025-01-22
-- Purpose: Fix all database schema issues and ensure consistency
-- ====================================================================

-- 1. Add missing columns to users table
-- --------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_models JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymous BOOLEAN DEFAULT false;

-- 2. Add missing columns to chats table
-- --------------------------------------------------------------------
ALTER TABLE chats ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE chats ADD COLUMN IF NOT EXISTS public BOOLEAN DEFAULT false;

-- 3. Add missing user_id to chat_attachments
-- --------------------------------------------------------------------
DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_attachments' 
        AND column_name = 'user_id'
    ) THEN
        -- Add the column
        ALTER TABLE chat_attachments ADD COLUMN user_id UUID;
        
        -- Populate user_id from associated chat
        UPDATE chat_attachments ca
        SET user_id = c.user_id
        FROM chats c
        WHERE ca.chat_id = c.id
        AND ca.user_id IS NULL;
        
        -- Make it NOT NULL after population
        ALTER TABLE chat_attachments ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- 4. Fix foreign key constraints
-- --------------------------------------------------------------------
-- Drop existing foreign keys that point to auth.users
DO $$
BEGIN
    -- Drop chats FK if it points to auth.users
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'chats_user_id_fkey'
        AND unique_constraint_schema = 'auth'
    ) THEN
        ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_user_id_fkey;
    END IF;
    
    -- Drop projects FK if it points to auth.users
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'projects_user_id_fkey'
        AND unique_constraint_schema = 'auth'
    ) THEN
        ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
    END IF;
    
    -- Drop messages FK if it points to auth.users
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'messages_user_id_fkey'
        AND unique_constraint_schema = 'auth'
    ) THEN
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
    END IF;
END $$;

-- Recreate foreign keys to point to users table
DO $$
BEGIN
    -- Add FK for chats
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'chats_user_id_fkey'
        AND unique_constraint_schema = 'public'
    ) THEN
        ALTER TABLE chats 
        ADD CONSTRAINT chats_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for projects
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'projects_user_id_fkey'
        AND unique_constraint_schema = 'public'
    ) THEN
        ALTER TABLE projects 
        ADD CONSTRAINT projects_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for messages
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'messages_user_id_fkey'
        AND unique_constraint_schema = 'public'
    ) THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for chat_attachments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'chat_attachments_user_id_fkey'
    ) THEN
        ALTER TABLE chat_attachments 
        ADD CONSTRAINT chat_attachments_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for user_keys
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'user_keys_user_id_fkey'
    ) THEN
        ALTER TABLE user_keys 
        ADD CONSTRAINT user_keys_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for user_retrieval_settings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'user_retrieval_settings_user_id_fkey'
    ) THEN
        ALTER TABLE user_retrieval_settings 
        ADD CONSTRAINT user_retrieval_settings_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for user_security_settings
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'user_security_settings_user_id_fkey'
    ) THEN
        ALTER TABLE user_security_settings 
        ADD CONSTRAINT user_security_settings_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add FK for message_feedback
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'message_feedback_user_id_fkey'
    ) THEN
        ALTER TABLE message_feedback 
        ADD CONSTRAINT message_feedback_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
    
    -- Add missing FK for message_feedback to messages
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'message_feedback_message_id_fkey'
    ) THEN
        ALTER TABLE message_feedback 
        ADD CONSTRAINT message_feedback_message_id_fkey 
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Create indexes for performance
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chats_model ON chats(model);
CREATE INDEX IF NOT EXISTS idx_chats_public ON chats(public);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_user_id ON chat_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_users_anonymous ON users(anonymous);
CREATE INDEX IF NOT EXISTS idx_messages_langsmith_run_id ON messages(langsmith_run_id);

-- 6. Update RLS policies for chat_attachments
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own attachments" ON chat_attachments;
CREATE POLICY "Users can view their own attachments" ON chat_attachments
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own attachments" ON chat_attachments;
CREATE POLICY "Users can insert their own attachments" ON chat_attachments
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own attachments" ON chat_attachments;
CREATE POLICY "Users can delete their own attachments" ON chat_attachments
    FOR DELETE
    USING (user_id = auth.uid());

-- 7. Ensure all authenticated users exist in users table
-- --------------------------------------------------------------------
-- This creates user records for any auth.users that don't have a corresponding users record
INSERT INTO users (id, email, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.created_at
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- 8. Add default values for new columns where missing
-- --------------------------------------------------------------------
UPDATE users 
SET favorite_models = '[]'::jsonb 
WHERE favorite_models IS NULL;

UPDATE users 
SET anonymous = false 
WHERE anonymous IS NULL;

UPDATE chats 
SET public = false 
WHERE public IS NULL;

-- 9. Add comments for documentation
-- --------------------------------------------------------------------
COMMENT ON COLUMN users.favorite_models IS 'JSON array of user''s favorite AI model IDs';
COMMENT ON COLUMN users.anonymous IS 'Whether this is an anonymous/guest user';
COMMENT ON COLUMN chats.model IS 'AI model used for this chat session';
COMMENT ON COLUMN chats.public IS 'Whether this chat is publicly accessible';
COMMENT ON COLUMN chat_attachments.user_id IS 'User who uploaded the attachment';

-- 10. Validate constraints are working
-- --------------------------------------------------------------------
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Check for orphaned chats
    SELECT COUNT(*) INTO invalid_count
    FROM chats c
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id);
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Found % orphaned chats without valid user references', invalid_count;
    END IF;
    
    -- Check for orphaned messages
    SELECT COUNT(*) INTO invalid_count
    FROM messages m
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m.user_id);
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Found % orphaned messages without valid user references', invalid_count;
    END IF;
END $$;

-- Migration complete
-- This migration is idempotent and can be run multiple times safely