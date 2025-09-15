/**
 * Timer Test Utilities - Consistent patterns for handling timers in tests
 */

import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

export interface TimerTestContext {
  setupTimers: () => void;
  cleanupTimers: () => void;
  createUserEvents: () => ReturnType<typeof userEvent.setup>;
  advanceTime: (ms: number) => void;
  runAllTimers: () => void;
  getCurrentTimerCount: () => number;
  usingFakeTimers: boolean;
}

/**
 * Creates a timer test context with consistent setup/cleanup patterns
 */
export function createTimerTestContext(): TimerTestContext {
  let usingFakeTimers = false;

  const setupTimers = () => {
    vi.clearAllMocks();
    try {
      if (vi.clearAllTimers) {
        vi.clearAllTimers();
      }
    } catch {
      // Ignore if clearAllTimers doesn't exist or fails
    }

    if (!usingFakeTimers) {
      try {
        if (vi.useFakeTimers) {
          vi.useFakeTimers();
          usingFakeTimers = true;
        }
      } catch {
        // Timer functions might not be available, continue without them
      }
    }
  };

  const cleanupTimers = () => {
    if (usingFakeTimers) {
      try {
        if (vi.runAllTimers) {
          vi.runAllTimers();
        }
      } catch {
        // Ignore errors if no timers to run
      }
      try {
        if (vi.clearAllTimers) {
          vi.clearAllTimers();
        }
      } catch {
        // Ignore if clearAllTimers doesn't exist
      }
      try {
        if (vi.useRealTimers) {
          vi.useRealTimers();
        }
      } catch {
        // Ignore if useRealTimers doesn't exist
      }
      usingFakeTimers = false;
    }
  };

  const createUserEvents = () => {
    if (usingFakeTimers && vi.advanceTimersByTime) {
      return userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
    }
    return userEvent.setup();
  };

  const advanceTime = (ms: number) => {
    if (usingFakeTimers && vi.advanceTimersByTime) {
      try {
        vi.advanceTimersByTime(ms);
      } catch {
        // Ignore timer errors
      }
    }
  };

  const runAllTimers = () => {
    if (usingFakeTimers && vi.runAllTimers) {
      try {
        vi.runAllTimers();
      } catch {
        // Ignore timer errors
      }
    }
  };

  const getCurrentTimerCount = () => {
    try {
      return vi.getTimerCount ? vi.getTimerCount() : 0;
    } catch {
      return 0;
    }
  };

  return {
    setupTimers,
    cleanupTimers,
    createUserEvents,
    advanceTime,
    runAllTimers,
    getCurrentTimerCount,
    get usingFakeTimers() {
      return usingFakeTimers;
    },
  };
}

/**
 * Timer test patterns for different scenarios
 */
export const TimerTestPatterns = {
  /**
   * For tests that need fake timers throughout
   */
  withFakeTimers: (
    callback: (context: TimerTestContext) => void | Promise<void>
  ) => {
    const context = createTimerTestContext();

    return {
      beforeEach: () => {
        context.setupTimers();
      },
      afterEach: () => {
        context.cleanupTimers();
      },
      test: callback,
      context,
    };
  },

  /**
   * For tests that need real timers for user interactions
   */
  withRealTimersForInteraction: (
    callback: (context: TimerTestContext) => void | Promise<void>
  ) => {
    const context = createTimerTestContext();

    return {
      beforeEach: () => {
        // Don't setup fake timers
        vi.clearAllMocks();
        try {
          vi.clearAllTimers();
        } catch {
          // Ignore if clearAllTimers doesn't exist
        }
      },
      afterEach: () => {
        // Clean up any lingering timers
        try {
          vi.clearAllTimers();
        } catch {
          // Ignore if clearAllTimers doesn't exist
        }
      },
      test: callback,
      context,
    };
  },

  /**
   * For tests that need mixed timer handling
   */
  withMixedTimers: (
    callback: (context: TimerTestContext) => void | Promise<void>
  ) => {
    const context = createTimerTestContext();

    return {
      beforeEach: () => {
        context.setupTimers();
      },
      afterEach: () => {
        context.cleanupTimers();
      },
      test: async (_testFn: () => void | Promise<void>) => {
        // Start with fake timers
        context.setupTimers();

        // Allow test to switch to real timers when needed
        const switchToRealTimers = () => {
          if (context.usingFakeTimers) {
            vi.useRealTimers();
          }
        };

        const switchToFakeTimers = () => {
          if (!context.usingFakeTimers) {
            vi.useFakeTimers();
          }
        };

        await callback({
          ...context,
          switchToRealTimers,
          switchToFakeTimers,
        } as any);
      },
      context,
    };
  },
};

/**
 * Helper for async operations with timeout safety
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 5000,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Helper for advancing timers with safety checks
 */
export function safeAdvanceTimers(ms: number): void {
  // We can't easily check if fake timers are active, so just try
  try {
    if (vi.advanceTimersByTime) {
      vi.advanceTimersByTime(ms);
    }
  } catch (_error) {
    // Ignore errors - likely means fake timers aren't active
  }
}

/**
 * Helper for running all timers with safety checks
 */
export function safeRunAllTimers(): void {
  try {
    if (vi.runAllTimers) {
      vi.runAllTimers();
    }
  } catch (_error) {
    // Ignore errors - likely means fake timers aren't active
  }
}

/**
 * Helper for running only pending timers with safety checks
 */
export function safeRunPendingTimers(): void {
  try {
    if (vi.runOnlyPendingTimers) {
      vi.runOnlyPendingTimers();
    }
  } catch (_error) {
    // Ignore errors - likely means fake timers aren't active
  }
}
