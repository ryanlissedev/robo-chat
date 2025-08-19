-- ====================================================================
-- Fix Messages Table for Guest Users
-- Date: 2025-08-19
-- Purpose: Allow messages without user_id for guest users
-- ====================================================================

-- 1. Make user_id nullable in messages table
-- --------------------------------------------------------------------
ALTER TABLE messages 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Update the trigger to handle messages without user_id
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_user_for_message()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id is provided and user doesn't exist, create guest user
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    INSERT INTO users (id, email, anonymous, message_count, daily_message_count, created_at, updated_at)
    VALUES (
      NEW.user_id,
      NEW.user_id::TEXT || '@guest.local',
      true,
      0,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  -- Extract user_id from chat if not provided
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM chats 
    WHERE id = NEW.chat_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Replace the trigger
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS ensure_user_exists_on_message ON messages;
CREATE TRIGGER ensure_user_for_message_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_for_message();