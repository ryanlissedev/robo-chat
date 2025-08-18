-- Create user API keys table for storing encrypted API keys
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  api_key TEXT NOT NULL, -- Should be encrypted in production
  masked_key VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, provider)
);

-- Create user retrieval settings table
CREATE TABLE IF NOT EXISTS user_retrieval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{
    "queryRewriting": true,
    "rewriteStrategy": "expansion",
    "reranking": true,
    "rerankingMethod": "semantic",
    "topK": 5,
    "temperature": 0.3,
    "minScore": 0.7,
    "useHyDE": false,
    "diversityLambda": 0.5,
    "chunkSize": 1000,
    "chunkOverlap": 200
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create user security settings table
CREATE TABLE IF NOT EXISTS user_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{
    "enableContentFiltering": true,
    "blockPromptInjection": true,
    "sanitizeOutputs": true,
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 60,
    "maxTokensPerDay": 100000,
    "encryptApiKeys": true,
    "logQueries": false,
    "retentionDays": 30,
    "enableJailbreakDetection": true,
    "requireApiKeyRotation": false,
    "rotationDays": 90,
    "allowedDomains": []
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON user_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_user_retrieval_settings_user_id ON user_retrieval_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- Add RLS policies
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_retrieval_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own API keys
CREATE POLICY "Users can manage their own API keys" ON user_api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only manage their own retrieval settings
CREATE POLICY "Users can manage their own retrieval settings" ON user_retrieval_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only manage their own security settings
CREATE POLICY "Users can manage their own security settings" ON user_security_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at triggers
CREATE TRIGGER update_user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_retrieval_settings_updated_at
  BEFORE UPDATE ON user_retrieval_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_security_settings_updated_at
  BEFORE UPDATE ON user_security_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_api_keys IS 'Stores encrypted API keys for various AI providers per user';
COMMENT ON TABLE user_retrieval_settings IS 'Stores user-specific retrieval and search configuration';
COMMENT ON TABLE user_security_settings IS 'Stores user-specific security and safety configuration';

COMMENT ON COLUMN user_api_keys.api_key IS 'Encrypted API key - should use pgcrypto or vault in production';
COMMENT ON COLUMN user_api_keys.masked_key IS 'Partially masked key for display (e.g., sk-...abc)';
COMMENT ON COLUMN user_retrieval_settings.config IS 'JSON configuration for retrieval pipeline settings';
COMMENT ON COLUMN user_security_settings.config IS 'JSON configuration for security and content filtering settings';