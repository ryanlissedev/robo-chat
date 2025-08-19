#!/usr/bin/env node

// Direct PostgreSQL connection to create users table
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING environment variable');
  process.exit(1);
}

async function createUsersTable() {
  console.log('🔧 Creating users table via direct PostgreSQL connection...');
  
  // Use node-postgres directly without SSL verification for local development
  const { Client } = require('pg');
  
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false  // Allow self-signed certificates for Supabase
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // First check if table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('✅ Users table already exists');
      
      // Check if it has the right columns
      const checkColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
        ORDER BY column_name;
      `);
      
      const columns = checkColumns.rows.map(row => row.column_name);
      console.log('📋 Current columns:', columns.join(', '));
      
      const requiredColumns = ['message_count', 'daily_message_count', 'anonymous', 'premium'];
      const missingColumns = requiredColumns.filter(col => !columns.includes(col));
      
      if (missingColumns.length > 0) {
        console.log('⚠️  Missing columns:', missingColumns.join(', '));
        console.log('Adding missing columns...');
        
        for (const column of missingColumns) {
          try {
            let alterQuery = '';
            switch (column) {
              case 'message_count':
                alterQuery = 'ALTER TABLE public.users ADD COLUMN message_count INTEGER DEFAULT 0';
                break;
              case 'daily_message_count':
                alterQuery = 'ALTER TABLE public.users ADD COLUMN daily_message_count INTEGER DEFAULT 0';
                break;
              case 'anonymous':
                alterQuery = 'ALTER TABLE public.users ADD COLUMN anonymous BOOLEAN DEFAULT FALSE';
                break;
              case 'premium':
                alterQuery = 'ALTER TABLE public.users ADD COLUMN premium BOOLEAN DEFAULT FALSE';
                break;
            }
            
            if (alterQuery) {
              await client.query(alterQuery);
              console.log(`✅ Added column: ${column}`);
            }
          } catch (err) {
            console.log(`⚠️  Failed to add column ${column}:`, err.message);
          }
        }
      } else {
        console.log('✅ All required columns present');
      }
      
    } else {
      console.log('Creating new users table...');
      
      const createTableSQL = `
        CREATE TABLE public.users (
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
      `;
      
      await client.query(createTableSQL);
      console.log('✅ Users table created');
      
      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_users_anonymous ON public.users(anonymous)',
        'CREATE INDEX IF NOT EXISTS idx_users_premium ON public.users(premium)',
        'CREATE INDEX IF NOT EXISTS idx_users_daily_reset ON public.users(daily_reset)'
      ];
      
      for (const index of indexes) {
        try {
          await client.query(index);
        } catch (err) {
          console.log('Index creation warning:', err.message);
        }
      }
      
      console.log('✅ Indexes created');
    }
    
    // Test basic functionality
    console.log('Testing table access...');
    const testQuery = await client.query('SELECT COUNT(*) as count FROM public.users');
    console.log(`✅ Users table accessible, current count: ${testQuery.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createUsersTable().then(() => {
  console.log('🎉 Database setup completed');
}).catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});