import { memoryCache } from './memory-cache';
import { noopCache } from './noop-cache';
import type { CacheStore } from './CacheStore';

export function getCacheStore(): CacheStore {
  const provider = process.env.CACHE_PROVIDER || 'memory';
  switch (provider) {
    case 'noop':
      return noopCache;
    case 'memory':
    default:
      return memoryCache;
  }
}

export type { CacheStore } from './CacheStore';

