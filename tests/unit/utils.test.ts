import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn, debounce, formatNumber, isDev } from '@/lib/utils';

// Import timer test utilities
import { createTimerTestContext, safeAdvanceTimers, safeRunPendingTimers } from '../utils/timer-test-utils';

describe('utils', () => {
  describe('cn()', () => {
    it('should combine multiple class strings', () => {
      const result = cn('bg-blue-500', 'text-white', 'p-4');
      expect(result).toBe('bg-blue-500 text-white p-4');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      const result = cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class'
      );
      expect(result).toBe('base-class active-class');
    });

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('p-2 p-4');
      expect(result).toBe('p-4');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['bg-red-500', 'text-white'], 'p-2');
      expect(result).toBe('bg-red-500 text-white p-2');
    });

    it('should handle objects with conditional classes', () => {
      const result = cn({
        'bg-blue-500': true,
        'text-white': true,
        'opacity-50': false,
      });
      expect(result).toBe('bg-blue-500 text-white');
    });

    it('should handle undefined and null values', () => {
      const result = cn('valid-class', undefined, null, '', 'another-class');
      expect(result).toBe('valid-class another-class');
    });

    it('should return empty string for no valid classes', () => {
      const result = cn(undefined, null, false, '');
      expect(result).toBe('');
    });

    it('should handle complex Tailwind merge scenarios', () => {
      const result = cn('px-2 px-3 py-1', 'bg-red-200 bg-red-500');
      expect(result).toBe('px-3 py-1 bg-red-500');
    });
  });

  describe('formatNumber()', () => {
    it('should format integers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1_234_567)).toBe('1,234,567');
      expect(formatNumber(1_000_000)).toBe('1,000,000');
    });

    it('should format small numbers without commas', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(1)).toBe('1');
      expect(formatNumber(10)).toBe('10');
      expect(formatNumber(100)).toBe('100');
      expect(formatNumber(999)).toBe('999');
    });

    it('should format negative numbers correctly', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(-1_234_567)).toBe('-1,234,567');
      expect(formatNumber(-42)).toBe('-42');
    });

    it('should format decimal numbers', () => {
      expect(formatNumber(1000.5)).toBe('1,000.5');
      expect(formatNumber(1_234_567.89)).toBe('1,234,567.89');
      expect(formatNumber(Math.PI)).toBe('3.142');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1_000_000_000)).toBe('1,000,000,000');
      expect(formatNumber(999_999_999_999)).toBe('999,999,999,999');
    });

    it('should handle edge cases', () => {
      expect(formatNumber(0.1)).toBe('0.1');
      expect(formatNumber(0.001)).toBe('0.001');
      expect(formatNumber(-0.5)).toBe('-0.5');
    });
  });

  describe('debounce()', () => {
    const timerContext = createTimerTestContext();

    beforeEach(() => {
      timerContext.setupTimers();
    });

    afterEach(() => {
      safeRunPendingTimers();
      timerContext.cleanupTimers();
    });

    it('should delay function execution', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should only execute the last call when called multiple times', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      expect(mockFn).not.toHaveBeenCalled();

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should reset the timer on each call', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn();
      safeAdvanceTimers(500);

      debouncedFn();
      safeAdvanceTimers(500);
      expect(mockFn).not.toHaveBeenCalled();

      safeAdvanceTimers(500);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle functions with multiple arguments', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('arg1', 'arg2', 'arg3');
      safeAdvanceTimers(1000);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should handle functions that return values', () => {
      const mockFn = vi.fn(() => 'return value');
      const debouncedFn = debounce(mockFn, 1000);

      // Note: debounced functions don't return values immediately
      const result = debouncedFn();
      expect(result).toBeUndefined();

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalled();
    });

    it('should work with different wait times', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 2000);

      debouncedFn();
      safeAdvanceTimers(1000);
      expect(mockFn).not.toHaveBeenCalled();

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle zero wait time', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 0);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should preserve function context', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn('test-arg');

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalledWith('test-arg');
    });

    it('should handle rapid successive calls correctly', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 1000);

      // Call 10 times rapidly
      for (let i = 0; i < 10; i++) {
        debouncedFn(i);
      }

      safeAdvanceTimers(1000);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(9); // Last call with value 9
    });
  });

  describe('isDev', () => {
    it('should be false in test environment', () => {
      // In our vitest config, NODE_ENV is set to "test"
      expect(isDev).toBe(false);
    });

    it('should be a boolean value', () => {
      expect(typeof isDev).toBe('boolean');
    });
  });

  // Additional edge case tests
  describe('edge cases and error handling', () => {
    describe('cn() edge cases', () => {
      it('should handle very long class strings', () => {
        const longClass = 'a'.repeat(1000);
        const result = cn(longClass, 'short');
        expect(result).toContain(longClass);
        expect(result).toContain('short');
      });

      it('should handle special characters in class names', () => {
        const result = cn(
          'class-with-dashes',
          'class_with_underscores',
          'class:with:colons'
        );
        expect(result).toContain('class-with-dashes');
        expect(result).toContain('class_with_underscores');
        expect(result).toContain('class:with:colons');
      });
    });

    describe('formatNumber() edge cases', () => {
      it('should handle Infinity', () => {
        expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('∞');
      });

      it('should handle -Infinity', () => {
        expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe('-∞');
      });

      it('should handle NaN', () => {
        expect(formatNumber(Number.NaN)).toBe('NaN');
      });

      it('should handle very small decimal numbers', () => {
        expect(formatNumber(0.000_001)).toBe('0');
      });
    });

    describe('debounce() edge cases', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
      });

      it('should handle functions that throw errors', () => {
        const errorFn = vi.fn(() => {
          throw new Error('Test error');
        });
        const debouncedFn = debounce(errorFn, 1000);

        debouncedFn();

        expect(() => {
          safeAdvanceTimers(1000);
        }).toThrow('Test error');
        expect(errorFn).toHaveBeenCalledTimes(1);
      });

      it('should clear timeout properly when called multiple times', () => {
        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 1000);

        // Spy on clearTimeout to ensure it's called
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        debouncedFn();
        debouncedFn(); // This should clear the previous timeout
        debouncedFn(); // This should clear the previous timeout again

        expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);

        safeAdvanceTimers(1000);
        expect(mockFn).toHaveBeenCalledTimes(1);

        clearTimeoutSpy.mockRestore();
      });
    });
  });
});
