/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vitest Configuration for Integration Tests
 * Optimized for database integration tests with longer timeouts
 */

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    environment: 'node', // Node environment for database operations
    globals: true,
    setupFiles: ['./tests/setup.integration.ts'],
    include: [
      '**/tests/repositories/**/*.integration.test.{js,mjs,cjs,ts,mts,cts}',
      '**/tests/acceptance/**/*.acceptance.test.{js,mjs,cjs,ts,mts,cts}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/playwright.config.ts',
      '**/*.spec.ts', // Exclude E2E tests
      '**/tests/unit/**', // Exclude unit tests
      '**/tests/e2e/**' // Exclude E2E tests
    ],
    testTimeout: 30000, // 30 seconds for database operations
    hookTimeout: 15000, // 15 seconds for setup/teardown
    teardownTimeout: 10000,
    maxConcurrency: 3, // Limit concurrent database tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 3,
        minThreads: 1
      }
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: [
        'lib/db/**/*.ts',
        'lib/security/**/*.ts',
        'app/api/**/db.ts',
        'app/api/**/api.ts'
      ],
      exclude: [
        'lib/db/schema.ts', // Schema definitions
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/tests/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        },
        'lib/db/operations.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'lib/security/encryption.ts': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    },
    reporter: [
      'verbose',
      'json',
      'html'
    ],
    outputFile: {
      json: './test-results/integration-results.json',
      html: './test-results/integration-report.html'
    },
    logHeapUsage: true,
    isolate: true, // Isolate tests for database operations
    // Database-specific environment variables
    env: {
      NODE_ENV: 'test',
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: '5432',
      POSTGRES_USER: 'roborail_test',
      POSTGRES_PASSWORD: 'test_password',
      POSTGRES_DB: 'roborail_test',
      ENCRYPTION_KEY: 'test-encryption-key-for-integration-tests-32-chars',
      ENCRYPTION_SALT: 'test-salt-for-integration-tests',
      // Disable external services for integration tests
      LANGSMITH_TRACING: 'false',
      DISABLE_RATE_LIMITING: 'true'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '..'),
      '~': resolve(__dirname, '..')
    }
  },
  esbuild: {
    target: 'node18'
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
})