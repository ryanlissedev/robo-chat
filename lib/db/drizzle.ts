import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Get database URL from environment
const getDatabaseUrl = () => {
  // First try DATABASE_URL or POSTGRES_URL (both are valid)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL
  }
  
  // Build from Supabase URL if available
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
    
    if (projectRef) {
      // Check for database password (not service role key)
      const password = process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || process.env.SUPABASE_DB_PASSWORD
      
      if (password) {
        // Use pooler endpoint for connection pooling (eu-central-1 for your project)
        return `postgresql://postgres.${projectRef}:${password}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`
      } else {
        console.warn('No database password found. Database connection may fail.')
      }
    }
  }
  
  // Fallback to local development
  return 'postgresql://postgres:postgres@localhost:54322/postgres'
}

// Create the connection
const connectionString = getDatabaseUrl()

// Check if database is actually configured
const isDatabaseConfigured = () => {
  return !!(
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL ||
    process.env.DATABASE_PASSWORD ||
    process.env.POSTGRES_PASSWORD
  )
}

// Only create database connection if configured
let db: any

if (isDatabaseConfigured()) {
  try {
    // Postgres.js connection
    const client = postgres(connectionString, {
      max: 1,
      prepare: false,
      ssl: connectionString.includes('supabase.com') ? 'require' : false,
      connection: {
        application_name: 'roborail'
      },
      onnotice: () => {}, // Suppress notices
    })

    // Drizzle instance with schema
    db = drizzle(client, { schema })
  } catch (error) {
    console.warn('Failed to initialize database connection:', error)
    // Create a mock db that returns safe defaults
    db = createMockDb()
  }
} else {
  console.warn('Database not configured. Using mock database.')
  db = createMockDb()
}

// Create a mock database for when real DB is not available
function createMockDb() {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => ({
            limit: () => Promise.resolve([])
          })
        }),
        limit: () => Promise.resolve([]),
        orderBy: () => ({
          limit: () => Promise.resolve([])
        })
      })
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{
          id: 'mock-' + Date.now(),
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      })
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve({ changes: 0 })
      })
    }),
    delete: () => ({
      where: () => Promise.resolve({ changes: 0 })
    })
  }
}

export { db }

// Export the type for use in other files
export type DbType = typeof db

// Helper functions for common operations
export * from './operations'