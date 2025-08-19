-- Fix users table to support guest users without auth dependency
-- This migration modifies the users table to allow non-auth users

-- First, drop the foreign key constraint to auth.users
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Modify the id column to be a regular UUID without foreign key
ALTER TABLE users ALTER COLUMN id TYPE UUID;

-- Add email column for guest users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Update RLS policies to support guest users
DROP POLICY IF EXISTS "Users can manage their own user record" ON users;

-- Create new policy that allows both authenticated and guest users
CREATE POLICY "Users can manage their own user record" ON users
  FOR ALL
  USING (
    -- Either the user is authenticated and matches the ID
    (auth.uid() = id) 
    OR 
    -- Or the user is anonymous (for guest users)
    (anonymous = true)
  )
  WITH CHECK (
    -- Either the user is authenticated and matches the ID
    (auth.uid() = id)
    OR
    -- Or the user is being created as anonymous
    (anonymous = true)
  );

-- Add index for email column
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add comment for email column
COMMENT ON COLUMN users.email IS 'User email address (can be pseudo-email for anonymous users)';