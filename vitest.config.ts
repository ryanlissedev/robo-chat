/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { getCoverageConfig } from './tests/coverage.config';

const ENCRYPTION_KEY_LENGTH = 32;

export default defineConfig({
  plugins: [],
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  test: {
    // Allow CSS imports to be processed by Vite in tests
    css: true,

    environment: 'jsdom',
    // Enhanced timeout configuration
    testTimeout: 15000, // 15 seconds for individual tests
    hookTimeout: 10000, // 10 seconds for hooks
    teardownTimeout: 5000, // 5 seconds for cleanup
    setupFiles: ['./tests/setup.ts'],
    // Handle CSS imports in tests
    // Add server configuration for better module resolution
    server: {
      deps: {
        inline: [
          '@testing-library/react',
          '@testing-library/jest-dom',
          'framer-motion',
        ],
      },
    },
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
    ],
    coverage: getCoverageConfig(
      process.env.NODE_ENV === 'production'
        ? 'production'
        : process.env.CI === '1'
          ? 'ci'
          : 'development'
    ),
    // Pool configuration for better performance and stability
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: process.env.CI === '1', // Use single thread in CI for stability
        useAtomics: true,
        minThreads: 1,
        maxThreads: process.env.CI === '1' ? 1 : 4,
        isolate: true, // Isolate tests for better reliability
      },
    },
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    // Improve test stability
    retry: process.env.CI ? 2 : 0, // Retry failed tests in CI
    // Add CSS module mocking - moved to top level
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '~': path.resolve(__dirname, '.'),
      'ai/react': '@ai-sdk/react',
      // Some environments mis-resolve ai/react; ensure explicit mapping.
      // Do NOT alias bare 'ai' here to avoid breaking non-react imports.
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
});
