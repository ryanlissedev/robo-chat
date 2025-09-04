/**
 * Test Isolation Utilities
 *
 * This module provides utilities to prevent test pollution and ensure proper test isolation.
 * Key issues addressed:
 * 1. Environment variable pollution
 * 2. Global state bleeding
 * 3. Module mock contamination
 * 4. DOM state persistence
 * 5. Supabase client instance conflicts
 */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// Store original environment variables
const originalEnv = { ...process.env };
const originalLocation = typeof window !== 'undefined' ? window.location : null;

// Track modified environment variables per test
const modifiedEnvVars = new Set<string>();

/**
 * Environment Variable Isolation
 */
export const envIsolation = {
  /**
   * Set an environment variable for the current test only
   */
  setTestEnv(key: string, value: string | undefined): void {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
    modifiedEnvVars.add(key);
  },

  /**
   * Reset all environment variables to original state
   */
  resetEnv(): void {
    // Reset all modified variables
    modifiedEnvVars.forEach((key) => {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
    modifiedEnvVars.clear();

    // Ensure core test environment variables are set
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
  },

  /**
   * Get original environment value
   */
  getOriginalEnv(key: string): string | undefined {
    return originalEnv[key];
  },
};

/**
 * Module Mock Isolation
 */
export const mockIsolation = {
  /**
   * Reset all mocks and modules to prevent cross-test contamination
   */
  resetAllMocks(): void {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.resetModules();

    // Restore mocked console functions
    if (vi.isMockFunction(console.error)) {
      (console.error as any).mockRestore();
    }
    if (vi.isMockFunction(console.warn)) {
      (console.warn as any).mockRestore();
    }
    if (vi.isMockFunction(console.log)) {
      (console.log as any).mockRestore();
    }
  },

  /**
   * Create isolated Supabase client mock
   */
  createIsolatedSupabaseMock(): any {
    const mockClient = {
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({ data: { user: null }, error: null })
        ),
        getSession: vi.fn(() =>
          Promise.resolve({ data: { session: null }, error: null })
        ),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
        signIn: vi.fn(() =>
          Promise.resolve({ data: { user: null }, error: null })
        ),
        signUp: vi.fn(() =>
          Promise.resolve({ data: { user: null }, error: null })
        ),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() =>
                Promise.resolve({ data: null, error: null })
              ),
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null })
          ),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      functions: {
        invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
      },
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
          download: vi.fn(() => Promise.resolve({ data: null, error: null })),
          remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      },
    };

    return mockClient;
  },
};

/**
 * DOM Isolation
 */
export const domIsolation = {
  /**
   * Clean up DOM state between tests
   */
  cleanupDOM(): void {
    // React Testing Library cleanup
    cleanup();

    // Clear document body
    if (typeof document !== 'undefined') {
      document.body.innerHTML = '';
      document.head
        .querySelectorAll('[data-vitest="true"]')
        .forEach((el) => el.remove());

      // Clear any lingering event listeners
      const clonedBody = document.body.cloneNode(true);
      if (document.body.parentNode) {
        document.body.parentNode.replaceChild(clonedBody, document.body);
      }
    }

    // Reset window state
    if (typeof window !== 'undefined') {
      // Clear timers
      let id = window.setTimeout(() => {}, 0);
      while (id--) {
        window.clearTimeout(id);
        window.clearInterval(id);
      }

      // Reset location if it was modified
      if (originalLocation && window.location !== originalLocation) {
        try {
          Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
          });
        } catch (_e) {
          // Ignore if location cannot be reset
        }
      }

      // Clear localStorage if available
      if (window.localStorage) {
        window.localStorage.clear();
      }

      // Clear sessionStorage if available
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
    }
  },

  /**
   * Reset global objects to clean state
   */
  resetGlobals(): void {
    if (typeof global !== 'undefined') {
      // Clear any test-specific globals
      const testGlobals = Object.keys(global).filter(
        (key) => key.startsWith('__test') || key.startsWith('vitest')
      );
      testGlobals.forEach((key) => {
        delete (global as any)[key];
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  },
};

/**
 * Async Operation Isolation
 */
export const asyncIsolation = {
  /**
   * Wait for all pending promises and timers to resolve
   */
  async flushPendingOperations(): Promise<void> {
    // Flush pending timers
    if (vi.isFakeTimers()) {
      try {
        vi.runOnlyPendingTimers();
      } catch (_error) {
        // Ignore timer errors
      }
    }

    // Wait for next tick to allow promises to resolve
    await new Promise((resolve) => setImmediate(resolve));

    // Additional flush for React updates
    await new Promise((resolve) => setTimeout(resolve, 0));
  },

  /**
   * Cancel all pending async operations
   */
  cancelPendingOperations(): void {
    // Clear all timers
    vi.clearAllTimers();

    // If using fake timers, advance them to clear pending operations
    if (vi.isFakeTimers()) {
      try {
        vi.advanceTimersToNextTimer();
      } catch (_error) {
        // Ignore if no timers to advance
      }
    }
  },
};

/**
 * Complete Test Isolation Setup
 */
export const testIsolation = {
  /**
   * Set up test isolation before each test
   */
  setup(): void {
    // Reset environment
    envIsolation.resetEnv();

    // Reset all mocks
    mockIsolation.resetAllMocks();

    // Clean up DOM
    domIsolation.cleanupDOM();

    // Reset globals
    domIsolation.resetGlobals();
  },

  /**
   * Clean up after each test
   */
  async cleanup(): Promise<void> {
    // Wait for async operations to complete
    await asyncIsolation.flushPendingOperations();

    // Cancel any remaining operations
    asyncIsolation.cancelPendingOperations();

    // Clean up DOM
    domIsolation.cleanupDOM();

    // Reset environment
    envIsolation.resetEnv();

    // Reset all mocks
    mockIsolation.resetAllMocks();

    // Reset globals
    domIsolation.resetGlobals();
  },
};

/**
 * Auto-setup test isolation hooks
 * Import this in your test setup to automatically apply isolation
 */
export function setupTestIsolation(): void {
  beforeEach(() => {
    testIsolation.setup();
  });

  afterEach(async () => {
    await testIsolation.cleanup();
  });
}

// Export for convenience
export default testIsolation;
