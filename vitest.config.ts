/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const ENCRYPTION_KEY_LENGTH = 32;

// Simplified base configuration for reliable testing
const baseConfig = {
  plugins: [],
  css: {
    // Disable CSS modules for simpler testing
    modules: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '~': path.resolve(__dirname, '.'),
      'ai/react': '@ai-sdk/react',
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://localhost:54321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"test-anon-key"',
    'process.env.ENCRYPTION_KEY': `"${Buffer.from('a'.repeat(ENCRYPTION_KEY_LENGTH)).toString('base64')}"`,
  },
};

// Determine test type based on environment variables
const testType = process.env.TEST_TYPE || 'standard';
const isCI = process.env.CI === '1';

// Single, reliable test configuration
const getTestConfig = () => {
  const baseTestConfig = {
    // Use happy-dom for faster, more reliable testing
    environment: 'happy-dom' as const,
    testTimeout: testType === 'integration' ? 30000 : 10000,
    hookTimeout: testType === 'integration' ? 15000 : 5000,
    teardownTimeout: testType === 'integration' ? 5000 : 2000,
    slowTestThreshold: 2000,
    setupFiles: ['./tests/setup.ts'],
    globals: true,

    // Include/exclude patterns based on test type
    include: testType === 'unit'
      ? ['tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
      : testType === 'integration'
      ? ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
      : [
          'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          '**/__tests__/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
        ],

    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/e2e/**',
      'playwright-tests/**',
      '**/test-*.{js,ts,html}',
      '**/*.stories.*',
      '**/*.spec.ts',
    ],

    // Optimized pool configuration for reliability
    pool: 'threads' as const,
    poolOptions: {
      threads: {
        singleThread: isCI || testType === 'integration',
        useAtomics: true,
        minThreads: 1,
        maxThreads: isCI ? 2 : (testType === 'integration' ? 1 : 4),
        isolate: true,
      },
    },

    // Mock and cleanup settings
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,

    // Dependencies that need to be inlined
    server: {
      deps: {
        inline: [
          '@testing-library/react',
          '@testing-library/jest-dom/vitest',
          '@supabase/supabase-js',
          '@supabase/ssr',
          'framer-motion',
          'motion/react',
        ],
      },
    },

    // Execution settings
    retry: 0, // No retries for faster feedback
    sequence: {
      shuffle: false,
      concurrent: !isCI && testType !== 'integration',
    },

    // Coverage settings
    coverage: {
      enabled: process.env.COVERAGE === '1',
      provider: 'v8' as const,
      reporter: ['text', 'json-summary', 'html'],
      all: false,
      skipFull: true,
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/.*',
      ],
    },

    // Reporter configuration
    reporters: process.env.CI ? ['verbose', 'json'] : ['default'],
  };

  return baseTestConfig;
};

export default defineConfig({
  ...baseConfig,
  // Force Node.js runtime to ensure vi.mock compatibility
  esbuild: {
    target: 'node14',
  },
  test: getTestConfig(),
});
