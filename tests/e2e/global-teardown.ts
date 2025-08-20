import { FullConfig } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...')

  try {
    // Clean up any temporary files created during tests
    const tempFiles = [
      './tests/e2e/auth.json',
      './playwright-test-results',
      './test-results'
    ]

    for (const file of tempFiles) {
      try {
        const fullPath = path.resolve(file)
        const stats = await fs.stat(fullPath)
        
        if (stats.isDirectory()) {
          // Remove directory recursively if it exists and is empty
          const files = await fs.readdir(fullPath)
          if (files.length === 0) {
            await fs.rmdir(fullPath)
            console.log(`🗑️  Removed empty directory: ${file}`)
          }
        } else {
          await fs.unlink(fullPath)
          console.log(`🗑️  Removed file: ${file}`)
        }
      } catch (error) {
        // File doesn't exist or can't be removed, that's okay
      }
    }

    // Reset any global state if necessary
    // For example, clearing test databases, resetting external services, etc.

    console.log('✅ E2E test environment cleanup completed')

  } catch (error) {
    console.error('❌ Failed to clean up E2E environment:', error)
    // Don't throw here as cleanup failures shouldn't fail the test run
  }
}

export default globalTeardown