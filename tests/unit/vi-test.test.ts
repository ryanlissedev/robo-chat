import { describe, expect, it } from 'vitest';

describe('VI Global Test', () => {
  it('should have vi available as global', () => {
    expect(typeof vi).toBe('object');
    expect(typeof vi.fn).toBe('function');
  });
});
