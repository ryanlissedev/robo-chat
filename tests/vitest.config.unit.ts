/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest Configuration for Unit Tests
 * Optimized for fast, isolated unit tests without external dependencies
 */

export default defineConfig({
  plugins: [],
  test: {
    name: 'unit',
    environment: 'jsdom', // Browser-like environment for React components
    globals: true,
    setupFiles: ['./tests/setup.unit.ts'],
    include: [
      '**/tests/unit/**/*.unit.test.{js,mjs,cjs,ts,mts,cts}',
      '**/*.test.{js,mjs,cjs,ts,mts,cts}' // Include co-located unit tests
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/playwright.config.ts',
      '**/*.spec.ts', // Exclude E2E tests
      '**/tests/repositories/**', // Exclude integration tests
      '**/tests/acceptance/**', // Exclude acceptance tests
      '**/tests/e2e/**' // Exclude E2E tests
    ],
    testTimeout: 5000, // 5 seconds - unit tests should be fast
    hookTimeout: 3000,
    teardownTimeout: 2000,
    maxConcurrency: 10, // Higher concurrency for fast unit tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 6,
        minThreads: 2
      }
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/unit',
      include: [
        'lib/security/**/*.ts',
        'lib/utils/**/*.ts',
        'components/**/*.tsx',
        'app/components/**/*.tsx',
        'lib/validation/**/*.ts',
        'lib/sanitize.ts',
        'lib/utils.ts'
      ],
      exclude: [
        'lib/db/**', // Database operations tested in integration
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/node_modules/**',
        '**/tests/**',
        '**/*.d.ts',
        '**/types/**'
      ],
      thresholds: {
        global: {
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
    reporters: [
      'verbose',
      'json',
      'html'
    ],
    outputFile: {
      json: './test-results/unit-results.json',
      html: './test-results/unit-report.html'
    },
    logHeapUsage: false, // Disable for faster unit tests
    isolate: false, // Allow test reuse for speed
    // Unit test specific environment
    env: {
      NODE_ENV: 'test',
      // Mock external dependencies
      ENCRYPTION_KEY: 'unit-test-encryption-key-32-chars',
      ENCRYPTION_SALT: 'unit-test-salt',
      // Disable external services
      LANGSMITH_TRACING: 'false',
      SUPABASE_URL: 'https://mock.supabase.co',
      SUPABASE_ANON_KEY: 'mock-anon-key',
      OPENAI_API_KEY: 'sk-mock-openai-key-for-unit-tests'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '..'),
      '~': resolve(__dirname, '..')
    }
  },
  esbuild: {
    target: 'es2020'
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    global: 'globalThis'
  }
})