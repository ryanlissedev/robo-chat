-- ====================================================================
-- Fix Foreign Key Constraints for Guest Users
-- Date: 2025-08-19
-- Purpose: Update foreign key constraints to allow guest users
-- ====================================================================

-- 1. Drop existing foreign key constraints
-- --------------------------------------------------------------------
ALTER TABLE chats DROP CONSTRAINT IF EXISTS fk_chats_user;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_user;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_chat_id_fkey;

-- 2. Re-add foreign key constraints with NO ACTION on delete
-- This allows records to exist without corresponding user records
-- --------------------------------------------------------------------
ALTER TABLE chats 
  ADD CONSTRAINT fk_chats_user 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE messages 
  ADD CONSTRAINT fk_messages_user 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE messages 
  ADD CONSTRAINT messages_chat_id_fkey 
  FOREIGN KEY (chat_id) 
  REFERENCES chats(id) 
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- 3. Create a trigger to auto-create guest users when needed
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_create_guest_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id) THEN
    -- Create a minimal guest user record
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers on chats and messages tables
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS ensure_user_exists_on_chat ON chats;
CREATE TRIGGER ensure_user_exists_on_chat
  BEFORE INSERT ON chats
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_guest_user();

DROP TRIGGER IF EXISTS ensure_user_exists_on_message ON messages;
CREATE TRIGGER ensure_user_exists_on_message
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_guest_user();