import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Get database URL from environment
const getDatabaseUrl = () => {
  // First try DATABASE_URL
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  
  // Build from Supabase URL if available
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
    
    if (projectRef) {
      // Construct PostgreSQL connection string
      return `postgresql://postgres.${projectRef}:${process.env.SUPABASE_SERVICE_ROLE}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
    }
  }
  
  // Fallback to local development
  return 'postgresql://postgres:postgres@localhost:54322/postgres'
}

// Create the connection
const connectionString = getDatabaseUrl()

// Postgres.js connection
const client = postgres(connectionString, {
  max: 1,
  prepare: false,
})

// Drizzle instance with schema
export const db = drizzle(client, { schema })

// Export the type for use in other files
export type DbType = typeof db

// Helper functions for common operations
export * from './operations'