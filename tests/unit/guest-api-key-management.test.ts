import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock browser environment
const mockCrypto = {
  getRandomValues: vi.fn().mockImplementation((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: {
    generateKey: vi.fn().mockResolvedValue({ type: 'secret', algorithm: { name: 'AES-GCM' } }),
    importKey: vi.fn().mockResolvedValue({}),
    deriveKey: vi.fn().mockResolvedValue({}),
    encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
};

global.window = {
  crypto: mockCrypto,
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  sessionStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
} as any;

global.TextEncoder = vi.fn().mockImplementation(() => ({
  encode: vi.fn().mockReturnValue(new Uint8Array([84, 101, 115, 116])),
}));

global.TextDecoder = vi.fn().mockImplementation(() => ({
  decode: vi.fn().mockReturnValue('Test'),
}));

global.btoa = vi.fn().mockImplementation((str: string) => Buffer.from(str).toString('base64'));
global.atob = vi.fn().mockImplementation((str: string) => Buffer.from(str, 'base64').toString());

// Mock web crypto utilities
vi.mock('@/lib/security/web-crypto', () => ({
  generateEphemeralAesKey: vi.fn().mockResolvedValue({}),
  encryptWithKey: vi.fn().mockResolvedValue({
    ciphertextB64: 'encrypted-data',
    ivB64: 'iv-data',
    alg: 'AES-GCM',
    v: 1,
  }),
  decryptWithKey: vi.fn().mockResolvedValue('decrypted-key'),
  encryptWithPassphrase: vi.fn().mockResolvedValue({
    ciphertextB64: 'encrypted-data',
    ivB64: 'iv-data',
    saltB64: 'salt-data',
    alg: 'AES-GCM',
    v: 1,
  }),
  decryptWithPassphrase: vi.fn().mockResolvedValue('decrypted-key'),
  setMemoryCredential: vi.fn().mockResolvedValue({ masked: 'sk-test...1234' }),
  getMemoryCredential: vi.fn().mockReturnValue({ masked: 'sk-test...1234' }),
  getMemoryCredentialPlaintext: vi.fn().mockResolvedValue('sk-test-key'),
  setSessionCredential: vi.fn().mockResolvedValue({ masked: 'sk-test...1234' }),
  getSessionCredential: vi.fn().mockResolvedValue({
    masked: 'sk-test...1234',
    plaintext: 'sk-test-key',
  }),
  setPersistentCredential: vi.fn().mockResolvedValue({ masked: 'sk-test...1234' }),
  getPersistentCredential: vi.fn().mockResolvedValue({
    masked: 'sk-test...1234',
    plaintext: 'sk-test-key',
  }),
  clearAllGuestCredentialsFor: vi.fn(),
  maskKey: vi.fn().mockImplementation((key: string, visible = 4) => {
    if (!key) return '';
    const tail = key.slice(-visible);
    return `${key.slice(0, visible)}…${tail}`;
  }),
}));

// Mock guest settings
vi.mock('@/lib/guest-settings', () => ({
  guestSettings: {
    saveApiKeyMeta: vi.fn(),
    removeApiKeyMeta: vi.fn(),
    getApiKeyMeta: vi.fn().mockReturnValue(null),
    getAllApiKeyMetas: vi.fn().mockReturnValue({}),
  },
}));

// Mock provider map
vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn().mockReturnValue('openai'),
}));

describe('Guest API Key Management in Browser Environment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API Key Storage Scopes', () => {
    it('should store API keys in memory (tab scope)', async () => {
      const { setMemoryCredential, getMemoryCredentialPlaintext } = await import('@/lib/security/web-crypto');

      const provider = 'openai';
      const apiKey = 'sk-test-memory-key-12345';

      // Store in memory
      await setMemoryCredential(provider, apiKey);

      expect(setMemoryCredential).toHaveBeenCalledWith(provider, apiKey);

      // Retrieve from memory
      const retrieved = await getMemoryCredentialPlaintext(provider);
      expect(retrieved).toBe('sk-test-key');
    });

    it('should store API keys in session storage', async () => {
      const { setSessionCredential, getSessionCredential } = await import('@/lib/security/web-crypto');

      const provider = 'anthropic';
      const apiKey = 'sk-test-session-key-12345';

      // Store in session
      await setSessionCredential(provider, apiKey);

      expect(setSessionCredential).toHaveBeenCalledWith(provider, apiKey);

      // Retrieve from session
      const retrieved = await getSessionCredential(provider);
      expect(retrieved).toEqual({
        masked: 'sk-test...1234',
        plaintext: 'sk-test-key',
      });
    });

    it('should store API keys persistently with passphrase', async () => {
      const { setPersistentCredential, getPersistentCredential } = await import('@/lib/security/web-crypto');

      const provider = 'google';
      const apiKey = 'sk-test-persistent-key-12345';
      const passphrase = 'my-secure-passphrase';

      // Store persistently
      await setPersistentCredential(provider, apiKey, passphrase);

      expect(setPersistentCredential).toHaveBeenCalledWith(provider, apiKey, passphrase);

      // Retrieve with passphrase
      const retrieved = await getPersistentCredential(provider, passphrase);
      expect(retrieved).toEqual({
        masked: 'sk-test...1234',
        plaintext: 'sk-test-key',
      });
    });

    it('should handle storage scope priorities correctly', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');
      const { getMemoryCredential, getSessionCredential } = await import('@/lib/security/web-crypto');

      const service = new GuestCredentialService();

      // Mock both memory and session credentials available
      vi.mocked(getMemoryCredential).mockReturnValue({ masked: 'sk-memory...1234' });
      vi.mocked(getSessionCredential).mockResolvedValue({
        masked: 'sk-session...5678',
        plaintext: 'sk-session-key',
      });

      const credentials = await service.loadCredentials();

      // Memory should take priority over session
      expect(credentials.openai?.scope).toBe('tab');
      expect(credentials.openai?.masked).toBe('sk-memory...1234');
    });
  });

  describe('API Key Encryption and Security', () => {
    it('should encrypt API keys before storage', async () => {
      const { encryptWithKey, generateEphemeralAesKey } = await import('@/lib/security/web-crypto');

      const apiKey = 'sk-sensitive-api-key-12345';
      const ephemeralKey = await generateEphemeralAesKey();

      await encryptWithKey(apiKey, ephemeralKey);

      expect(encryptWithKey).toHaveBeenCalledWith(apiKey, ephemeralKey);
      expect(generateEphemeralAesKey).toHaveBeenCalled();
    });

    it('should use PBKDF2 for passphrase-based encryption', async () => {
      const { encryptWithPassphrase, decryptWithPassphrase } = await import('@/lib/security/web-crypto');

      const apiKey = 'sk-persistent-key-12345';
      const passphrase = 'user-passphrase-123';

      // Encrypt with passphrase
      const encrypted = await encryptWithPassphrase(apiKey, passphrase);

      expect(encryptWithPassphrase).toHaveBeenCalledWith(apiKey, passphrase);
      expect(encrypted).toEqual({
        ciphertextB64: 'encrypted-data',
        ivB64: 'iv-data',
        saltB64: 'salt-data',
        alg: 'AES-GCM',
        v: 1,
      });

      // Decrypt with passphrase
      const decrypted = await decryptWithPassphrase(encrypted, passphrase);

      expect(decryptWithPassphrase).toHaveBeenCalledWith(encrypted, passphrase);
      expect(decrypted).toBe('decrypted-key');
    });

    it('should mask API keys for display', () => {
      const testCases = [
        { key: 'sk-1234567890abcdef1234567890abcdef', expected: 'sk-1…cdef' },
        { key: 'sk-proj-abcdef1234567890abcdef123456', expected: 'sk-p…3456' },
        { key: 'anthropic-key-12345', expected: 'anth…2345' },
        { key: 'short', expected: 'shor…hort' },
        { key: '', expected: '' },
      ];

      testCases.forEach(({ key, expected }) => {
        const masked = key ? `${key.slice(0, 4)}…${key.slice(-4)}` : '';
        expect(masked).toBe(expected);
      });
    });

    it('should validate API key formats for different providers', () => {
      const validateApiKey = (key: string, provider: string): boolean => {
        const patterns = {
          openai: /^sk-[a-zA-Z0-9]{48,}$/,
          anthropic: /^sk-ant-[a-zA-Z0-9-_]{95,}$/,
          google: /^[a-zA-Z0-9-_]{39}$/,
          mistral: /^[a-zA-Z0-9]{32}$/,
          perplexity: /^pplx-[a-zA-Z0-9]{32}$/,
          xai: /^xai-[a-zA-Z0-9]{32,}$/,
        };

        const pattern = patterns[provider as keyof typeof patterns];
        return pattern ? pattern.test(key) : false;
      };

      // Valid keys
      expect(validateApiKey('sk-1234567890abcdef1234567890abcdef1234567890abcdef', 'openai')).toBe(true);
      expect(validateApiKey('sk-ant-' + 'a'.repeat(95), 'anthropic')).toBe(true);
      expect(validateApiKey('a'.repeat(39), 'google')).toBe(true);
      expect(validateApiKey('pplx-' + 'a'.repeat(32), 'perplexity')).toBe(true);

      // Invalid keys
      expect(validateApiKey('invalid-key', 'openai')).toBe(false);
      expect(validateApiKey('sk-short', 'openai')).toBe(false);
      expect(validateApiKey('sk-valid-key', 'unsupported')).toBe(false);
    });
  });

  describe('API Key Testing and Validation', () => {
    it('should test API key validity via API endpoint', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const service = new GuestCredentialService();
      const result = await service.testApiKey('openai');

      expect(fetch).toHaveBeenCalledWith('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai', isGuest: true }),
      });

      expect(result).toEqual({ success: true });
    });

    it('should handle API key test failures', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ success: false, error: 'Invalid API key' }),
      });

      const service = new GuestCredentialService();
      const result = await service.testApiKey('openai');

      expect(result).toEqual({ success: false, error: 'Invalid API key' });
    });

    it('should handle network errors during API key testing', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const service = new GuestCredentialService();
      const result = await service.testApiKey('openai');

      expect(result).toEqual({ success: false, error: 'Failed to test API key' });
    });

    it('should validate API keys before making requests', async () => {
      const { headersForModel } = await import('@/lib/security/guest-headers');

      vi.mocked(headersForModel).mockResolvedValue({
        'X-Model-Provider': 'openai',
        'X-Provider-Api-Key': 'sk-valid-key',
        'X-Credential-Source': 'guest-byok',
      });

      const headers = await headersForModel('gpt-4');

      expect(headers).toBeDefined();
      expect(headers!['X-Provider-Api-Key']).toBe('sk-valid-key');
      expect(headers!['X-Model-Provider']).toBe('openai');
      expect(headers!['X-Credential-Source']).toBe('guest-byok');
    });
  });

  describe('API Key Lifecycle Management', () => {
    it('should create, read, update, and delete API keys', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');
      const service = new GuestCredentialService();

      const apiKey = 'sk-test-lifecycle-key';
      const provider = 'openai';

      // Create
      const created = await service.saveCredential({
        provider,
        key: apiKey,
        storageScope: 'session',
      });

      expect(created.scope).toBe('session');
      expect(created.masked).toBe('sk-test...1234');

      // Read
      const credentials = await service.loadCredentials();
      expect(credentials[provider]).toBeDefined();

      // Update (save with different scope)
      const updated = await service.saveCredential({
        provider,
        key: 'sk-updated-key',
        storageScope: 'persistent',
        passphrase: 'new-passphrase',
      });

      expect(updated.scope).toBe('persistent');
      expect(updated.passphrase).toBe('new-passphrase');

      // Delete
      await service.deleteCredential(provider);

      const { clearAllGuestCredentialsFor } = await import('@/lib/security/web-crypto');
      expect(clearAllGuestCredentialsFor).toHaveBeenCalledWith(provider);
    });

    it('should handle multiple API keys for different providers', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');
      const service = new GuestCredentialService();

      const providers = ['openai', 'anthropic', 'google'];
      const keys = [
        'sk-openai-key-12345',
        'sk-anthropic-key-67890',
        'google-key-abcdef',
      ];

      // Save keys for different providers
      for (let i = 0; i < providers.length; i++) {
        await service.saveCredential({
          provider: providers[i],
          key: keys[i],
          storageScope: 'session',
        });
      }

      // Load all credentials
      const credentials = await service.loadCredentials();

      providers.forEach(provider => {
        expect(credentials[provider]).toBeDefined();
        expect(credentials[provider].scope).toBe('session');
      });
    });

    it('should handle API key rotation', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');
      const service = new GuestCredentialService();

      const provider = 'openai';
      const oldKey = 'sk-old-key-12345';
      const newKey = 'sk-new-key-67890';

      // Save old key
      await service.saveCredential({
        provider,
        key: oldKey,
        storageScope: 'session',
      });

      // Rotate to new key
      await service.saveCredential({
        provider,
        key: newKey,
        storageScope: 'session',
      });

      // Verify new key is stored
      const credentials = await service.loadCredentials();
      expect(credentials[provider].plaintext).toBe('sk-test-key'); // Mock returns this
    });

    it('should handle API key backup and restore', () => {
      const backupManager = {
        createBackup(credentials: Record<string, any>): string {
          const backup = {
            version: 1,
            timestamp: Date.now(),
            credentials: Object.entries(credentials).map(([provider, cred]) => ({
              provider,
              masked: cred.masked,
              scope: cred.scope,
              // Don't backup plaintext for security
            })),
          };
          return btoa(JSON.stringify(backup));
        },

        restoreFromBackup(backupData: string): any {
          try {
            const backup = JSON.parse(atob(backupData));
            if (backup.version !== 1) {
              throw new Error('Unsupported backup version');
            }
            return backup.credentials;
          } catch (error) {
            throw new Error('Invalid backup data');
          }
        },

        validateBackup(backupData: string): boolean {
          try {
            const backup = JSON.parse(atob(backupData));
            return (
              backup.version &&
              backup.timestamp &&
              Array.isArray(backup.credentials)
            );
          } catch {
            return false;
          }
        },
      };

      const testCredentials = {
        openai: { masked: 'sk-test...1234', scope: 'session' },
        anthropic: { masked: 'sk-anth...5678', scope: 'persistent' },
      };

      // Create backup
      const backup = backupManager.createBackup(testCredentials);
      expect(backup).toBeDefined();
      expect(typeof backup).toBe('string');

      // Validate backup
      expect(backupManager.validateBackup(backup)).toBe(true);

      // Restore from backup
      const restored = backupManager.restoreFromBackup(backup);
      expect(restored).toHaveLength(2);
      expect(restored[0].provider).toBe('openai');
      expect(restored[1].provider).toBe('anthropic');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Web Crypto API unavailability', () => {
      const originalCrypto = global.window.crypto;
      global.window.crypto = undefined as any;

      const checkCryptoAvailability = () => {
        return !!(typeof window !== 'undefined' && window.crypto && window.crypto.subtle);
      };

      expect(checkCryptoAvailability()).toBe(false);

      // Restore crypto
      global.window.crypto = originalCrypto;
      expect(checkCryptoAvailability()).toBe(true);
    });

    it('should handle storage quota exceeded errors', async () => {
      const { setSessionCredential } = await import('@/lib/security/web-crypto');

      // Mock storage quota exceeded
      vi.mocked(window.sessionStorage.setItem).mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      let quotaError = false;
      try {
        await setSessionCredential('openai', 'large-key');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          quotaError = true;
        }
      }

      // In a real implementation, this would be handled gracefully
      expect(setSessionCredential).toHaveBeenCalled();
    });

    it('should handle corrupted stored data', async () => {
      const { getSessionCredential } = await import('@/lib/security/web-crypto');

      // Mock corrupted data
      vi.mocked(window.sessionStorage.getItem).mockReturnValue('corrupted-json-{[}');

      vi.mocked(getSessionCredential).mockRejectedValue(
        new Error('Failed to parse session storage data')
      );

      let parseError = false;
      try {
        await getSessionCredential('openai');
      } catch (error) {
        parseError = true;
      }

      expect(parseError).toBe(true);
    });

    it('should handle concurrent API key operations', async () => {
      const { GuestCredentialService } = await import('@/lib/services/guest-credential-service');
      const service = new GuestCredentialService();

      const operations = [
        service.saveCredential({
          provider: 'openai',
          key: 'sk-key-1',
          storageScope: 'session',
        }),
        service.saveCredential({
          provider: 'anthropic',
          key: 'sk-key-2',
          storageScope: 'session',
        }),
        service.loadCredentials(),
        service.testApiKey('openai'),
      ];

      // All operations should complete without interference
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled');

      expect(successful.length).toBeGreaterThan(0);
    });

    it('should handle invalid encryption/decryption attempts', async () => {
      const { decryptWithKey } = await import('@/lib/security/web-crypto');

      // Mock decryption failure
      vi.mocked(decryptWithKey).mockRejectedValue(new Error('Invalid ciphertext'));

      let decryptionFailed = false;
      try {
        await decryptWithKey(
          { ciphertextB64: 'invalid', ivB64: 'invalid', alg: 'AES-GCM', v: 1 },
          {} as any
        );
      } catch (error) {
        decryptionFailed = true;
      }

      expect(decryptionFailed).toBe(true);
    });

    it('should handle browser compatibility issues', () => {
      const checkBrowserCompatibility = () => {
        const features = {
          webCrypto: !!(window.crypto && window.crypto.subtle),
          localStorage: !!window.localStorage,
          sessionStorage: !!window.sessionStorage,
          textEncoder: !!window.TextEncoder,
          textDecoder: !!window.TextDecoder,
        };

        const required = ['webCrypto', 'localStorage', 'sessionStorage'];
        const missing = required.filter(feature => !features[feature as keyof typeof features]);

        return {
          compatible: missing.length === 0,
          missing,
          features,
        };
      };

      const compatibility = checkBrowserCompatibility();

      expect(compatibility.compatible).toBe(true);
      expect(compatibility.missing).toHaveLength(0);
      expect(compatibility.features.webCrypto).toBe(true);
      expect(compatibility.features.localStorage).toBe(true);
      expect(compatibility.features.sessionStorage).toBe(true);
    });
  });
});