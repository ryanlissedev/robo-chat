import { describe, it, expect, vi } from 'vitest';
import {
  pipeline,
  when,
  whenAsync,
  tryAsync,
  sequence,
  withFallback,
  ConditionalChain,
  AsyncConditionalChain,
  flatMap,
  processUntil,
  type Predicate,
  type Transform,
  type AsyncTransform,
} from '@/lib/utils/control-flow';

describe('control-flow utilities', () => {
  describe('pipeline', () => {
    it('should execute operations in sequence', async () => {
      const add5: AsyncTransform<number, number> = async (x) => x + 5;
      const multiply2: AsyncTransform<number, number> = async (x) => x * 2;
      const subtract1: AsyncTransform<number, number> = async (x) => x - 1;

      const result = await pipeline(10, add5, multiply2, subtract1);

      expect(result).toBe(29); // (10 + 5) * 2 - 1 = 29
    });

    it('should handle empty operations', async () => {
      const result = await pipeline(42);

      expect(result).toBe(42);
    });

    it('should handle async operations with delays', async () => {
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      const addWithDelay: AsyncTransform<number, number> = async (x) => {
        await delay(10);
        return x + 1;
      };

      const result = await pipeline(5, addWithDelay, addWithDelay);

      expect(result).toBe(7);
    });

    it('should propagate errors from operations', async () => {
      const failingOperation: AsyncTransform<number, number> = async () => {
        throw new Error('Operation failed');
      };

      await expect(pipeline(10, failingOperation)).rejects.toThrow(
        'Operation failed'
      );
    });
  });

  describe('when', () => {
    it('should apply transform when predicate is true', () => {
      const isEven: Predicate<number> = (x) => x % 2 === 0;
      const double: Transform<number, number> = (x) => x * 2;

      const conditional = when(isEven, double);
      const result = conditional(4);

      expect(result).toBe(8);
    });

    it('should not apply transform when predicate is false', () => {
      const isEven: Predicate<number> = (x) => x % 2 === 0;
      const double: Transform<number, number> = (x) => x * 2;

      const conditional = when(isEven, double);
      const result = conditional(3);

      expect(result).toBe(3);
    });

    it('should work with string predicates and transforms', () => {
      const isEmpty: Predicate<string> = (s) => s.length === 0;
      const defaultValue: Transform<string, string> = () => 'default';

      const conditional = when(isEmpty, defaultValue);

      expect(conditional('')).toBe('default');
      expect(conditional('not empty')).toBe('not empty');
    });

    it('should work with object predicates', () => {
      interface User {
        name: string;
        age: number;
      }

      const isAdult: Predicate<User> = (user) => user.age >= 18;
      const addTitle: Transform<User, User> = (user) => ({
        ...user,
        name: `Mr. ${user.name}`,
      });

      const conditional = when(isAdult, addTitle);

      expect(conditional({ name: 'John', age: 25 })).toEqual({
        name: 'Mr. John',
        age: 25,
      });
      expect(conditional({ name: 'Jane', age: 16 })).toEqual({
        name: 'Jane',
        age: 16,
      });
    });
  });

  describe('whenAsync', () => {
    it('should apply async transform when predicate is true', async () => {
      const isPositive: Predicate<number> = (x) => x > 0;
      const asyncDouble: AsyncTransform<number, number> = async (x) => x * 2;

      const conditional = whenAsync(isPositive, asyncDouble);
      const result = await conditional(5);

      expect(result).toBe(10);
    });

    it('should not apply async transform when predicate is false', async () => {
      const isPositive: Predicate<number> = (x) => x > 0;
      const asyncDouble: AsyncTransform<number, number> = async (x) => x * 2;

      const conditional = whenAsync(isPositive, asyncDouble);
      const result = await conditional(-3);

      expect(result).toBe(-3);
    });

    it('should handle async transforms that throw errors', async () => {
      const alwaysTrue: Predicate<number> = () => true;
      const failingTransform: AsyncTransform<number, number> = async () => {
        throw new Error('Transform failed');
      };

      const conditional = whenAsync(alwaysTrue, failingTransform);

      await expect(conditional(5)).rejects.toThrow('Transform failed');
    });
  });

  describe('tryAsync', () => {
    it('should return success result when operation succeeds', async () => {
      const operation = async () => 'success';

      const result = await tryAsync(operation);

      expect(result).toEqual({ success: true, data: 'success' });
    });

    it('should return error result when operation fails', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };

      const result = await tryAsync<string, Error>(operation);

      expect(result).toEqual({
        success: false,
        error: expect.any(Error),
      });
      if (!result.success) {
        expect(result.error.message).toBe('Operation failed');
      }
    });

    it('should handle non-Error exceptions', async () => {
      const operation = async () => {
        throw 'String error';
      };

      const result = await tryAsync<string, string>(operation);

      expect(result).toEqual({
        success: false,
        error: 'String error',
      });
    });

    it('should handle async operations with complex return types', async () => {
      interface ComplexResult {
        id: number;
        data: string[];
      }

      const operation = async (): Promise<ComplexResult> => ({
        id: 1,
        data: ['a', 'b', 'c'],
      });

      const result = await tryAsync(operation);

      expect(result).toEqual({
        success: true,
        data: { id: 1, data: ['a', 'b', 'c'] },
      });
    });
  });

  describe('sequence', () => {
    it('should execute operations in sequence and return results', async () => {
      const op1 = async () => 'first';
      const op2 = async () => 'second';
      const op3 = async () => 'third';

      const results = await sequence([op1, op2, op3]);

      expect(results).toEqual(['first', 'second', 'third']);
    });

    it('should handle empty operations array', async () => {
      const results = await sequence([]);

      expect(results).toEqual([]);
    });

    it('should handle operations with different return types', async () => {
      const op1 = async () => 42;
      const op2 = async () => 'string';
      const op3 = async () => true;

      const results = await sequence([op1, op2, op3]);

      expect(results).toEqual([42, 'string', true]);
    });

    it('should stop on first error', async () => {
      const op1 = async () => 'first';
      const op2 = async () => {
        throw new Error('Second failed');
      };
      const op3 = vi.fn(async () => 'third');

      await expect(sequence([op1, op2, op3])).rejects.toThrow('Second failed');
      expect(op3).not.toHaveBeenCalled();
    });
  });

  describe('withFallback', () => {
    it('should return primary result when it succeeds', async () => {
      const primary = async () => 'primary success';
      const fallback = vi.fn(async () => 'fallback');

      const result = await withFallback(primary, fallback);

      expect(result).toBe('primary success');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should return fallback result when primary fails', async () => {
      const primary = async () => {
        throw new Error('Primary failed');
      };
      const fallback = async () => 'fallback success';

      const result = await withFallback(primary, fallback);

      expect(result).toBe('fallback success');
    });

    it('should throw if both primary and fallback fail', async () => {
      const primary = async () => {
        throw new Error('Primary failed');
      };
      const fallback = async () => {
        throw new Error('Fallback failed');
      };

      await expect(withFallback(primary, fallback)).rejects.toThrow(
        'Fallback failed'
      );
    });

    it('should handle different return types between primary and fallback', async () => {
      const primary = async (): Promise<number> => {
        throw new Error('Primary failed');
      };
      const fallback = async (): Promise<number> => 42;

      const result = await withFallback(primary, fallback);

      expect(result).toBe(42);
    });
  });

  describe('ConditionalChain', () => {
    it('should execute first matching condition', () => {
      const result = ConditionalChain.of(10)
        .when(
          (x) => x > 5,
          (x) => x * 2
        )
        .when(
          (x) => x > 15,
          (x) => x + 100
        ) // This won't execute because first condition matched
        .get();

      expect(result).toBe(20);
    });

    it('should execute only the first matching condition', () => {
      const result = ConditionalChain.of(5)
        .when(
          (x) => x < 10,
          (x) => x + 1
        )
        .when(
          (x) => x === 6,
          (x) => x * 10
        ) // This won't execute
        .get();

      expect(result).toBe(6);
    });

    it('should use otherwise when no conditions match', () => {
      const result = ConditionalChain.of(5)
        .when(
          (x) => x > 10,
          (x) => x * 2
        )
        .when(
          (x) => x < 0,
          (x) => x + 100
        )
        .otherwise((x) => x - 1);

      expect(result).toBe(4);
    });

    it('should not use otherwise when a condition matches', () => {
      const result = ConditionalChain.of(5)
        .when(
          (x) => x === 5,
          (x) => x * 3
        )
        .otherwise((x) => x - 1);

      expect(result).toBe(15);
    });

    it('should convert to async chain with whenAsync', async () => {
      const chain = ConditionalChain.of(10)
        .when(
          (x) => x < 5,
          (x) => x * 2
        )
        .whenAsync(
          (x) => x > 5,
          async (x) => x + 10
        );

      const result = await chain.get();

      expect(result).toBe(20);
    });

    it('should work with string values', () => {
      const result = ConditionalChain.of('hello')
        .when(
          (s) => s.length > 3,
          (s) => s.toUpperCase()
        )
        .get();

      expect(result).toBe('HELLO');
    });

    it('should work with object values', () => {
      interface User {
        name: string;
        age: number;
      }

      const user: User = { name: 'John', age: 25 };

      const result = ConditionalChain.of(user)
        .when(
          (u) => u.age >= 18,
          (u) => ({ ...u, status: 'adult' }) as any
        )
        .get();

      expect(result).toEqual({ name: 'John', age: 25, status: 'adult' });
    });
  });

  describe('AsyncConditionalChain', () => {
    it('should execute async conditions', async () => {
      const result = await AsyncConditionalChain.of(10)
        .whenAsync(
          (x) => x > 5,
          async (x) => x * 2
        )
        .get();

      expect(result).toBe(20);
    });

    it('should execute first matching async condition', async () => {
      const result = await AsyncConditionalChain.of(10)
        .whenAsync(
          (x) => x > 5,
          async (x) => x * 2
        )
        .whenAsync(
          (x) => x > 15,
          async (x) => x + 100
        ) // Won't execute
        .get();

      expect(result).toBe(20);
    });

    it('should use async otherwise when no conditions match', async () => {
      const result = await AsyncConditionalChain.of(5)
        .whenAsync(
          (x) => x > 10,
          async (x) => x * 2
        )
        .otherwise(async (x) => x - 1);

      expect(result).toBe(4);
    });

    it('should handle promise input values', async () => {
      const promiseValue = Promise.resolve(15);

      const result = await AsyncConditionalChain.of(promiseValue)
        .whenAsync(
          (x) => x > 10,
          async (x) => x / 3
        )
        .get();

      expect(result).toBe(5);
    });

    it('should handle async transform errors', async () => {
      const chain = AsyncConditionalChain.of(10).whenAsync(
        (x) => x > 5,
        async () => {
          throw new Error('Async transform failed');
        }
      );

      await expect(chain.get()).rejects.toThrow('Async transform failed');
    });

    it('should chain multiple async conditions', async () => {
      const result = await AsyncConditionalChain.of(1)
        .whenAsync(
          (x) => x > 5,
          async (x) => x * 2
        )
        .whenAsync(
          (x) => x < 5,
          async (x) => x + 10
        )
        .get();

      expect(result).toBe(11);
    });
  });

  describe('flatMap', () => {
    it('should flatten array transformations', () => {
      const numbers = [1, 2, 3];
      const duplicate = (n: number) => [n, n];

      const result = flatMap(numbers, duplicate);

      expect(result).toEqual([1, 1, 2, 2, 3, 3]);
    });

    it('should handle empty arrays', () => {
      const result = flatMap([], (x: number) => [x]);

      expect(result).toEqual([]);
    });

    it('should provide index to transform function', () => {
      const letters = ['a', 'b', 'c'];
      const withIndex = (letter: string, index: number) => [
        `${letter}${index}`,
      ];

      const result = flatMap(letters, withIndex);

      expect(result).toEqual(['a0', 'b1', 'c2']);
    });

    it('should handle transforms that return empty arrays', () => {
      const numbers = [1, 2, 3, 4];
      const evenOnly = (n: number) => (n % 2 === 0 ? [n] : []);

      const result = flatMap(numbers, evenOnly);

      expect(result).toEqual([2, 4]);
    });

    it('should handle transforms that return multiple items', () => {
      const words = ['hello', 'world'];
      const explode = (word: string) => word.split('');

      const result = flatMap(words, explode);

      expect(result).toEqual([
        'h',
        'e',
        'l',
        'l',
        'o',
        'w',
        'o',
        'r',
        'l',
        'd',
      ]);
    });
  });

  describe('processUntil', () => {
    it('should process items until predicate is met', () => {
      const numbers = [1, 2, 3, 4, 5];
      const isEven = (n: number) => n % 2 === 0;
      const greaterThan3 = (n: number) => n > 3;

      const result = processUntil(numbers, isEven, greaterThan3);

      expect(result).toEqual([2]); // Processes 1 (not even), 2 (even), 3 (not even), stops at 4
    });

    it('should process all items if predicate never matches', () => {
      const numbers = [1, 2, 3];
      const isEven = (n: number) => n % 2 === 0;
      const greaterThan10 = (n: number) => n > 10;

      const result = processUntil(numbers, isEven, greaterThan10);

      expect(result).toEqual([2]);
    });

    it('should return empty array if first item matches predicate', () => {
      const numbers = [5, 1, 2, 3];
      const isEven = (n: number) => n % 2 === 0;
      const greaterThan3 = (n: number) => n > 3;

      const result = processUntil(numbers, isEven, greaterThan3);

      expect(result).toEqual([]); // Stops at first item (5 > 3)
    });

    it('should handle empty arrays', () => {
      const result = processUntil(
        [],
        () => true,
        () => true
      );

      expect(result).toEqual([]);
    });

    it('should provide index to both processor and predicate', () => {
      const items = ['a', 'b', 'c', 'd'];
      const processor = (item: string, index: number) => index % 2 === 0; // Even indices
      const predicate = (item: string, index: number) => index >= 3; // Stop at index 3

      const result = processUntil(items, processor, predicate);

      expect(result).toEqual(['a', 'c']); // Items at indices 0 and 2
    });

    it('should handle processor that always returns false', () => {
      const numbers = [1, 2, 3, 4, 5];
      const alwaysFalse = () => false;
      const greaterThan3 = (n: number) => n > 3;

      const result = processUntil(numbers, alwaysFalse, greaterThan3);

      expect(result).toEqual([]); // No items are processed
    });
  });

  describe('type checking', () => {
    it('should have correct types for predicates', () => {
      const numberPredicate: Predicate<number> = (x) => x > 0;
      const stringPredicate: Predicate<string> = (s) => s.length > 0;

      expect(numberPredicate(5)).toBe(true);
      expect(stringPredicate('test')).toBe(true);
    });

    it('should have correct types for transforms', () => {
      const numberTransform: Transform<number, string> = (x) => x.toString();
      const stringTransform: Transform<string, number> = (s) => s.length;

      expect(numberTransform(42)).toBe('42');
      expect(stringTransform('hello')).toBe(5);
    });

    it('should have correct types for async transforms', () => {
      const asyncTransform: AsyncTransform<number, string> = async (x) =>
        Promise.resolve(x.toString());

      expect(asyncTransform(42)).resolves.toBe('42');
    });
  });
});
