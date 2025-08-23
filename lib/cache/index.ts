import type { CacheStore } from './CacheStore';
import { memoryCache } from './memory-cache';
import { noopCache } from './noop-cache';

export function getCacheStore(): CacheStore {
  const provider = process.env.CACHE_PROVIDER || 'memory';
  switch (provider) {
    case 'noop':
      return noopCache;
    default:
      return memoryCache;
  }
}

export type { CacheStore } from './CacheStore';
