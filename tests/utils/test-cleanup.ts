/**
 * Test cleanup utilities for preventing memory leaks and optimizing performance
 */
import { vi } from 'vitest';
import { cleanup as rtlCleanup } from '@testing-library/react';

export interface CleanupTracker {
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;
  listeners: Set<{ element: EventTarget; event: string; listener: EventListener }>;
  observers: Set<{ observer: IntersectionObserver | ResizeObserver | MutationObserver }>;
  subscriptions: Set<{ unsubscribe: () => void }>;
}

class TestCleanupManager {
  private static instance: TestCleanupManager;
  private trackers = new Map<string, CleanupTracker>();

  static getInstance(): TestCleanupManager {
    if (!TestCleanupManager.instance) {
      TestCleanupManager.instance = new TestCleanupManager();
    }
    return TestCleanupManager.instance;
  }

  createTracker(testId: string): CleanupTracker {
    const tracker: CleanupTracker = {
      timers: new Set(),
      intervals: new Set(),
      listeners: new Set(),
      observers: new Set(),
      subscriptions: new Set(),
    };

    this.trackers.set(testId, tracker);
    return tracker;
  }

  trackTimer(testId: string, timer: NodeJS.Timeout): void {
    const tracker = this.trackers.get(testId);
    if (tracker) {
      tracker.timers.add(timer);
    }
  }

  trackInterval(testId: string, interval: NodeJS.Timeout): void {
    const tracker = this.trackers.get(testId);
    if (tracker) {
      tracker.intervals.add(interval);
    }
  }

  trackEventListener(
    testId: string,
    element: EventTarget,
    event: string,
    listener: EventListener
  ): void {
    const tracker = this.trackers.get(testId);
    if (tracker) {
      tracker.listeners.add({ element, event, listener });
    }
  }

  trackObserver(
    testId: string,
    observer: IntersectionObserver | ResizeObserver | MutationObserver
  ): void {
    const tracker = this.trackers.get(testId);
    if (tracker) {
      tracker.observers.add({ observer });
    }
  }

  trackSubscription(testId: string, subscription: { unsubscribe: () => void }): void {
    const tracker = this.trackers.get(testId);
    if (tracker) {
      tracker.subscriptions.add(subscription);
    }
  }

  cleanup(testId: string): void {
    const tracker = this.trackers.get(testId);
    if (!tracker) return;

    // Clear all timers
    tracker.timers.forEach((timer) => {
      clearTimeout(timer);
    });
    tracker.timers.clear();

    // Clear all intervals
    tracker.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    tracker.intervals.clear();

    // Remove all event listeners
    tracker.listeners.forEach(({ element, event, listener }) => {
      try {
        element.removeEventListener(event, listener);
      } catch (error) {
        console.warn('Failed to remove event listener:', error);
      }
    });
    tracker.listeners.clear();

    // Disconnect all observers
    tracker.observers.forEach(({ observer }) => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    tracker.observers.clear();

    // Unsubscribe all subscriptions
    tracker.subscriptions.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch (error) {
        console.warn('Failed to unsubscribe:', error);
      }
    });
    tracker.subscriptions.clear();

    // Remove tracker
    this.trackers.delete(testId);
  }

  cleanupAll(): void {
    const testIds = Array.from(this.trackers.keys());
    testIds.forEach((testId) => this.cleanup(testId));
  }
}

// Global cleanup manager instance
const cleanupManager = TestCleanupManager.getInstance();

/**
 * Enhanced cleanup function that handles React components and custom resources
 */
export function enhancedCleanup(testId?: string): void {
  // Clean up React Testing Library
  rtlCleanup();

  // Clean up vitest timers if using fake timers
  if (vi.isFakeTimers()) {
    try {
      vi.runOnlyPendingTimers();
    } catch {
      // Ignore errors if no pending timers
    }
    vi.clearAllTimers();
  }

  // Clean up tracked resources
  if (testId) {
    cleanupManager.cleanup(testId);
  } else {
    cleanupManager.cleanupAll();
  }

  // Force garbage collection if available (Node.js)
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
  }
}

/**
 * Create a test-scoped cleanup tracker
 */
export function createTestCleanup(testId: string) {
  const tracker = cleanupManager.createTracker(testId);

  return {
    // Enhanced setTimeout that tracks the timer
    setTimeout: (callback: () => void, delay: number) => {
      const timer = setTimeout(callback, delay);
      cleanupManager.trackTimer(testId, timer);
      return timer;
    },

    // Enhanced setInterval that tracks the interval
    setInterval: (callback: () => void, delay: number) => {
      const interval = setInterval(callback, delay);
      cleanupManager.trackInterval(testId, interval);
      return interval;
    },

    // Enhanced addEventListener that tracks the listener
    addEventListener: (
      element: EventTarget,
      event: string,
      listener: EventListener,
      options?: boolean | AddEventListenerOptions
    ) => {
      element.addEventListener(event, listener, options);
      cleanupManager.trackEventListener(testId, element, event, listener);
    },

    // Track observers
    trackObserver: (observer: IntersectionObserver | ResizeObserver | MutationObserver) => {
      cleanupManager.trackObserver(testId, observer);
    },

    // Track subscriptions
    trackSubscription: (subscription: { unsubscribe: () => void }) => {
      cleanupManager.trackSubscription(testId, subscription);
    },

    // Manual cleanup for this test
    cleanup: () => cleanupManager.cleanup(testId),
  };
}

/**
 * Async operation helper that automatically cleans up on completion or failure
 */
export async function withCleanup<T>(
  testId: string,
  operation: (cleanup: ReturnType<typeof createTestCleanup>) => Promise<T>
): Promise<T> {
  const testCleanup = createTestCleanup(testId);
  
  try {
    const result = await operation(testCleanup);
    return result;
  } finally {
    testCleanup.cleanup();
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static memory = new Map<string, number>();

  static start(label: string): void {
    this.timers.set(label, Date.now());
    
    // Record memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.memory.set(label, usage.heapUsed);
    }
  }

  static end(label: string): { duration: number; memoryDelta?: number } {
    const startTime = this.timers.get(label);
    const startMemory = this.memory.get(label);
    
    if (!startTime) {
      throw new Error(`No timer started for label: ${label}`);
    }

    const duration = Date.now() - startTime;
    let memoryDelta: number | undefined;

    if (typeof process !== 'undefined' && process.memoryUsage && startMemory) {
      const currentMemory = process.memoryUsage().heapUsed;
      memoryDelta = currentMemory - startMemory;
    }

    // Cleanup
    this.timers.delete(label);
    this.memory.delete(label);

    return { duration, memoryDelta };
  }
}

/**
 * Memory leak detection helper
 */
export function detectMemoryLeaks(testName: string, threshold = 10 * 1024 * 1024): void {
  if (typeof process === 'undefined' || !process.memoryUsage) {
    return; // Skip in browser environment
  }

  const usage = process.memoryUsage();
  
  if (usage.heapUsed > threshold) {
    console.warn(
      `Potential memory leak detected in test "${testName}": ${Math.round(usage.heapUsed / 1024 / 1024)}MB heap used`
    );
  }
}

// Export singleton instance for direct use
export { cleanupManager as testCleanupManager };