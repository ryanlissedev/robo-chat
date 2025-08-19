-- Create users table for tracking usage and user preferences
-- This table supplements auth.users with application-specific data

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  message_count INTEGER DEFAULT 0,
  daily_message_count INTEGER DEFAULT 0,
  daily_reset TIMESTAMPTZ DEFAULT NOW(),
  anonymous BOOLEAN DEFAULT FALSE,
  premium BOOLEAN DEFAULT FALSE,
  daily_pro_message_count INTEGER DEFAULT 0,
  daily_pro_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_anonymous ON users(anonymous);
CREATE INDEX IF NOT EXISTS idx_users_premium ON users(premium);
CREATE INDEX IF NOT EXISTS idx_users_daily_reset ON users(daily_reset);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies for users table
CREATE POLICY "Users can manage their own user record" ON users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add updated_at trigger
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE users IS 'User application data and usage tracking';
COMMENT ON COLUMN users.message_count IS 'Total messages sent by user';
COMMENT ON COLUMN users.daily_message_count IS 'Messages sent today';
COMMENT ON COLUMN users.daily_reset IS 'Last daily reset timestamp';
COMMENT ON COLUMN users.anonymous IS 'Whether user is anonymous/guest';
COMMENT ON COLUMN users.premium IS 'Whether user has premium subscription';