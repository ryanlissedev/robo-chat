import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser storage APIs
const createMockStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      if ((key?.length || 0) + (value?.length || 0) > 10000000) { // 10MB limit simulation
        throw new DOMException('QuotaExceededError');
      }
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => storage.delete(key)),
    clear: vi.fn(() => storage.clear()),
    key: vi.fn((index: number) => Array.from(storage.keys())[index] || null),
    get length() { return storage.size; },
    // For testing access to internal storage
    _storage: storage,
  };
};

// Mock Web Crypto API
global.window = {
  crypto: {
    getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    subtle: {
      generateKey: vi.fn().mockResolvedValue({}),
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
  localStorage: createMockStorage(),
  sessionStorage: createMockStorage(),
} as any;

global.TextEncoder = vi.fn().mockImplementation(() => ({
  encode: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
}));

global.TextDecoder = vi.fn().mockImplementation(() => ({
  decode: vi.fn().mockReturnValue('decoded'),
}));

global.btoa = vi.fn().mockImplementation((str: string) => Buffer.from(str).toString('base64'));
global.atob = vi.fn().mockImplementation((str: string) => Buffer.from(str, 'base64').toString());

describe('Guest User Storage and Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage as any)._storage.clear();
    (window.sessionStorage as any)._storage.clear();
  });

  describe('localStorage Functionality', () => {
    it('should save guest settings to localStorage', () => {
      const guestSettings = {
        theme: 'dark',
        language: 'en',
        preferredModel: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        enableSearch: true,
        showToolInvocations: false,
      };

      const settingsKey = 'guest-user-settings';
      const settingsJson = JSON.stringify(guestSettings);

      window.localStorage.setItem(settingsKey, settingsJson);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(settingsKey, settingsJson);

      const retrievedSettings = window.localStorage.getItem(settingsKey);
      expect(retrievedSettings).toBe(settingsJson);

      const parsedSettings = JSON.parse(retrievedSettings!);
      expect(parsedSettings).toEqual(guestSettings);
    });

    it('should handle localStorage quota exceeded gracefully', () => {
      const largeData = 'x'.repeat(10000001); // Exceeds mock limit

      expect(() => {
        window.localStorage.setItem('large-data', largeData);
      }).toThrow('QuotaExceededError');

      // Should be able to store smaller data after error
      window.localStorage.setItem('small-data', 'test');
      expect(window.localStorage.getItem('small-data')).toBe('test');
    });

    it('should persist guest chat history locally', () => {
      const chatHistory = [
        {
          id: 'chat-1',
          title: 'First Chat',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
          createdAt: new Date().toISOString(),
          model: 'gpt-4',
        },
        {
          id: 'chat-2',
          title: 'Second Chat',
          messages: [
            { role: 'user', content: 'How are you?' },
            { role: 'assistant', content: 'I am doing well, thank you!' },
          ],
          createdAt: new Date().toISOString(),
          model: 'claude-3-sonnet',
        },
      ];

      const historyKey = 'guest-chat-history';
      window.localStorage.setItem(historyKey, JSON.stringify(chatHistory));

      const retrievedHistory = JSON.parse(window.localStorage.getItem(historyKey)!);
      expect(retrievedHistory).toEqual(chatHistory);
      expect(retrievedHistory).toHaveLength(2);
      expect(retrievedHistory[0].id).toBe('chat-1');
      expect(retrievedHistory[1].model).toBe('claude-3-sonnet');
    });

    it('should manage localStorage cleanup when storage is full', () => {
      const cleanupManager = {
        maxItems: 100,
        cleanupThreshold: 0.8, // Clean when 80% full

        shouldCleanup(currentItems: number): boolean {
          return currentItems >= this.maxItems * this.cleanupThreshold;
        },

        cleanup(storage: Storage, keyPrefix: string): number {
          const keys = [];
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key && key.startsWith(keyPrefix)) {
              keys.push(key);
            }
          }

          // Sort by timestamp (assuming keys contain timestamps)
          keys.sort();

          // Remove oldest 20% of items
          const itemsToRemove = Math.floor(keys.length * 0.2);
          let removedCount = 0;

          for (let i = 0; i < itemsToRemove && i < keys.length; i++) {
            storage.removeItem(keys[i]);
            removedCount++;
          }

          return removedCount;
        },
      };

      // Simulate storage getting full
      expect(cleanupManager.shouldCleanup(85)).toBe(true);
      expect(cleanupManager.shouldCleanup(50)).toBe(false);

      // Add test data
      for (let i = 0; i < 10; i++) {
        window.localStorage.setItem(`guest-chat-${i}`, `chat data ${i}`);
      }

      const removedCount = cleanupManager.cleanup(window.localStorage, 'guest-chat-');
      expect(removedCount).toBe(2); // 20% of 10 items
    });

    it('should handle corrupted localStorage data', () => {
      const corruptedData = 'invalid-json-{[}';
      window.localStorage.setItem('corrupted-settings', corruptedData);

      let parseError = false;
      let fallbackSettings = null;

      try {
        const data = window.localStorage.getItem('corrupted-settings');
        JSON.parse(data!);
      } catch (error) {
        parseError = true;
        // Use fallback default settings
        fallbackSettings = {
          theme: 'light',
          language: 'en',
          preferredModel: 'gpt-3.5-turbo',
        };
      }

      expect(parseError).toBe(true);
      expect(fallbackSettings).toEqual({
        theme: 'light',
        language: 'en',
        preferredModel: 'gpt-3.5-turbo',
      });
    });

    it('should implement versioned storage for backward compatibility', () => {
      const storageVersionManager = {
        currentVersion: 2,

        saveWithVersion(key: string, data: any): void {
          const versionedData = {
            version: this.currentVersion,
            data,
            timestamp: Date.now(),
          };
          window.localStorage.setItem(key, JSON.stringify(versionedData));
        },

        loadWithMigration(key: string): any {
          const rawData = window.localStorage.getItem(key);
          if (!rawData) return null;

          try {
            const parsed = JSON.parse(rawData);

            // Handle legacy data without version
            if (!parsed.version) {
              return this.migrateFromV0(parsed);
            }

            // Handle version 1 data
            if (parsed.version === 1) {
              return this.migrateFromV1(parsed.data);
            }

            // Current version
            if (parsed.version === this.currentVersion) {
              return parsed.data;
            }

            throw new Error(`Unsupported version: ${parsed.version}`);
          } catch (error) {
            return null;
          }
        },

        migrateFromV0(legacyData: any): any {
          // Migrate legacy data structure
          return {
            theme: legacyData.theme || 'light',
            language: legacyData.lang || 'en', // Changed field name
            preferredModel: 'gpt-3.5-turbo', // New field
          };
        },

        migrateFromV1(v1Data: any): any {
          // Migrate from version 1 to version 2
          return {
            ...v1Data,
            enableSearch: v1Data.enableFileSearch || false, // Renamed field
            newFeature: true, // Added new field
          };
        },
      };

      const testData = { theme: 'dark', language: 'en' };

      // Save with version
      storageVersionManager.saveWithVersion('test-settings', testData);

      // Load with migration
      const loadedData = storageVersionManager.loadWithMigration('test-settings');
      expect(loadedData).toEqual(testData);

      // Test legacy data migration
      window.localStorage.setItem('legacy-settings', JSON.stringify({ theme: 'dark', lang: 'es' }));
      const migratedData = storageVersionManager.loadWithMigration('legacy-settings');
      expect(migratedData).toEqual({
        theme: 'dark',
        language: 'es',
        preferredModel: 'gpt-3.5-turbo',
      });
    });
  });

  describe('sessionStorage Functionality', () => {
    it('should store temporary guest session data', () => {
      const sessionData = {
        userId: 'guest-123',
        sessionId: 'session-456',
        startTime: Date.now(),
        apiKeysLoaded: ['openai', 'anthropic'],
        temporarySettings: {
          theme: 'dark',
          currentChat: 'chat-1',
        },
      };

      window.sessionStorage.setItem('guest-session', JSON.stringify(sessionData));

      const retrieved = JSON.parse(window.sessionStorage.getItem('guest-session')!);
      expect(retrieved).toEqual(sessionData);
      expect(retrieved.userId).toBe('guest-123');
      expect(retrieved.apiKeysLoaded).toContain('openai');
    });

    it('should clear session data on tab close simulation', () => {
      window.sessionStorage.setItem('temp-data', 'test-value');
      expect(window.sessionStorage.getItem('temp-data')).toBe('test-value');

      // Simulate tab close by clearing session storage
      window.sessionStorage.clear();
      expect(window.sessionStorage.getItem('temp-data')).toBeNull();
    });

    it('should handle session storage across multiple tabs', () => {
      // Each tab would have its own sessionStorage
      const tab1Storage = createMockStorage();
      const tab2Storage = createMockStorage();

      // Tab 1 sets data
      tab1Storage.setItem('guest-session', JSON.stringify({ tabId: 'tab-1' }));

      // Tab 2 sets different data
      tab2Storage.setItem('guest-session', JSON.stringify({ tabId: 'tab-2' }));

      // Data should be isolated
      const tab1Data = JSON.parse(tab1Storage.getItem('guest-session')!);
      const tab2Data = JSON.parse(tab2Storage.getItem('guest-session')!);

      expect(tab1Data.tabId).toBe('tab-1');
      expect(tab2Data.tabId).toBe('tab-2');
      expect(tab1Data.tabId).not.toBe(tab2Data.tabId);
    });
  });

  describe('Guest API Key Storage', () => {
    it('should store encrypted API keys securely', () => {
      const apiKeyStorage = {
        encryptKey(key: string): string {
          // Mock encryption using Buffer for better test reliability
          return Buffer.from(key.split('').reverse().join('')).toString('base64');
        },

        decryptKey(encryptedKey: string): string {
          // Mock decryption using Buffer for better test reliability
          return Buffer.from(encryptedKey, 'base64').toString().split('').reverse().join('');
        },

        storeApiKey(provider: string, key: string, scope: 'memory' | 'session' | 'persistent'): void {
          const encrypted = this.encryptKey(key);
          const storageKey = `guest-api-${provider}`;

          switch (scope) {
            case 'session':
              window.sessionStorage.setItem(storageKey, encrypted);
              break;
            case 'persistent':
              window.localStorage.setItem(storageKey, encrypted);
              break;
            // Memory storage would be handled differently (in-memory Map)
          }
        },

        retrieveApiKey(provider: string, scope: 'memory' | 'session' | 'persistent'): string | null {
          const storageKey = `guest-api-${provider}`;
          let encrypted: string | null = null;

          switch (scope) {
            case 'session':
              encrypted = window.sessionStorage.getItem(storageKey);
              break;
            case 'persistent':
              encrypted = window.localStorage.getItem(storageKey);
              break;
          }

          return encrypted ? this.decryptKey(encrypted) : null;
        },

        removeApiKey(provider: string): void {
          const storageKey = `guest-api-${provider}`;
          window.sessionStorage.removeItem(storageKey);
          window.localStorage.removeItem(storageKey);
        },
      };

      const testKey = 'sk-test-api-key-12345';

      // Test session storage
      apiKeyStorage.storeApiKey('openai', testKey, 'session');
      const retrievedSessionKey = apiKeyStorage.retrieveApiKey('openai', 'session');
      expect(retrievedSessionKey).toBe(testKey);

      // Test persistent storage
      apiKeyStorage.storeApiKey('anthropic', testKey, 'persistent');
      const retrievedPersistentKey = apiKeyStorage.retrieveApiKey('anthropic', 'persistent');
      expect(retrievedPersistentKey).toBe(testKey);

      // Test removal
      apiKeyStorage.removeApiKey('openai');
      expect(apiKeyStorage.retrieveApiKey('openai', 'session')).toBeNull();
    });

    it('should mask API keys for display', () => {
      const maskApiKey = (key: string, visibleChars: number = 4): string => {
        if (!key || key.length <= visibleChars * 2) {
          return key;
        }
        const start = key.substring(0, visibleChars);
        const end = key.substring(key.length - visibleChars);
        return `${start}${'•'.repeat(Math.min(8, key.length - visibleChars * 2))}${end}`;
      };

      const testCases = [
        { key: 'sk-1234567890abcdef1234567890abcdef', expected: 'sk-1••••••••cdef' },
        { key: 'sk-short', expected: 'sk-short' }, // Too short to mask
        { key: '', expected: '' },
        { key: 'anthropic-key-very-long-string', expected: 'anth••••••••ring' },
      ];

      testCases.forEach(({ key, expected }) => {
        expect(maskApiKey(key)).toBe(expected);
      });
    });

    it('should validate API key format before storage', () => {
      const validateApiKey = (key: string, provider: string): { valid: boolean; reason?: string } => {
        if (!key) {
          return { valid: false, reason: 'API key is required' };
        }

        const patterns = {
          openai: /^sk-[a-zA-Z0-9]{48,}$/,
          anthropic: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
          google: /^[a-zA-Z0-9-_]{39}$/,
        };

        const pattern = patterns[provider as keyof typeof patterns];
        if (!pattern) {
          return { valid: false, reason: 'Unsupported provider' };
        }

        if (!pattern.test(key)) {
          return { valid: false, reason: 'Invalid API key format' };
        }

        return { valid: true };
      };

      // Valid keys
      expect(validateApiKey('sk-1234567890abcdef1234567890abcdef1234567890abcdef', 'openai').valid).toBe(true);

      // Invalid keys
      expect(validateApiKey('invalid-key', 'openai').valid).toBe(false);
      expect(validateApiKey('', 'openai').valid).toBe(false);
      expect(validateApiKey('sk-valid-key', 'unsupported-provider').valid).toBe(false);
    });
  });

  describe('Storage Migration and Cleanup', () => {
    it('should migrate data between storage types', () => {
      const migrationManager = {
        migrateFromSessionToPersistent(key: string): boolean {
          const data = window.sessionStorage.getItem(key);
          if (!data) return false;

          try {
            window.localStorage.setItem(key, data);
            window.sessionStorage.removeItem(key);
            return true;
          } catch (error) {
            return false;
          }
        },

        migrateFromPersistentToSession(key: string): boolean {
          const data = window.localStorage.getItem(key);
          if (!data) return false;

          try {
            window.sessionStorage.setItem(key, data);
            window.localStorage.removeItem(key);
            return true;
          } catch (error) {
            return false;
          }
        },
      };

      // Test session to persistent migration
      window.sessionStorage.setItem('test-data', 'test-value');
      const migrated = migrationManager.migrateFromSessionToPersistent('test-data');

      expect(migrated).toBe(true);
      expect(window.localStorage.getItem('test-data')).toBe('test-value');
      expect(window.sessionStorage.getItem('test-data')).toBeNull();
    });

    it('should clean up expired storage entries', () => {
      const expirationManager = {
        setWithExpiration(key: string, value: any, expirationMs: number): void {
          const item = {
            value,
            expiration: Date.now() + expirationMs,
          };
          window.localStorage.setItem(key, JSON.stringify(item));
        },

        getWithExpiration(key: string): any {
          const itemStr = window.localStorage.getItem(key);
          if (!itemStr) return null;

          try {
            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiration) {
              window.localStorage.removeItem(key);
              return null;
            }
            return item.value;
          } catch (error) {
            window.localStorage.removeItem(key);
            return null;
          }
        },

        cleanupExpired(): number {
          let cleanedCount = 0;
          const keysToRemove: string[] = [];

          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && this.getWithExpiration(key) === null) {
              keysToRemove.push(key);
            }
          }

          keysToRemove.forEach(key => {
            window.localStorage.removeItem(key);
            cleanedCount++;
          });

          return cleanedCount;
        },
      };

      // Set item with short expiration
      expirationManager.setWithExpiration('temp-item', 'test-value', 100); // 100ms

      // Should be retrievable immediately
      expect(expirationManager.getWithExpiration('temp-item')).toBe('test-value');

      // Mock time passage
      const originalNow = Date.now;
      Date.now = vi.fn().mockReturnValue(originalNow() + 200); // 200ms later

      // Should be expired
      expect(expirationManager.getWithExpiration('temp-item')).toBeNull();

      // Restore Date.now
      Date.now = originalNow;
    });

    it('should handle storage space optimization', () => {
      const optimizationManager = {
        compressData(data: any): string {
          // Simple compression simulation - removes repeated characters
          const json = JSON.stringify(data);
          // Simulate compression by replacing repeated patterns
          return json.replace(/Hello World/g, 'HW');
        },

        decompressData(compressed: string): any {
          try {
            // Reverse compression
            const json = compressed.replace(/HW/g, 'Hello World');
            return JSON.parse(json);
          } catch (error) {
            return null;
          }
        },

        optimizeStorage(): { saved: number; errors: number } {
          let saved = 0;
          let errors = 0;

          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!key) continue;

            try {
              const value = window.localStorage.getItem(key);
              if (!value) continue;

              // Try to parse as JSON (uncompressed data)
              const data = JSON.parse(value);
              const compressed = this.compressData(data);

              if (compressed.length < value.length) {
                window.localStorage.setItem(key, compressed);
                saved += value.length - compressed.length;
              }
            } catch (error) {
              errors++;
            }
          }

          return { saved, errors };
        },
      };

      // Add uncompressed data with repeating pattern that can be compressed
      const testData = { message: 'Hello World'.repeat(100) };
      window.localStorage.setItem('large-data', JSON.stringify(testData));

      const result = optimizationManager.optimizeStorage();
      expect(result.saved).toBeGreaterThan(0);
      expect(result.errors).toBe(0);

      // Verify data integrity after compression
      const compressedValue = window.localStorage.getItem('large-data')!;
      const decompressed = optimizationManager.decompressData(compressedValue);
      expect(decompressed).toEqual(testData);
    });
  });
});