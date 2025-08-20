import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Throttles a value to only update at most once every `delay` milliseconds.
 * Useful for optimizing UI updates from rapidly changing values like streaming messages.
 *
 * @param value - The value to throttle
 * @param delay - The minimum delay between updates in milliseconds
 * @returns The throttled value
 */
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastUpdateTime = useRef<number>(Date.now());
  const pendingUpdate = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;

    // Clear any pending update
    if (pendingUpdate.current) {
      clearTimeout(pendingUpdate.current);
      pendingUpdate.current = null;
    }

    if (timeSinceLastUpdate >= delay) {
      // Enough time has passed, update immediately
      lastUpdateTime.current = now;
      setThrottledValue(value);
    } else {
      // Schedule an update for when the delay period expires
      const remainingDelay = delay - timeSinceLastUpdate;
      pendingUpdate.current = setTimeout(() => {
        lastUpdateTime.current = Date.now();
        setThrottledValue(value);
        pendingUpdate.current = null;
      }, remainingDelay);
    }

    return () => {
      if (pendingUpdate.current) {
        clearTimeout(pendingUpdate.current);
        pendingUpdate.current = null;
      }
    };
  }, [value, delay]);

  return throttledValue;
}

/**
 * Throttles a callback function to only execute at most once every `delay` milliseconds.
 *
 * @param callback - The callback function to throttle
 * @param delay - The minimum delay between executions in milliseconds
 * @returns The throttled callback function
 */
export function useThrottleCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastExecutionTime = useRef<number>(0);
  const pendingExecution = useRef<NodeJS.Timeout | null>(null);
  const pendingArgs = useRef<Parameters<T> | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecutionTime.current;

      // Clear any pending execution
      if (pendingExecution.current) {
        clearTimeout(pendingExecution.current);
        pendingExecution.current = null;
      }

      if (timeSinceLastExecution >= delay) {
        // Enough time has passed, execute immediately
        lastExecutionTime.current = now;
        return callback(...args);
      }
      // Store the latest args and schedule execution
      pendingArgs.current = args;
      const remainingDelay = delay - timeSinceLastExecution;

      pendingExecution.current = setTimeout(() => {
        lastExecutionTime.current = Date.now();
        if (pendingArgs.current) {
          callback(...pendingArgs.current);
          pendingArgs.current = null;
        }
        pendingExecution.current = null;
      }, remainingDelay);
    },
    [callback, delay]
  ) as T;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingExecution.current) {
        clearTimeout(pendingExecution.current);
        pendingExecution.current = null;
      }
    };
  }, []);

  return throttledCallback;
}
