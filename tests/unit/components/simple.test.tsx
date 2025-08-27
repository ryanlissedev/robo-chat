import { describe, expect, it, vi } from 'vitest';

describe('Simple test', () => {
  it('should work with vi', () => {
    const mockFn = vi.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should have document available', () => {
    expect(typeof document).toBe('object');
    expect(document.body).toBeDefined();
  });
});
