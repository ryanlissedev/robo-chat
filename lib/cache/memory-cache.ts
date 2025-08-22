import type { CacheStore } from './CacheStore';

type Entry = { value: string; expiresAt: number };

export class MemoryCache implements CacheStore {
  private store = new Map<string, Entry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
    }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export const memoryCache = new MemoryCache();

