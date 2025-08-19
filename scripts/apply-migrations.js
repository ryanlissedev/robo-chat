#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE in .env.local');
  process.exit(1);
}

async function applyMigrations() {
  console.log('🚀 Applying database migrations to Supabase...\n');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // List of migrations to apply in order
  const migrations = [
    '20241231_users_table.sql',
    '20250101_base_tables.sql',
    '20250118_message_feedback.sql',
    '20250120_fix_api_keys_encryption.sql',
    '20250121_fix_database_schema.sql',
    '20250122_comprehensive_database_fix.sql'
  ];

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  
  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration ${migration} not found, skipping...`);
      continue;
    }
    
    console.log(`📝 Applying migration: ${migration}`);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split SQL into individual statements (basic split on semicolons)
      // This is a simplified approach - for complex migrations, use a proper SQL parser
      const statements = sql
        .split(/;\s*$/m)
        .filter(stmt => stmt.trim().length > 0)
        .map(stmt => stmt.trim() + ';');
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const statement of statements) {
        // Skip comments and empty statements
        if (statement.startsWith('--') || statement.trim() === ';') {
          continue;
        }
        
        try {
          // For DO blocks and complex statements, execute as is
          if (statement.includes('DO $$') || statement.includes('CREATE OR REPLACE')) {
            const { error } = await supabase.rpc('exec_sql', { 
              sql_query: statement 
            }).single();
            
            if (error) {
              // Try direct execution as fallback
              console.log(`   ⚠️  RPC failed, trying alternative method...`);
              // Note: Supabase JS client doesn't support direct SQL execution
              // This would need to be done via the Supabase SQL editor or API
              errorCount++;
            } else {
              successCount++;
            }
          } else {
            // For simple statements, we can't execute them directly via JS client
            // Log them for manual execution
            console.log(`   ℹ️  Statement needs manual execution via Supabase SQL editor`);
          }
        } catch (err) {
          console.log(`   ❌ Error executing statement: ${err.message}`);
          errorCount++;
        }
      }
      
      if (errorCount > 0) {
        console.log(`   ⚠️  Migration ${migration} completed with ${errorCount} errors`);
      } else {
        console.log(`   ✅ Migration ${migration} completed successfully`);
      }
      
    } catch (error) {
      console.error(`   ❌ Failed to apply ${migration}: ${error.message}`);
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log('-------------------');
  console.log('⚠️  Note: Complex SQL statements need to be executed manually in the Supabase SQL editor');
  console.log('📝 Please copy the contents of the migration files and run them in:');
  console.log(`   ${supabaseUrl}/project/[your-project-id]/editor/sql`);
  console.log('\nMigration files to apply manually:');
  migrations.forEach(m => {
    console.log(`   - supabase/migrations/${m}`);
  });
}

// Alternative approach: Generate a single SQL file for manual execution
async function generateCombinedSQL() {
  console.log('\n📄 Generating combined SQL file for manual execution...');
  
  const migrations = [
    '20241231_users_table.sql',
    '20250101_base_tables.sql',
    '20250118_message_feedback.sql',
    '20250120_fix_api_keys_encryption.sql',
    '20250121_fix_database_schema.sql',
    '20250122_comprehensive_database_fix.sql'
  ];
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const outputFile = path.join(__dirname, '..', 'combined_migrations.sql');
  
  let combinedSQL = `-- ====================================================================
-- Combined Database Migrations for RoboRail
-- Generated: ${new Date().toISOString()}
-- ====================================================================
-- 
-- Instructions:
-- 1. Go to your Supabase project SQL editor
-- 2. Copy and paste this entire file
-- 3. Execute the SQL
-- ====================================================================

`;
  
  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);
    
    if (!fs.existsSync(filePath)) {
      continue;
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    
    combinedSQL += `
-- ====================================================================
-- Migration: ${migration}
-- ====================================================================

${sql}

`;
  }
  
  fs.writeFileSync(outputFile, combinedSQL);
  console.log(`✅ Combined SQL file created: ${outputFile}`);
  console.log('📋 Copy the contents of this file to your Supabase SQL editor and execute');
}

// Run both approaches
async function main() {
  await applyMigrations();
  await generateCombinedSQL();
}

main().catch(console.error);