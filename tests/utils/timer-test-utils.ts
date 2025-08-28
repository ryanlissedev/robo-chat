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
}

/**
 * Creates a timer test context with consistent setup/cleanup patterns
 */
export function createTimerTestContext(): TimerTestContext {
  let usingFakeTimers = false;

  const setupTimers = () => {
    vi.clearAllMocks();
    vi.clearAllTimers();

    if (!vi.isFakeTimers()) {
      vi.useFakeTimers();
      usingFakeTimers = true;
    }
  };

  const cleanupTimers = () => {
    if (vi.isFakeTimers() && usingFakeTimers) {
      try {
        vi.runAllTimers();
      } catch {
        // Ignore errors if no timers to run
      }
      vi.clearAllTimers();
      vi.useRealTimers();
      usingFakeTimers = false;
    }
  };

  const createUserEvents = () => {
    if (vi.isFakeTimers()) {
      return userEvent.setup({
        advanceTimers: vi.advanceTimersByTime,
      });
    }
    return userEvent.setup();
  };

  const advanceTime = (ms: number) => {
    if (vi.isFakeTimers()) {
      vi.advanceTimersByTime(ms);
    }
  };

  const runAllTimers = () => {
    if (vi.isFakeTimers()) {
      vi.runAllTimers();
    }
  };

  const getCurrentTimerCount = () => {
    return vi.getTimerCount();
  };

  return {
    setupTimers,
    cleanupTimers,
    createUserEvents,
    advanceTime,
    runAllTimers,
    getCurrentTimerCount,
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
        vi.clearAllTimers();
      },
      afterEach: () => {
        // Clean up any lingering timers
        vi.clearAllTimers();
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
          if (vi.isFakeTimers()) {
            vi.useRealTimers();
          }
        };

        const switchToFakeTimers = () => {
          if (!vi.isFakeTimers()) {
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
  if (vi.isFakeTimers()) {
    try {
      vi.advanceTimersByTime(ms);
    } catch (_error) {}
  }
}

/**
 * Helper for running all timers with safety checks
 */
export function safeRunAllTimers(): void {
  if (vi.isFakeTimers()) {
    try {
      vi.runAllTimers();
    } catch (_error) {}
  }
}

/**
 * Helper for running only pending timers with safety checks
 */
export function safeRunPendingTimers(): void {
  if (vi.isFakeTimers()) {
    try {
      vi.runOnlyPendingTimers();
    } catch (_error) {}
  }
}
