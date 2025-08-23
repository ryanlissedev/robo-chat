import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCacheStore } from '@/lib/cache';
import { memoryCache } from '@/lib/cache/memory-cache';

describe('MemoryCache', () => {
  beforeEach(async () => {
    // @ts-expect-error accessing private for test cleanup
    memoryCache.store?.clear?.();
  });

  it('stores and retrieves values with TTL', async () => {
    const key = 'k1';
    await memoryCache.setex(key, 1, JSON.stringify({ a: 1 }));
    const got = await memoryCache.get(key);
    expect(got).toBeTypeOf('string');
    expect(got && JSON.parse(got)).toEqual({ a: 1 });
  });

  it('expires values after TTL', async () => {
    vi.useFakeTimers();
    const key = 'k2';
    await memoryCache.setex(key, 1, 'v');
    // advance past ttl
    vi.advanceTimersByTime(1100);
    const got = await memoryCache.get(key);
    expect(got).toBeNull();
    vi.useRealTimers();
  });
});

describe('getCacheStore', () => {
  const prev = process.env.CACHE_PROVIDER;
  afterEach(() => {
    process.env.CACHE_PROVIDER = prev;
  });

  it('returns memory cache by default', () => {
    process.env.CACHE_PROVIDER = undefined;
    const store = getCacheStore();
    expect(store).toHaveProperty('setex');
  });

  it('supports noop provider', async () => {
    process.env.CACHE_PROVIDER = 'noop';
    const store = getCacheStore();
    const got = await store.get('x');
    expect(got).toBeNull();
  });
});
