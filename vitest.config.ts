/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { getCoverageConfig } from './tests/coverage.config';

const ENCRYPTION_KEY_LENGTH = 32;

// Base configuration optimized for all test scenarios
const baseConfig = {
  plugins: [],
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '~': path.resolve(__dirname, '.'),
      'ai/react': '@ai-sdk/react',
      // Mock CSS imports that cause resolution issues
      'tailwindcss/tailwind.css': path.resolve(
        __dirname,
        'tests/mocks/empty.css'
      ),
      'katex/dist/katex.min.css': path.resolve(
        __dirname,
        'tests/mocks/empty.css'
      ),
    },
  },
  define: {
    // Define environment variables for tests - handle readonly NODE_ENV
    ...(process.env.NODE_ENV !== 'test' && {
      'process.env.NODE_ENV': '"test"',
    }),
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://localhost:54321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"test-anon-key"',
    'process.env.ENCRYPTION_KEY': `"${Buffer.from('a'.repeat(ENCRYPTION_KEY_LENGTH)).toString('base64')}"`,
  },
};

// Optimized test configurations
const testConfigs = {
  // Standard configuration optimized for stability and performance
  standard: {
    css: true,
    environment: 'jsdom' as const,
    testTimeout: 15000, // Reduced from 20000 for faster feedback
    hookTimeout: 10000, // Reduced from 15000
    teardownTimeout: 5000, // Reduced from 10000
    slowTestThreshold: 3000, // Reduced for better performance tracking
    setupFiles: ['./tests/setup.ts'],
    server: {
      deps: {
        inline: [
          '@testing-library/react',
          '@testing-library/jest-dom/vitest',
          'framer-motion',
        ],
      },
    },
    globals: true,
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**',
      'playwright-tests/**',
      '**/test-*.{js,ts,html}', // Exclude debug test files
      '**/*.stories.*',
    ],
    coverage: getCoverageConfig(
      process.env.NODE_ENV === 'production'
        ? 'production'
        : process.env.CI === '1'
          ? 'ci'
          : 'development'
    ),
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        singleThread: process.env.CI === '1', // Single thread in CI for stability
        useAtomics: true,
        minThreads: process.env.CI === '1' ? 1 : 2,
        maxThreads: process.env.CI === '1' ? 2 : Math.min(6, 4), // Reduced for stability
        isolate: true,
      },
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    isolate: true,
    retry: process.env.CI ? 1 : 0, // Reduced retries
    sequence: {
      shuffle: false, // Disable shuffle for consistency
      concurrent: !process.env.CI, // Sequential in CI
      setupFiles: 'parallel' as const,
    },
  },

  // Fast configuration for unit tests
  fast: {
    css: false,
    environment: 'happy-dom' as const,
    testTimeout: 5000,
    hookTimeout: 3000,
    teardownTimeout: 1000,
    setupFiles: ['./tests/setup.ts'], // Use unified setup
    server: {
      deps: {
        inline: [
          '@testing-library/react',
          '@testing-library/jest-dom/vitest',
          'framer-motion',
        ],
      },
    },
    globals: true,
    include: ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**',
      'tests/integration/**',
      'playwright-tests/**',
      '**/test-*.{js,ts,html}',
      'tests/unit/**/voice-*.test.*', // Exclude slow tests
      'tests/unit/**/*integration*.test.*',
      'tests/unit/**/*slow*.test.*',
    ],
    coverage: {
      enabled: false,
    },
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true,
        minThreads: 1,
        maxThreads: 4, // Reduced for fast mode
        isolate: false, // Faster without isolation
      },
    },
    mockReset: false, // Skip for speed
    clearMocks: true,
    restoreMocks: false,
    retry: 0,
    reporters: [
      [
        'default',
        {
          summary: false,
        },
      ],
    ],
    sequence: {
      concurrent: true,
    },
  },

  // Integration test configuration
  integration: {
    css: true,
    environment: 'jsdom' as const,
    testTimeout: 30000, // Longer for API calls
    hookTimeout: 20000, // Longer for setup/teardown
    teardownTimeout: 10000,
    setupFiles: ['./tests/setup.ts', './tests/supabase-test-setup.ts'],
    server: {
      deps: {
        inline: [
          '@testing-library/react',
          '@testing-library/jest-dom/vitest',
          'framer-motion',
          '@supabase/supabase-js',
          '@ai-sdk/react',
        ],
      },
    },
    globals: true,
    include: [
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**',
      'tests/unit/**',
      'playwright-tests/**',
      '**/test-*.{js,ts,html}',
    ],
    coverage: {
      enabled: false, // Disable for integration tests
    },
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        singleThread: true, // Sequential for DB consistency
        useAtomics: true,
        minThreads: 1,
        maxThreads: 1,
        isolate: true,
      },
    },
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    retry: process.env.CI ? 2 : 1,
    sequence: {
      concurrent: false, // Sequential execution for stability
    },
  },
};

// Determine configuration based on environment
const getTestConfig = () => {
  const testType = process.env.TEST_TYPE || 'standard';

  switch (testType) {
    case 'fast':
    case 'unit':
      return testConfigs.fast;
    case 'integration':
      return testConfigs.integration;
    case 'standard':
    default:
      return testConfigs.standard;
  }
};

export default defineConfig({
  ...baseConfig,
  test: getTestConfig(),
});
