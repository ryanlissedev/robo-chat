-- ====================================================================
-- Add Missing Tables and Columns Migration for RoboRail
-- Date: 2025-01-23
-- Purpose: Add missing tables and columns expected by application
-- ====================================================================

-- 1. Add missing columns to users table
-- --------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS system_prompt TEXT;

-- Update users table to populate email from auth.users if missing
UPDATE users 
SET email = auth_users.email 
FROM auth.users AS auth_users 
WHERE users.id = auth_users.id 
AND users.email IS NULL;

-- 2. Add missing project_id column to chats table
-- --------------------------------------------------------------------
ALTER TABLE chats ADD COLUMN IF NOT EXISTS project_id UUID;

-- Create foreign key relationship to projects table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'chats_project_id_fkey'
    ) THEN
        ALTER TABLE chats 
        ADD CONSTRAINT chats_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Create missing feedback table (general feedback, different from message_feedback)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for feedback table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'feedback_user_id_fkey'
    ) THEN
        ALTER TABLE feedback 
        ADD CONSTRAINT feedback_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Create missing user_preferences table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY,
  layout VARCHAR(50) DEFAULT 'default',
  prompt_suggestions BOOLEAN DEFAULT true,
  show_tool_invocations BOOLEAN DEFAULT true,
  show_conversation_previews BOOLEAN DEFAULT true,
  multi_model_enabled BOOLEAN DEFAULT false,
  hidden_models TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint for user_preferences
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'user_preferences_user_id_fkey'
    ) THEN
        ALTER TABLE user_preferences 
        ADD CONSTRAINT user_preferences_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Fix message_feedback column naming inconsistency
-- --------------------------------------------------------------------
-- The database types expect different column names than what exists
DO $$
BEGIN
    -- Check if we need to rename columns
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_feedback' 
        AND column_name = 'feedback'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_feedback' 
        AND column_name = 'feedback_type'
    ) THEN
        -- Rename feedback column to feedback_type
        ALTER TABLE message_feedback RENAME COLUMN feedback TO feedback_type;
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_feedback' 
        AND column_name = 'comment'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_feedback' 
        AND column_name = 'feedback_text'
    ) THEN
        -- Rename comment column to feedback_text
        ALTER TABLE message_feedback RENAME COLUMN comment TO feedback_text;
    END IF;
END $$;

-- 6. Add missing columns to messages table
-- --------------------------------------------------------------------  
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reasoning_effort VARCHAR(10) DEFAULT 'medium' 
    CHECK (reasoning_effort IN ('low', 'medium', 'high'));
ALTER TABLE messages ADD COLUMN IF NOT EXISTS langsmith_run_id VARCHAR(255);

-- 7. Create indexes for performance
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reasoning_effort ON messages(reasoning_effort);
CREATE INDEX IF NOT EXISTS idx_messages_langsmith_run_id ON messages(langsmith_run_id);

-- 8. Enable RLS on new tables
-- --------------------------------------------------------------------
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for new tables
-- --------------------------------------------------------------------
-- Feedback table policies
CREATE POLICY "Users can manage their own feedback" ON feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User preferences policies
CREATE POLICY "Users can manage their own preferences" ON user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Add updated_at triggers for new tables
-- --------------------------------------------------------------------
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Create default user preferences for existing users
-- --------------------------------------------------------------------
INSERT INTO user_preferences (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences up WHERE up.user_id = users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 12. Add comments for documentation
-- --------------------------------------------------------------------
COMMENT ON TABLE feedback IS 'General user feedback about the application';
COMMENT ON TABLE user_preferences IS 'User interface and behavior preferences';

COMMENT ON COLUMN users.display_name IS 'User display name for UI';
COMMENT ON COLUMN users.email IS 'User email address from auth.users';
COMMENT ON COLUMN users.profile_image IS 'URL to user profile image';
COMMENT ON COLUMN users.last_active_at IS 'Last time user was active';
COMMENT ON COLUMN users.system_prompt IS 'User custom system prompt';
COMMENT ON COLUMN chats.project_id IS 'Project this chat belongs to (optional)';
COMMENT ON COLUMN messages.reasoning_effort IS 'GPT-5 reasoning effort level';
COMMENT ON COLUMN messages.langsmith_run_id IS 'LangSmith run ID for tracing';

-- Migration complete
-- This migration adds all missing tables and columns expected by the application