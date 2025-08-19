-- ====================================================================
-- Schema Validation and Integrity Check for RoboRail
-- Date: 2025-01-24
-- Purpose: Validate that all required tables, columns, and constraints exist
-- ====================================================================

-- This is a validation-only migration that checks schema integrity
-- It will raise warnings if any expected schema elements are missing

DO $$
DECLARE
    missing_items TEXT := '';
    warning_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting RoboRail database schema validation...';
    
    -- 1. Validate core tables exist
    -- --------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        missing_items := missing_items || 'Missing table: users; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats') THEN
        missing_items := missing_items || 'Missing table: chats; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
        missing_items := missing_items || 'Missing table: messages; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') THEN
        missing_items := missing_items || 'Missing table: projects; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_attachments') THEN
        missing_items := missing_items || 'Missing table: chat_attachments; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_feedback') THEN
        missing_items := missing_items || 'Missing table: message_feedback; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback') THEN
        missing_items := missing_items || 'Missing table: feedback; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_keys') THEN
        missing_items := missing_items || 'Missing table: user_keys; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') THEN
        missing_items := missing_items || 'Missing table: user_preferences; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_security_settings') THEN
        missing_items := missing_items || 'Missing table: user_security_settings; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_retrieval_settings') THEN
        missing_items := missing_items || 'Missing table: user_retrieval_settings; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_key_audit_log') THEN
        missing_items := missing_items || 'Missing table: api_key_audit_log; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 2. Validate critical columns in users table
    -- --------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
        missing_items := missing_items || 'Missing column: users.email; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        missing_items := missing_items || 'Missing column: users.display_name; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'favorite_models') THEN
        missing_items := missing_items || 'Missing column: users.favorite_models; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'anonymous') THEN
        missing_items := missing_items || 'Missing column: users.anonymous; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 3. Validate critical columns in chats table
    -- --------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'model') THEN
        missing_items := missing_items || 'Missing column: chats.model; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'public') THEN
        missing_items := missing_items || 'Missing column: chats.public; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'project_id') THEN
        missing_items := missing_items || 'Missing column: chats.project_id; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 4. Validate messages table columns
    -- --------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'langsmith_run_id') THEN
        missing_items := missing_items || 'Missing column: messages.langsmith_run_id; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'reasoning_effort') THEN
        missing_items := missing_items || 'Missing column: messages.reasoning_effort; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 5. Validate critical foreign key constraints
    -- --------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'chats_user_id_fkey'
        AND unique_constraint_schema = 'public'
    ) THEN
        missing_items := missing_items || 'Missing FK: chats_user_id_fkey to users; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'messages_chat_id_fkey'
    ) THEN
        missing_items := missing_items || 'Missing FK: messages_chat_id_fkey to chats; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'message_feedback_message_id_fkey'
    ) THEN
        missing_items := missing_items || 'Missing FK: message_feedback_message_id_fkey to messages; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints 
        WHERE constraint_name = 'user_keys_user_id_fkey'
    ) THEN
        missing_items := missing_items || 'Missing FK: user_keys_user_id_fkey to users; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 6. Check RLS is enabled on sensitive tables
    -- --------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'users' AND rowsecurity = true
    ) THEN
        missing_items := missing_items || 'RLS not enabled on users table; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'chats' AND rowsecurity = true
    ) THEN
        missing_items := missing_items || 'RLS not enabled on chats table; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'messages' AND rowsecurity = true
    ) THEN
        missing_items := missing_items || 'RLS not enabled on messages table; ';
        warning_count := warning_count + 1;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'user_keys' AND rowsecurity = true
    ) THEN
        missing_items := missing_items || 'RLS not enabled on user_keys table; ';
        warning_count := warning_count + 1;
    END IF;
    
    -- 7. Report validation results
    -- --------------------------------------------------------------------
    IF warning_count = 0 THEN
        RAISE NOTICE '✅ Schema validation PASSED - All required tables, columns, and constraints are present';
        RAISE NOTICE 'Database schema is ready for RoboRail application';
    ELSE
        RAISE WARNING '⚠️ Schema validation found % issues: %', warning_count, missing_items;
        RAISE WARNING 'Please run the previous migrations to fix these issues';
    END IF;
    
    -- 8. Validate data integrity
    -- --------------------------------------------------------------------
    DECLARE
        orphaned_chats INTEGER;
        orphaned_messages INTEGER;
        orphaned_attachments INTEGER;
    BEGIN
        -- Check for orphaned chats
        SELECT COUNT(*) INTO orphaned_chats
        FROM chats c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id);
        
        IF orphaned_chats > 0 THEN
            RAISE WARNING 'Found % orphaned chats without valid user references', orphaned_chats;
        END IF;
        
        -- Check for orphaned messages  
        SELECT COUNT(*) INTO orphaned_messages
        FROM messages m
        WHERE NOT EXISTS (SELECT 1 FROM chats c WHERE c.id = m.chat_id);
        
        IF orphaned_messages > 0 THEN
            RAISE WARNING 'Found % orphaned messages without valid chat references', orphaned_messages;
        END IF;
        
        -- Check for orphaned attachments
        SELECT COUNT(*) INTO orphaned_attachments
        FROM chat_attachments ca
        WHERE NOT EXISTS (SELECT 1 FROM chats c WHERE c.id = ca.chat_id);
        
        IF orphaned_attachments > 0 THEN
            RAISE WARNING 'Found % orphaned attachments without valid chat references', orphaned_attachments;
        END IF;
        
        IF orphaned_chats = 0 AND orphaned_messages = 0 AND orphaned_attachments = 0 THEN
            RAISE NOTICE '✅ Data integrity check PASSED - No orphaned records found';
        END IF;
    END;
    
    RAISE NOTICE 'Schema validation complete';
END $$;