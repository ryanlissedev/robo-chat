import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      classNameStrategy: 'non-scoped'
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    // Add server configuration for better module resolution
    server: {
      deps: {
        inline: ['@testing-library/react'],
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'next.config.*',
        '.next/',
        'dist/',
        'coverage/',
        '**/*.test.*',
        '**/*.spec.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Pool configuration for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '~': path.resolve(__dirname, '.'),
      'ai/react': '@ai-sdk/react',
      // Some environments mis-resolve ai/react; ensure explicit mapping.
      // Do NOT alias bare 'ai' here to avoid breaking non-react imports.
    },
  },
  // Handle CSS and static assets in tests
  assetsInclude: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
  define: {
    // Define environment variables for tests
    'process.env.NODE_ENV': '"test"',
    'process.env.NEXT_PUBLIC_SUPABASE_URL': '"http://localhost:54321"',
    'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': '"test-anon-key"',
    'process.env.ENCRYPTION_KEY': `"${Buffer.from('a'.repeat(32)).toString('base64')}"`,
  },
});
