import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Construct database URL from Supabase credentials
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  
  // Extract project ref from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePassword = process.env.SUPABASE_SERVICE_ROLE
  
  if (supabaseUrl && supabasePassword) {
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
    if (projectRef) {
      // Use Supabase pooler connection string
      return `postgresql://postgres.${projectRef}:${supabasePassword}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
    }
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