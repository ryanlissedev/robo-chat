import type { CacheStore } from './CacheStore';

class NoopCache implements CacheStore {
  async get(): Promise<string | null> {
    return null;
  }
  async setex(): Promise<void> {
    return;
  }
  async del(): Promise<void> {
    return;
  }
}

export const noopCache: CacheStore = new NoopCache();

