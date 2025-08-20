-- Drop the old table if exists (data migration needed in production)
DROP TABLE IF EXISTS user_api_keys CASCADE;

-- Create properly encrypted user keys table
CREATE TABLE IF NOT EXISTS user_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL, -- AES-256-GCM encrypted
  iv TEXT NOT NULL, -- Initialization vector for encryption
  auth_tag TEXT, -- Authentication tag for GCM mode
  masked_key VARCHAR(50), -- Display version (e.g., sk-...abc)
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  last_rotated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

-- Create audit log for API key operations
CREATE TABLE IF NOT EXISTS api_key_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL, -- created, updated, deleted, rotated, accessed
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_keys_user_id ON user_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_provider ON user_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_keys_active ON user_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_key_audit_user_id ON api_key_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_created ON api_key_audit_log(created_at);

-- Add RLS policies
ALTER TABLE user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own API keys
CREATE POLICY "Users can view their own API keys" ON user_keys
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON user_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON user_keys
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON user_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs" ON api_key_audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert audit logs
CREATE POLICY "Service can insert audit logs" ON api_key_audit_log
  FOR INSERT
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_user_keys_updated_at
  BEFORE UPDATE ON user_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add user_security_settings table for rotation configuration
CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{
    "requireApiKeyRotation": false,
    "rotationDays": 90
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Add RLS policies for user_security_settings
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security settings" ON user_security_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own security settings" ON user_security_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own security settings" ON user_security_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own security settings" ON user_security_settings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger for user_security_settings
CREATE TRIGGER update_user_security_settings_updated_at
  BEFORE UPDATE ON user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- Add comments for documentation
COMMENT ON TABLE user_keys IS 'Stores AES-256-GCM encrypted API keys for various AI providers';
COMMENT ON TABLE api_key_audit_log IS 'Audit trail for all API key operations';
COMMENT ON TABLE user_security_settings IS 'User-specific security settings including API key rotation policies';

COMMENT ON COLUMN user_keys.encrypted_key IS 'AES-256-GCM encrypted API key';
COMMENT ON COLUMN user_keys.iv IS 'Initialization vector for AES-256-GCM encryption';
COMMENT ON COLUMN user_keys.auth_tag IS 'Authentication tag for GCM mode verification';
COMMENT ON COLUMN user_keys.masked_key IS 'Partially masked key for safe display';
COMMENT ON COLUMN user_keys.last_rotated IS 'Last time this key was rotated';
COMMENT ON COLUMN api_key_audit_log.action IS 'Type of operation: created, updated, deleted, rotated, accessed';
COMMENT ON COLUMN user_security_settings.config IS 'JSON configuration for security settings like rotation policies';