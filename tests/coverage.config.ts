/**
 * Coverage configuration for V8 provider
 * Provides detailed coverage reporting and threshold enforcement
 */

import type { CoverageV8Options } from 'vitest';

export const coverageConfig: CoverageV8Options = {
  // V8 provider configuration
  enabled: process.env.COVERAGE === '1',

  // Report formats
  reporter: [
    'text', // Console output
    'text-summary', // Brief console summary
    'html', // HTML report for browsing
    'json', // JSON for CI/CD integration
    'json-summary', // Brief JSON summary
    'lcov', // Standard LCOV format
    'clover', // XML format for some CI systems
  ],

  // Output directories
  reportsDirectory: './coverage',

  // Files to include in coverage
  include: [
    'app/**/*.{ts,tsx,js,jsx}',
    'components/**/*.{ts,tsx,js,jsx}',
    'lib/**/*.{ts,tsx,js,jsx}',
    'hooks/**/*.{ts,tsx,js,jsx}',
    'utils/**/*.{ts,tsx,js,jsx}',
    'stores/**/*.{ts,tsx,js,jsx}',
    'services/**/*.{ts,tsx,js,jsx}',
  ],

  // Files to exclude from coverage
  exclude: [
    // Build and config files
    'node_modules/**',
    'dist/**',
    '.next/**',
    'coverage/**',
    '**/*.config.*',
    '**/*.d.ts',

    // Test files
    'tests/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/__mocks__/**',

    // Development files
    '**/stories/**',
    '**/storybook-static/**',
    '**/.storybook/**',

    // Static assets
    'public/**',
    'assets/**',
    'static/**',

    // Documentation
    'docs/**',
    '**/*.md',

    // Scripts and tools
    'scripts/**',
    'tools/**',
    'bin/**',

    // E2E tests
    'playwright-tests/**',
    'e2e/**',

    // Specific patterns to exclude
    '**/index.ts', // Re-export files
    '**/types.ts', // Type definition files
    '**/constants.ts', // Constant definition files
    '**/env*.ts', // Environment config files
    '**/*.stories.*', // Storybook stories

    // Framework-specific exclusions
    'app/layout.tsx', // Next.js root layout
    'app/globals.css', // Global CSS
    'tailwind.config.*', // Tailwind config
    'postcss.config.*', // PostCSS config
    'next.config.*', // Next.js config
  ],

  // Coverage thresholds - enforcing 100% coverage
  thresholds: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // Per-file thresholds (can be overridden for specific files)
    perFile: true,
  },

  // V8-specific options
  ignoreClassMethods: [
    // Ignore certain class methods that are hard to test
  ],

  // Additional options
  all: true, // Include all files, even if not imported in tests
  clean: true, // Clean coverage directory before each run
  cleanOnRerun: true, // Clean on watch mode reruns
  skipFull: false, // Don't skip files with 100% coverage
  reportOnFailure: true, // Generate report even if tests fail
  allowExternal: false, // Don't include external files

  // Custom reporter options - customReporters not available in CoverageV8Options
  // customReporters: [],

  // Watermarks for color coding in reports
  watermarks: {
    statements: [50, 80],
    functions: [50, 80],
    branches: [50, 80],
    lines: [50, 80],
  },
};

// Coverage thresholds for different environments
export const coverageThresholds = {
  // Strict thresholds for production builds
  production: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    perFile: true,
  },

  // Relaxed thresholds for development
  development: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    perFile: false,
  },

  // CI/CD thresholds
  ci: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    perFile: true,
  },
};

// Get coverage config based on environment
export const getCoverageConfig = (
  env: 'production' | 'development' | 'ci' = 'production'
): CoverageV8Options => {
  return {
    ...coverageConfig,
    thresholds: coverageThresholds[env],
  };
};

export default coverageConfig;
