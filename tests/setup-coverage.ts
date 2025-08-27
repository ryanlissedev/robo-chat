/// <reference types="vitest/globals" />
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Import custom matchers
import './utils/custom-matchers';

// Make React available globally for components that assume it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// Global test configuration
const COVERAGE_MODE = process.env.COVERAGE === '1';
const TEST_TIMEOUT = COVERAGE_MODE ? 30000 : 10000;

// Set up test timeouts based on coverage mode
if (typeof (globalThis as any).vi !== 'undefined') {
  const vi = (globalThis as any).vi as typeof import('vitest').vi;
  
  // Configure test timeouts for coverage mode
  vi.setConfig({
    testTimeout: TEST_TIMEOUT,
    hookTimeout: TEST_TIMEOUT,
    // Add additional config for coverage mode
    ...(COVERAGE_MODE && {
      bail: 1, // Stop on first failure in coverage mode
      reporter: 'verbose',
    }),
  });
}

// Enhanced error handling for coverage runs
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (COVERAGE_MODE) {
    // In coverage mode, be more strict about unhandled rejections
    throw reason;
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (COVERAGE_MODE) {
    // In coverage mode, be more strict about uncaught exceptions
    throw error;
  }
});

// For coverage runs, we need to handle mocking differently
// since vi.mock may not be available in the hoisted context

// Set up mocks with imported vi
{
  
  // Mock next/navigation redirect as vi.fn()
  vi.mock('next/navigation', async (orig: () => Promise<any>) => {
    const actual = await (orig() as Promise<any>);
    return {
      ...actual,
      redirect: vi.fn(),
      useRouter: vi.fn(() => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
      })),
      useSearchParams: vi.fn(() => new URLSearchParams()),
      usePathname: vi.fn(() => '/'),
    };
  });

  // Enhanced Supabase client mock for coverage
  vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => null),
    createServerClient: vi.fn(() => null),
    createBrowserClient: vi.fn(() => null),
  }));

  // Mock CSS imports to prevent "Unknown file extension" errors
  vi.mock('katex/dist/katex.min.css', () => ({}));
  
  // Mock additional CSS files that might be imported
  vi.mock('highlight.js/styles/github.css', () => ({}));
  vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({}));
  vi.mock('@/styles/globals.css', () => ({}));
  vi.mock('tailwindcss/tailwind.css', () => ({}));
  
  // Mock Node.js modules that might not be available in browser environment
  vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
  }));
  
  vi.mock('path', () => ({
    join: vi.fn((...args) => args.join('/')),
    resolve: vi.fn((...args) => '/' + args.join('/')),
    dirname: vi.fn((path) => path.split('/').slice(0, -1).join('/')),
    basename: vi.fn((path) => path.split('/').pop()),
    extname: vi.fn((path) => {
      const parts = path.split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    }),
  }));
  
  // Mock crypto for encryption tests
  vi.mock('crypto', () => ({
    randomBytes: vi.fn((size) => Buffer.alloc(size, 0)),
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => 'mocked-hash'),
    })),
    createCipher: vi.fn(),
    createDecipher: vi.fn(),
    pbkdf2Sync: vi.fn(() => Buffer.alloc(32, 0)),
  }));
  
  // Ensure clipboard mock is consistent with vitest-setup.ts
  if (!global.navigator) {
    // @ts-ignore
    global.navigator = {};
  }
  
  // Only set up clipboard if not already mocked
  if (!global.navigator.clipboard) {
    const coverageClipboard = {
      writeText: vi.fn((text: string) => {
        console.log('[Coverage Mock] Clipboard.writeText called with:', text);
        return Promise.resolve();
      }),
      readText: vi.fn(() => {
        console.log('[Coverage Mock] Clipboard.readText called');
        return Promise.resolve('');
      }),
      read: vi.fn(() => Promise.resolve([])),
      write: vi.fn(() => Promise.resolve()),
    };
    
    Object.defineProperty(global.navigator, 'clipboard', {
      value: coverageClipboard,
      writable: true,
      configurable: true,
    });
  }
  
  // Enhanced matchMedia for coverage
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
  
  // Mock Web APIs that might not be available in test environment
  if (!global.structuredClone) {
    global.structuredClone = vi.fn((obj) => JSON.parse(JSON.stringify(obj)));
  }
  
  // Mock ResizeObserver if not already mocked
  if (!global.ResizeObserver) {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  }
  
  // Mock IntersectionObserver if not already mocked
  if (!global.IntersectionObserver) {
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    }));
  }
  
  // Mock performance API
  if (!global.performance) {
    global.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
    } as any;
  }
  
  // Mock window dimensions for coverage
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1024,
    });
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      value: 768,
    });
  }
}

// Coverage-specific configuration
if (COVERAGE_MODE) {
  // Increase memory limit for coverage runs
  if (typeof process !== 'undefined' && process.env) {
    process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096';
  }
  
  // Log coverage mode
  console.log('🔍 Running in COVERAGE mode - enhanced error handling and timeouts enabled');
  
  // Additional coverage-specific setup
  {
    
    // Mock additional modules that might cause issues in coverage
    vi.mock('@/lib/analytics', () => ({
      track: vi.fn(),
      identify: vi.fn(),
      page: vi.fn(),
    }));
    
    vi.mock('@/lib/telemetry', () => ({
      capture: vi.fn(),
      flush: vi.fn(),
    }));
  }
}

// Global test utilities
(globalThis as any).testUtils = {
  COVERAGE_MODE,
  TEST_TIMEOUT,
  isE2E: process.env.E2E === '1',
  isCI: process.env.CI === '1',
};