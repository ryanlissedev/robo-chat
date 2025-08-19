-- ====================================================================
-- Comprehensive Drizzle ORM Schema Migration for RoboRail
-- Date: 2025-01-25
-- Purpose: Ensure all tables from enhanced Drizzle schema exist with proper structure
-- ====================================================================

-- Create additional enums if they don't exist
DO $$ BEGIN
  CREATE TYPE provider AS ENUM (
    'openai', 'anthropic', 'google', 'xai', 'groq', 
    'deepseek', 'mistral', 'perplexity', 'ollama'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Ensure projects table exists with proper structure
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add missing columns to projects if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN
    ALTER TABLE projects ADD COLUMN description TEXT;
  END IF;
END $$;

-- 2. Add missing columns to messages table for enhanced schema
-- --------------------------------------------------------------------
DO $$ 
BEGIN
  -- Add parts column for structured message content
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'parts') THEN
    ALTER TABLE messages ADD COLUMN parts JSONB;
  END IF;
  
  -- Ensure langsmith_run_id exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'langsmith_run_id') THEN
    ALTER TABLE messages ADD COLUMN langsmith_run_id VARCHAR(255);
  END IF;
END $$;

-- 3. Create user_retrieval_settings table if it doesn't exist
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_retrieval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  enable_retrieval BOOLEAN DEFAULT TRUE NOT NULL,
  max_results INTEGER DEFAULT 5 NOT NULL,
  similarity_threshold INTEGER DEFAULT 70 NOT NULL,
  preferred_sources JSONB DEFAULT '[]'::jsonb,
  excluded_sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_user_retrieval_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_user_retrieval_settings_user UNIQUE (user_id)
);

-- 4. Create chat_attachments table if it doesn't exist
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_chat_attachments_chat FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- 5. Create api_key_audit_log table if it doesn't exist
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider provider NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'used'
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_api_key_audit_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Update user_keys table to use provider enum if it exists
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- Only attempt if the table exists and provider enum exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_keys') THEN
    -- Check if provider column is already the right type
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_keys' 
      AND column_name = 'provider' 
      AND udt_name = 'provider'
    ) THEN
      -- Add constraint to validate existing data matches enum values
      ALTER TABLE user_keys 
      ADD CONSTRAINT check_provider_enum 
      CHECK (provider IN ('openai', 'anthropic', 'google', 'xai', 'groq', 'deepseek', 'mistral', 'perplexity', 'ollama'));
      
      -- Note: Cannot directly change column type due to existing data
      -- This constraint ensures new data follows enum pattern
    END IF;
  END IF;
END $$;

-- 7. Add unique constraint to user_keys for provider per user
-- --------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_keys') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'uq_user_keys_provider_user' 
      AND table_name = 'user_keys'
    ) THEN
      ALTER TABLE user_keys 
      ADD CONSTRAINT uq_user_keys_provider_user 
      UNIQUE (user_id, provider);
    END IF;
  END IF;
END $$;

-- 8. Create comprehensive indexes for performance
-- --------------------------------------------------------------------

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Enhanced chats indexes
CREATE INDEX IF NOT EXISTS idx_chats_model ON chats(model);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_public ON chats(public) WHERE public = true;

-- Enhanced messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);

-- User retrieval settings indexes
CREATE INDEX IF NOT EXISTS idx_user_retrieval_settings_user_id ON user_retrieval_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_retrieval_settings_enable ON user_retrieval_settings(enable_retrieval);

-- Chat attachments indexes
CREATE INDEX IF NOT EXISTS idx_chat_attachments_chat_id ON chat_attachments(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_file_type ON chat_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_uploaded_at ON chat_attachments(uploaded_at DESC);

-- API key audit log indexes
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_user_id ON api_key_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_provider ON api_key_audit_log(provider);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_action ON api_key_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_created_at ON api_key_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_log_success ON api_key_audit_log(success);

-- 9. Enable RLS on new tables
-- --------------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retrieval_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for new tables
-- --------------------------------------------------------------------

-- Projects policies
DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL
  USING (auth.uid() = user_id OR current_setting('app.current_user_id', true)::uuid = user_id)
  WITH CHECK (auth.uid() = user_id OR current_setting('app.current_user_id', true)::uuid = user_id);

-- User retrieval settings policies
DROP POLICY IF EXISTS "Users can manage their own retrieval settings" ON user_retrieval_settings;
CREATE POLICY "Users can manage their own retrieval settings" ON user_retrieval_settings
  FOR ALL
  USING (auth.uid() = user_id OR current_setting('app.current_user_id', true)::uuid = user_id)
  WITH CHECK (auth.uid() = user_id OR current_setting('app.current_user_id', true)::uuid = user_id);

-- Chat attachments policies
DROP POLICY IF EXISTS "Users can manage attachments for their chats" ON chat_attachments;
CREATE POLICY "Users can manage attachments for their chats" ON chat_attachments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_attachments.chat_id 
      AND (chats.user_id = auth.uid() OR chats.user_id = current_setting('app.current_user_id', true)::uuid)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chats 
      WHERE chats.id = chat_attachments.chat_id 
      AND (chats.user_id = auth.uid() OR chats.user_id = current_setting('app.current_user_id', true)::uuid)
    )
  );

-- API key audit log policies (read-only for users)
DROP POLICY IF EXISTS "Users can view their own audit logs" ON api_key_audit_log;
CREATE POLICY "Users can view their own audit logs" ON api_key_audit_log
  FOR SELECT
  USING (auth.uid() = user_id OR current_setting('app.current_user_id', true)::uuid = user_id);

-- 11. Add updated_at triggers for new tables
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_retrieval_settings_updated_at ON user_retrieval_settings;
CREATE TRIGGER update_user_retrieval_settings_updated_at BEFORE UPDATE ON user_retrieval_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 12. Create default user retrieval settings for existing users
-- --------------------------------------------------------------------
INSERT INTO user_retrieval_settings (user_id)
SELECT id FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM user_retrieval_settings urs WHERE urs.user_id = users.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 13. Add helpful comments for documentation
-- --------------------------------------------------------------------
COMMENT ON TABLE projects IS 'User projects for organizing chats';
COMMENT ON TABLE user_retrieval_settings IS 'User preferences for RAG retrieval system';
COMMENT ON TABLE chat_attachments IS 'File attachments associated with chats';
COMMENT ON TABLE api_key_audit_log IS 'Security audit log for API key operations';

COMMENT ON COLUMN messages.parts IS 'Structured message content with type and content parts';
COMMENT ON COLUMN messages.langsmith_run_id IS 'LangSmith tracing run identifier';
COMMENT ON COLUMN user_retrieval_settings.similarity_threshold IS 'Minimum similarity score (0-100) for retrieval results';
COMMENT ON COLUMN api_key_audit_log.action IS 'Action performed: created, updated, deleted, used';

-- 14. Grant necessary permissions
-- --------------------------------------------------------------------
GRANT ALL ON projects TO postgres, anon, authenticated, service_role;
GRANT ALL ON user_retrieval_settings TO postgres, anon, authenticated, service_role;
GRANT ALL ON chat_attachments TO postgres, anon, authenticated, service_role;
GRANT ALL ON api_key_audit_log TO postgres, anon, authenticated, service_role;

-- Migration complete
RAISE NOTICE '✅ Comprehensive Drizzle schema migration completed successfully';
RAISE NOTICE 'All tables, indexes, and relationships are now aligned with enhanced Drizzle ORM schema';