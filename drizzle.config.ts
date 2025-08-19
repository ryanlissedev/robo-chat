import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Construct database URL from Supabase credentials
const getDatabaseUrl = () => {
  // Use DATABASE_URL if available (priority)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  
  // Use POSTGRES_URL if available
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL
  }
  
  // Construct from individual components
  const postgresHost = process.env.POSTGRES_HOST
  const postgresUser = process.env.POSTGRES_USER
  const postgresPassword = process.env.POSTGRES_PASSWORD
  const postgresDatabase = process.env.POSTGRES_DATABASE
  
  if (postgresHost && postgresUser && postgresPassword && postgresDatabase) {
    // Use pooler connection for better performance
    return `postgresql://${postgresUser}.dsvcopetgolgetouoqxk:${postgresPassword}@aws-1-eu-central-1.pooler.supabase.com:6543/${postgresDatabase}?sslmode=require`
  }
  
  // Fallback for local development
  return 'postgresql://postgres:postgres@localhost:54322/postgres'
}

export default defineConfig({
  out: './drizzle',
  schema: './lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  verbose: true,
  strict: true,
})