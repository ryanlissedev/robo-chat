/**
 * Bun Test Configuration
 * Replaces vitest with bun's native test runner for better performance and reliability
 */

export default {
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/*.test.ts',
    '**/*.spec.ts',
  ],

  // Exclude patterns
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/playwright.config.ts',
  ],

  // Setup files
  preload: ['./tests/setup.bun.ts'],

  // Timeout settings
  timeout: 5000, // 5 seconds per test

  // Coverage settings
  coverage: {
    enabled: true,
    reporter: ['text', 'json', 'html'],
    dir: './coverage',
    include: ['lib/**/*.ts', 'app/**/*.ts', 'components/**/*.tsx'],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/node_modules/**',
      '**/tests/**',
      '**/*.d.ts',
    ],
  },
};
