# RoboRail Database Migration Instructions

## ✅ Completed Work

### 1. Drizzle ORM Integration
- ✅ Installed Drizzle ORM and dependencies
- ✅ Created complete schema definitions in `lib/db/schema.ts`
- ✅ Set up database connection in `lib/db/drizzle.ts`
- ✅ Created type-safe operations in `lib/db/operations.ts`
- ✅ Fixed guest user ID validation issue with consistent behavior

### 2. Migration Files Created
- ✅ `supabase/migrations/20250122_drizzle_complete_schema.sql` - Complete schema with all fixes

## 📋 Manual Steps Required

### Step 1: Apply Migration to Supabase

**Option A: Using Supabase Dashboard (Recommended)**
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `supabase/migrations/20250122_drizzle_complete_schema.sql`
4. Paste into the SQL editor
5. Click "Run" to execute

**Option B: Using Supabase CLI**
```bash
# Make sure you're logged in to Supabase
bunx supabase login

# Link to your project (if not already linked)
bunx supabase link --project-ref <your-project-ref>

# Apply the migration
bunx supabase db push
```

### Step 2: Verify Migration Success
Run this query in Supabase SQL editor to verify all columns exist:
```sql
-- Check users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check chats table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chats'
ORDER BY ordinal_position;

-- Verify foreign key constraints
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('chats', 'messages', 'message_feedback', 'api_keys');
```

### Step 3: Test the Application
```bash
# Run the development server
bun run dev

# In another terminal, run E2E tests
bunx playwright test tests/chat.spec.ts --headed
```

## 🎯 What Was Fixed

### Guest User ID Validation
**Before:** Inconsistent validation between development and production
**After:** Unified validation using Drizzle ORM with graceful fallbacks

### Database Type Safety
**Before:** Mixed Supabase client types causing errors
**After:** Strongly typed operations with Drizzle schema

### Missing Columns
**Before:** Missing `favorite_models`, `anonymous`, `model`, `public` columns
**After:** All columns added with proper defaults

### Foreign Key Constraints
**Before:** References to non-existent `auth.users` table
**After:** Correct references to `users` table

## 🔄 Next Steps After Migration

1. **Test Guest User Flow:**
   - Open incognito browser
   - Navigate to the app
   - Send a message without logging in
   - Verify it works without errors

2. **Test Authenticated User Flow:**
   - Sign up/Log in
   - Send messages
   - Verify rate limiting works

3. **Test API Key Management:**
   - Go to Settings
   - Add API keys for different providers
   - Test that models from those providers become available

## 📝 Notes

- The migration is idempotent - it can be run multiple times safely
- All changes are backward compatible
- RLS policies are included for security
- Triggers are set up for automatic `updated_at` timestamps

## 🚨 Troubleshooting

If you encounter errors:

1. **"relation already exists"** - This is safe, the migration handles existing tables
2. **"permission denied"** - Make sure you're using the service role key
3. **"column already exists"** - This is handled by the DO blocks, safe to ignore

For any issues, check:
- Supabase logs in the dashboard
- Browser console for client-side errors
- Terminal output for server-side errors