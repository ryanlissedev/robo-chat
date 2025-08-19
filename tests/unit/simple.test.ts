import { describe, expect, test } from 'vitest';

describe('Simple Test', () => {
  test('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  test('should handle async test', async () => {
    const result = await Promise.resolve('hello');
    expect(result).toBe('hello');
  });
});
