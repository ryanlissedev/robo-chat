import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { TestDatabaseManager } from './utils/test-database'
import '@testing-library/jest-dom'

/**
 * Integration Test Setup
 * Configures database connections and global test environment
 */

// Global test database manager
let globalTestDb: any = null

// Setup global test environment
beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...')
  
  // Validate required environment variables
  const requiredEnvVars = [
    'ENCRYPTION_KEY',
    'ENCRYPTION_SALT'
  ]
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }
  
  // Set up default test database for global operations
  try {
    globalTestDb = await TestDatabaseManager.createInstance('global-integration')
    console.log('✅ Global test database initialized')
  } catch (error) {
    console.error('❌ Failed to initialize global test database:', error)
    throw error
  }
  
  // Configure global test settings - use defineProperty for read-only properties
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true
  })
  process.env.DISABLE_RATE_LIMITING = 'true'
  process.env.LANGSMITH_TRACING = 'false'
  
  console.log('✅ Integration test environment ready')
}, 60000) // 60 second timeout for database setup

// Cleanup global test environment
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...')
  
  try {
    await TestDatabaseManager.destroyAll()
    console.log('✅ All test databases destroyed')
  } catch (error) {
    console.error('❌ Error during test database cleanup:', error)
  }
  
  console.log('✅ Integration test cleanup complete')
}, 30000)

// Reset test data before each test
beforeEach(async () => {
  // Individual tests should create their own database instances
  // This ensures test isolation
}, 5000)

// Cleanup after each test
afterEach(async () => {
  // Individual test cleanup happens in test files
  // This ensures proper test isolation
}, 5000)

// Global error handlers for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  process.exit(1)
})

// Test utilities available globally
declare global {
  var testUtils: {
    // Common utilities shared between unit and integration tests
    delay: (ms: number) => Promise<void>
    randomId: () => string
    mockTimestamp: (offset?: number) => Date
    // Unit test specific utilities (optional for integration tests)
    createMockUser?: () => any
    createMockChat?: () => any
    createMockMessage?: () => any
    waitFor?: (fn: () => boolean, timeout?: number) => Promise<void>
    mockApiResponse?: (data: any, options?: { status?: number; delay?: number }) => void
  }
}

globalThis.testUtils = {
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  randomId: () => Math.random().toString(36).substr(2, 9),
  
  mockTimestamp: (offset: number = 0) => new Date(Date.now() + offset)
}

export {}