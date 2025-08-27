import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Helper to create userEvent with consistent configuration for tests
 */
export function createUserEvent() {
  return userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
    delay: null, // Remove delay for faster tests
    skipClick: false,
    skipHover: false,
    pointerEventsCheck: 0, // Skip pointer events check for better performance
  });
}

/**
 * Helper to wait for async clipboard operations
 */
export async function waitForClipboard(
  expectation: () => void,
  timeout = 5000
) {
  await waitFor(expectation, {
    timeout,
    interval: 50, // Check more frequently for clipboard operations
  });
}

/**
 * Helper to wait for user interactions to complete
 */
export async function waitForUserInteraction(
  expectation: () => void,
  timeout = 5000
) {
  await waitFor(expectation, {
    timeout,
    interval: 100,
  });
}

/**
 * Helper to safely click elements with async operations
 */
export async function safeClick(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement
) {
  try {
    await user.click(element);
  } catch (_error) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await user.click(element);
  }
}

/**
 * Helper to mock clipboard operations consistently
 */
export function createClipboardMock() {
  const writeText = vi.fn((_text: string) => {
    return Promise.resolve();
  });

  const readText = vi.fn(() => {
    return Promise.resolve('');
  });

  return {
    writeText,
    readText,
    read: vi.fn(() => Promise.resolve([])),
    write: vi.fn(() => Promise.resolve()),
  };
}

/**
 * Helper to setup fake timers for specific tests
 */
export function withFakeTimers(testFn: () => void | Promise<void>) {
  return async () => {
    vi.useFakeTimers();
    try {
      await testFn();
    } finally {
      vi.useRealTimers();
    }
  };
}

/**
 * Helper to wait for DOM updates after state changes
 */
export async function waitForDOMUpdate() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Enhanced timeout configuration for different test types
 */
export const TEST_TIMEOUTS = {
  FAST: 2000, // Quick DOM updates
  NORMAL: 5000, // User interactions, async operations
  SLOW: 10000, // Network requests, heavy computations
  VERY_SLOW: 15000, // File operations, complex renders
} as const;
