#!/usr/bin/env bun
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

async function generateMigrations() {
  console.log('🔄 Generating Drizzle migrations from schema...')
  
  try {
    // Generate migration SQL from schema
    const { stdout, stderr } = await execAsync('bunx drizzle-kit generate')
    
    if (stderr && !stderr.includes('warning')) {
      console.error('❌ Error generating migrations:', stderr)
      process.exit(1)
    }
    
    console.log(stdout)
    console.log('✅ Migrations generated successfully')
    
    // Check if migrations folder exists
    const migrationsPath = path.join(process.cwd(), 'drizzle')
    const files = await fs.readdir(migrationsPath)
    const sqlFiles = files.filter(f => f.endsWith('.sql'))
    
    console.log(`📁 Found ${sqlFiles.length} migration files:`)
    sqlFiles.forEach(file => console.log(`  - ${file}`))
    
    // Create a combined migration file for Supabase
    console.log('\n📝 Creating combined migration for Supabase...')
    
    let combinedSql = `-- Combined Drizzle migrations for Supabase
-- Generated on ${new Date().toISOString()}
-- This file combines all Drizzle migrations for easy application to Supabase

`
    
    for (const file of sqlFiles.sort()) {
      const content = await fs.readFile(path.join(migrationsPath, file), 'utf-8')
      combinedSql += `-- Migration: ${file}
-- ----------------------------------------
${content}

`
    }
    
    // Save combined migration
    const outputPath = path.join(process.cwd(), 'supabase', 'migrations', '20250122_drizzle_schema.sql')
    await fs.writeFile(outputPath, combinedSql)
    
    console.log(`✅ Combined migration saved to: ${outputPath}`)
    console.log('\n📋 Next steps:')
    console.log('1. Review the generated migration file')
    console.log('2. Apply to Supabase using: bunx supabase db push')
    console.log('3. Or apply manually in Supabase SQL editor')
    
  } catch (error) {
    console.error('❌ Failed to generate migrations:', error)
    process.exit(1)
  }
}

// Run the script
generateMigrations()