import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserKey, getEffectiveApiKey, type Provider, type ProviderWithoutOllama } from '@/lib/user-keys';

// Mock dependencies
vi.mock('@/lib/encryption', () => ({
  decryptKey: vi.fn(),
}));

vi.mock('@/lib/openproviders/env', () => ({
  env: {
    OPENAI_API_KEY: 'sk-openai-test-key',
    MISTRAL_API_KEY: 'mistral-test-key',
    PERPLEXITY_API_KEY: 'pplx-test-key',
    GOOGLE_GENERATIVE_AI_API_KEY: 'google-test-key',
    ANTHROPIC_API_KEY: 'anthropic-test-key',
    XAI_API_KEY: 'xai-test-key',
    OPENROUTER_API_KEY: 'openrouter-test-key',
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Import mocked modules
import { decryptKey } from '@/lib/encryption';
import { env } from '@/lib/openproviders/env';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

describe('User Keys Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default Supabase client mock
    vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any);
    
    // Setup method chaining for Supabase queries
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockReturnValue(mockSupabaseClient);
  });

  describe('getUserKey', () => {
    const mockUserId = 'user-123';
    const mockProvider: Provider = 'openai';
    const mockEncryptedKey = 'encrypted-key-data';
    const mockIv = 'initialization-vector';
    const mockDecryptedKey = 'sk-decrypted-key';

    describe('Success Cases', () => {
      it('should retrieve and decrypt user key successfully', async () => {
        // Mock successful database response
        mockSupabaseClient.single.mockResolvedValue({
          data: {
            encrypted_key: mockEncryptedKey,
            iv: mockIv,
          },
          error: null,
        });

        // Mock successful decryption
        vi.mocked(decryptKey).mockReturnValue(mockDecryptedKey);

        const result = await getUserKey(mockUserId, mockProvider);

        expect(createClient).toHaveBeenCalledTimes(1);
        expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_keys');
        expect(mockSupabaseClient.select).toHaveBeenCalledWith('encrypted_key, iv');
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', mockUserId);
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', mockProvider);
        expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
        expect(decryptKey).toHaveBeenCalledWith(mockEncryptedKey, mockIv);
        expect(result).toBe(mockDecryptedKey);
      });

      it('should work with all supported providers', async () => {
        const providers: Provider[] = [
          'openai',
          'mistral',
          'perplexity',
          'google',
          'anthropic',
          'xai',
          'openrouter',
          'ollama',
        ];

        for (const provider of providers) {
          // Reset mocks for each iteration
          vi.clearAllMocks();
          vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any);
          mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.single.mockResolvedValue({
            data: { encrypted_key: mockEncryptedKey, iv: mockIv },
            error: null,
          });
          vi.mocked(decryptKey).mockReturnValue(`${provider}-decrypted-key`);

          const result = await getUserKey(mockUserId, provider);

          expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', provider);
          expect(result).toBe(`${provider}-decrypted-key`);
        }
      });

      it('should handle special characters in user ID', async () => {
        const specialUserId = 'user@#$%^&*()_+-=[]{}|;:,.<>?/123';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(mockDecryptedKey);

        const result = await getUserKey(specialUserId, mockProvider);

        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', specialUserId);
        expect(result).toBe(mockDecryptedKey);
      });

      it('should handle unicode characters in user ID', async () => {
        const unicodeUserId = 'user-🚀-世界-مرحبا-123';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(mockDecryptedKey);

        const result = await getUserKey(unicodeUserId, mockProvider);

        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', unicodeUserId);
        expect(result).toBe(mockDecryptedKey);
      });
    });

    describe('Error Cases', () => {
      it('should return null when Supabase client creation fails', async () => {
        vi.mocked(createClient).mockResolvedValue(null);

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
        expect(mockSupabaseClient.from).not.toHaveBeenCalled();
        expect(decryptKey).not.toHaveBeenCalled();
      });

      it('should return null when database query returns error', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'PGRST116' },
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
        expect(decryptKey).not.toHaveBeenCalled();
      });

      it('should return null when no data is found', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: null,
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
        expect(decryptKey).not.toHaveBeenCalled();
      });

      it('should return null when database query throws exception', async () => {
        mockSupabaseClient.single.mockRejectedValue(new Error('Connection timeout'));

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
        expect(decryptKey).not.toHaveBeenCalled();
      });

      it('should return null when decryption fails', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockImplementation(() => {
          throw new Error('Decryption failed');
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });

      it('should return null when decryption returns null', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(null as any);

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });

      it('should handle createClient throwing an exception', async () => {
        vi.mocked(createClient).mockRejectedValue(new Error('Client creation failed'));

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty user ID', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(mockDecryptedKey);

        const result = await getUserKey('', mockProvider);

        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', '');
        expect(result).toBe(mockDecryptedKey);
      });

      it('should handle missing encrypted_key in response', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { iv: mockIv },
          error: null,
        });
        
        // Mock decryptKey to throw when called with undefined encrypted_key
        vi.mocked(decryptKey).mockImplementation((encrypted, iv) => {
          if (!encrypted) throw new Error('Missing encrypted_key');
          return mockDecryptedKey;
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });

      it('should handle missing iv in response', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey },
          error: null,
        });
        
        // Mock decryptKey to throw when called with undefined iv
        vi.mocked(decryptKey).mockImplementation((encrypted, iv) => {
          if (!iv) throw new Error('Missing iv');
          return mockDecryptedKey;
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });

      it('should handle malformed response data', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: 'invalid-data-format',
          error: null,
        });
        
        // Mock decryptKey to throw when called with malformed data
        vi.mocked(decryptKey).mockImplementation((encrypted, iv) => {
          if (typeof encrypted !== 'string' || typeof iv !== 'string') {
            throw new Error('Malformed data');
          }
          return mockDecryptedKey;
        });

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBeNull();
      });

      it('should handle very long encrypted keys', async () => {
        const longEncryptedKey = 'x'.repeat(10000);
        const longIv = 'y'.repeat(1000);
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: longEncryptedKey, iv: longIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(mockDecryptedKey);

        const result = await getUserKey(mockUserId, mockProvider);

        expect(decryptKey).toHaveBeenCalledWith(longEncryptedKey, longIv);
        expect(result).toBe(mockDecryptedKey);
      });
    });

    describe('Database Interaction', () => {
      it('should use correct table name', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });

        await getUserKey(mockUserId, mockProvider);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_keys');
      });

      it('should select only required fields', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });

        await getUserKey(mockUserId, mockProvider);

        expect(mockSupabaseClient.select).toHaveBeenCalledWith('encrypted_key, iv');
      });

      it('should filter by user_id and provider', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });

        await getUserKey(mockUserId, mockProvider);

        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', mockUserId);
        expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', mockProvider);
      });

      it('should call single to get one record', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });

        await getUserKey(mockUserId, mockProvider);

        expect(mockSupabaseClient.single).toHaveBeenCalledTimes(1);
      });
    });

    describe('Decryption Integration', () => {
      it('should pass correct parameters to decryptKey', async () => {
        const customEncryptedKey = 'custom-encrypted-data';
        const customIv = 'custom-iv-data';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: customEncryptedKey, iv: customIv },
          error: null,
        });

        await getUserKey(mockUserId, mockProvider);

        expect(decryptKey).toHaveBeenCalledWith(customEncryptedKey, customIv);
      });

      it('should handle decryptKey returning empty string', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue('');

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBe('');
      });

      it('should handle decryptKey returning whitespace', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: mockEncryptedKey, iv: mockIv },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue('   \n\t  ');

        const result = await getUserKey(mockUserId, mockProvider);

        expect(result).toBe('   \n\t  ');
      });
    });
  });

  describe('getEffectiveApiKey', () => {
    const mockUserId = 'user-123';

    describe('Success Cases with User Keys', () => {
      it('should return user key when available for openai', async () => {
        const userKey = 'sk-user-openai-key';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(userKey);

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(userKey);
      });

      it('should return user key for all supported providers', async () => {
        const providers: ProviderWithoutOllama[] = [
          'openai',
          'mistral',
          'perplexity',
          'google',
          'anthropic',
          'xai',
          'openrouter',
        ];

        for (const provider of providers) {
          const userKey = `sk-user-${provider}-key`;
          
          // Reset mocks for each iteration
          vi.clearAllMocks();
          vi.mocked(createClient).mockResolvedValue(mockSupabaseClient as any);
          mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
          mockSupabaseClient.single.mockResolvedValue({
            data: { encrypted_key: 'encrypted', iv: 'iv' },
            error: null,
          });
          vi.mocked(decryptKey).mockReturnValue(userKey);

          const result = await getEffectiveApiKey(mockUserId, provider);

          expect(result).toBe(userKey);
        }
      });

      it('should prioritize user key over environment variable', async () => {
        const userKey = 'sk-user-priority-key';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(userKey);

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(userKey);
        expect(result).not.toBe(env.OPENAI_API_KEY);
      });
    });

    describe('Fallback to Environment Variables', () => {
      beforeEach(() => {
        // Mock getUserKey to return null (no user key found)
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        });
      });

      it('should fallback to environment key when user key not found', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY);
      });

      it('should return environment keys for all providers', async () => {
        const providerEnvMap: Record<ProviderWithoutOllama, string> = {
          openai: env.OPENAI_API_KEY!,
          mistral: env.MISTRAL_API_KEY!,
          perplexity: env.PERPLEXITY_API_KEY!,
          google: env.GOOGLE_GENERATIVE_AI_API_KEY!,
          anthropic: env.ANTHROPIC_API_KEY!,
          xai: env.XAI_API_KEY!,
          openrouter: env.OPENROUTER_API_KEY!,
        };

        for (const [provider, expectedKey] of Object.entries(providerEnvMap)) {
          const result = await getEffectiveApiKey(mockUserId, provider as ProviderWithoutOllama);
          expect(result).toBe(expectedKey);
        }
      });

      it('should fallback to environment when user key is empty', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(''); // Empty user key

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY);
      });

      it('should fallback to environment when user key is null', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(null as any);

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY);
      });
    });

    describe('Guest User (No User ID)', () => {
      it('should return environment key when userId is null', async () => {
        const result = await getEffectiveApiKey(null, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY);
        expect(createClient).not.toHaveBeenCalled();
      });

      it('should return environment key when userId is undefined', async () => {
        const result = await getEffectiveApiKey(undefined as any, 'anthropic');

        expect(result).toBe(env.ANTHROPIC_API_KEY);
        expect(createClient).not.toHaveBeenCalled();
      });

      it('should work for all providers with null userId', async () => {
        const providers: ProviderWithoutOllama[] = [
          'openai',
          'mistral',
          'perplexity',
          'google',
          'anthropic',
          'xai',
          'openrouter',
        ];

        for (const provider of providers) {
          vi.clearAllMocks();
          const result = await getEffectiveApiKey(null, provider);
          
          expect(result).toBe((env as any)[provider.toUpperCase() + '_API_KEY'] || 
                             (env as any)['GOOGLE_GENERATIVE_AI_API_KEY']);
          expect(createClient).not.toHaveBeenCalled();
        }
      });
    });

    describe('Missing Environment Variables', () => {
      beforeEach(() => {
        // Mock getUserKey to return null
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        });
      });

      it('should return null when both user key and env var are missing', async () => {
        // Mock env to not have the specific key
        const originalEnv = { ...env };
        (env as any).OPENAI_API_KEY = undefined;

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBeNull();

        // Restore original env
        Object.assign(env, originalEnv);
      });

      it('should handle empty environment variables', async () => {
        const originalEnv = { ...env };
        (env as any).MISTRAL_API_KEY = '';

        const result = await getEffectiveApiKey(mockUserId, 'mistral');

        expect(result).toBeNull();

        // Restore original env
        Object.assign(env, originalEnv);
      });
    });

    describe('Edge Cases', () => {
      it('should handle whitespace-only user key falling back to env', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue('   \n\t  ');

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        // Whitespace is considered truthy, so should be returned as-is
        expect(result).toBe('   \n\t  ');
      });

      it('should handle very long user IDs', async () => {
        const longUserId = 'user-' + 'x'.repeat(1000);
        const userKey = 'sk-long-user-key';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(userKey);

        const result = await getEffectiveApiKey(longUserId, 'openai');

        expect(result).toBe(userKey);
      });

      it('should handle special characters in user ID', async () => {
        const specialUserId = 'user@#$%^&*()_+-=[]{}|;:,.<>?';
        const userKey = 'sk-special-user-key';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(userKey);

        const result = await getEffectiveApiKey(specialUserId, 'openai');

        expect(result).toBe(userKey);
      });

      it('should handle empty string userId', async () => {
        const result = await getEffectiveApiKey('', 'openai');

        // Empty string is falsy, should fall back to env
        expect(result).toBe(env.OPENAI_API_KEY);
        expect(createClient).not.toHaveBeenCalled();
      });
    });

    describe('Provider-Environment Mapping', () => {
      beforeEach(() => {
        mockSupabaseClient.single.mockResolvedValue({
          data: null,
          error: { message: 'No rows found' },
        });
      });

      it('should map openai provider to OPENAI_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'openai');
        expect(result).toBe(env.OPENAI_API_KEY);
      });

      it('should map mistral provider to MISTRAL_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'mistral');
        expect(result).toBe(env.MISTRAL_API_KEY);
      });

      it('should map perplexity provider to PERPLEXITY_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'perplexity');
        expect(result).toBe(env.PERPLEXITY_API_KEY);
      });

      it('should map google provider to GOOGLE_GENERATIVE_AI_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'google');
        expect(result).toBe(env.GOOGLE_GENERATIVE_AI_API_KEY);
      });

      it('should map anthropic provider to ANTHROPIC_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'anthropic');
        expect(result).toBe(env.ANTHROPIC_API_KEY);
      });

      it('should map xai provider to XAI_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'xai');
        expect(result).toBe(env.XAI_API_KEY);
      });

      it('should map openrouter provider to OPENROUTER_API_KEY', async () => {
        const result = await getEffectiveApiKey(mockUserId, 'openrouter');
        expect(result).toBe(env.OPENROUTER_API_KEY);
      });
    });

    describe('Performance and Concurrency', () => {
      it('should handle multiple concurrent requests for same user', async () => {
        const userKey = 'sk-concurrent-key';
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue(userKey);

        const promises = Array(10).fill(null).map(() => 
          getEffectiveApiKey(mockUserId, 'openai')
        );

        const results = await Promise.all(promises);

        expect(results.every(result => result === userKey)).toBe(true);
      });

      it('should handle multiple concurrent requests for different users', async () => {
        const users = Array(5).fill(null).map((_, i) => `user-${i}`);
        
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        
        vi.mocked(decryptKey).mockReturnValue('sk-key-for-encrypted');

        const promises = users.map(userId => 
          getEffectiveApiKey(userId, 'openai')
        );

        const results = await Promise.all(promises);

        expect(results).toHaveLength(5);
        expect(results.every(result => result?.startsWith('sk-key-for-'))).toBe(true);
      });

      it('should handle mixed user and guest requests', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'encrypted', iv: 'iv' },
          error: null,
        });
        vi.mocked(decryptKey).mockReturnValue('sk-user-key');

        const promises = [
          getEffectiveApiKey('user-123', 'openai'), // Should get user key
          getEffectiveApiKey(null, 'openai'),       // Should get env key
          getEffectiveApiKey('user-456', 'openai'), // Should get user key
          getEffectiveApiKey(null, 'openai'),       // Should get env key
        ];

        const results = await Promise.all(promises);

        expect(results[0]).toBe('sk-user-key');
        expect(results[1]).toBe(env.OPENAI_API_KEY);
        expect(results[2]).toBe('sk-user-key');
        expect(results[3]).toBe(env.OPENAI_API_KEY);
      });
    });

    describe('Error Resilience', () => {
      it('should gracefully handle getUserKey failures', async () => {
        // Mock getUserKey to throw an error
        vi.mocked(createClient).mockRejectedValue(new Error('Database connection failed'));

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY); // Should fall back to env
      });

      it('should handle partial database failures', async () => {
        // Mock intermittent failures - first call fails, second succeeds
        let callCount = 0;
        mockSupabaseClient.single.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Intermittent failure');
          }
          return {
            data: { encrypted_key: 'encrypted', iv: 'iv' },
            error: null,
          };
        });
        
        vi.mocked(decryptKey).mockReturnValue('sk-user-key');

        // First call should fail and fall back to env
        const result1 = await getEffectiveApiKey(mockUserId, 'openai');
        expect(result1).toBe(env.OPENAI_API_KEY);

        // Second call should succeed and return user key
        const result2 = await getEffectiveApiKey(mockUserId, 'openai');
        expect(result2).toBe('sk-user-key');
      });

      it('should handle corrupted decryption gracefully', async () => {
        mockSupabaseClient.single.mockResolvedValue({
          data: { encrypted_key: 'corrupted-data', iv: 'corrupted-iv' },
          error: null,
        });
        
        vi.mocked(decryptKey).mockImplementation(() => {
          throw new Error('Decryption failed - corrupted data');
        });

        const result = await getEffectiveApiKey(mockUserId, 'openai');

        expect(result).toBe(env.OPENAI_API_KEY); // Should fall back to env
      });
    });
  });

  describe('Type Safety and Provider Validation', () => {
    it('should accept all valid Provider types for getUserKey', async () => {
      const validProviders: Provider[] = [
        'openai',
        'mistral',
        'perplexity',
        'google',
        'anthropic',
        'xai',
        'openrouter',
        'ollama',
      ];

      mockSupabaseClient.single.mockResolvedValue({
        data: { encrypted_key: 'encrypted', iv: 'iv' },
        error: null,
      });
      vi.mocked(decryptKey).mockReturnValue('test-key');

      for (const provider of validProviders) {
        const result = await getUserKey('test-user', provider);
        expect(typeof result === 'string' || result === null).toBe(true);
      }
    });

    it('should accept all valid ProviderWithoutOllama types for getEffectiveApiKey', async () => {
      const validProviders: ProviderWithoutOllama[] = [
        'openai',
        'mistral',
        'perplexity',
        'google',
        'anthropic',
        'xai',
        'openrouter',
      ];

      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'No rows found' },
      });

      for (const provider of validProviders) {
        const result = await getEffectiveApiKey('test-user', provider);
        expect(typeof result === 'string' || result === null).toBe(true);
      }
    });

    it('should exclude ollama from ProviderWithoutOllama', () => {
      // This is a compile-time test - if 'ollama' is assignable to ProviderWithoutOllama,
      // TypeScript will catch it. We can't test this at runtime, but we can document
      // the expectation.
      
      // getEffectiveApiKey('test-user', 'ollama'); // This should cause a TypeScript error
      
      // Instead, verify that ollama is not in the env key mapping
      const provider = 'ollama' as any;
      const envKeyMap: Record<ProviderWithoutOllama, string | undefined> = {
        openai: env.OPENAI_API_KEY,
        mistral: env.MISTRAL_API_KEY,
        perplexity: env.PERPLEXITY_API_KEY,
        google: env.GOOGLE_GENERATIVE_AI_API_KEY,
        anthropic: env.ANTHROPIC_API_KEY,
        xai: env.XAI_API_KEY,
        openrouter: env.OPENROUTER_API_KEY,
      };

      expect((envKeyMap as any)[provider]).toBeUndefined();
    });
  });
});