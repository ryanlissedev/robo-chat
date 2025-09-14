import { vi } from 'vitest';
import { ApiKeyService } from '@/lib/services/api-key-service';
import type { ApiKey, SaveApiKeyRequest } from '@/lib/services/types';
import { createClient } from '@/lib/supabase/client';

// Mock Supabase client
vi.mock('@/lib/supabase/client');
const mockSupabase = createClient as any;

describe('ApiKeyService - London School TDD', () => {
  let apiKeyService: ApiKeyService;
  let mockSupabaseClient: any;
  const userId = 'test-user-123';

  beforeEach(() => {
    // Create mock Supabase client with required methods
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(mockSupabase).mockReturnValue(mockSupabaseClient);
    apiKeyService = new ApiKeyService(userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadApiKeys', () => {
    it('should load API keys from database and return as record', async () => {
      const mockApiKeys = [
        {
          id: '1',
          user_id: userId,
          provider: 'openai',
          api_key: 'sk-test-openai-key',
          masked_key: 'sk-...key',
          created_at: '2023-01-01T00:00:00Z',
          is_active: true,
        },
        {
          id: '2',
          user_id: userId,
          provider: 'anthropic',
          api_key: 'sk-ant-test-key',
          masked_key: 'sk-...key',
          created_at: '2023-01-01T00:00:00Z',
          is_active: true,
        },
      ];

      // Mock the chained query to return at the final eq() call
      mockSupabaseClient.eq.mockResolvedValue({
        data: mockApiKeys,
        error: null,
      });

      const result = await apiKeyService.loadApiKeys();

      // Verify database interaction
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_api_keys');
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', userId);

      // Verify returned format
      expect(result).toEqual({
        openai: mockApiKeys[0],
        anthropic: mockApiKeys[1],
      });
    });

    it('should return empty record when no API keys exist', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await apiKeyService.loadApiKeys();

      expect(result).toEqual({});
    });

    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(apiKeyService.loadApiKeys()).rejects.toThrow(
        'Failed to load API keys'
      );
    });
  });

  describe('saveApiKey', () => {
    const saveRequest: SaveApiKeyRequest = {
      provider: 'openai',
      key: 'sk-test123456789',
    };

    it('should insert new API key when provider does not exist', async () => {
      // Mock successful upsert operation
      mockSupabaseClient.upsert.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await apiKeyService.saveApiKey(saveRequest);

      // Verify upsert operation with correct data structure
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        {
          user_id: userId,
          provider: 'openai',
          api_key: 'sk-test123456789',
          masked_key: 'sk-...6789',
          is_active: true,
        },
        {
          onConflict: 'user_id,provider',
        }
      );

      // Check returned mock data structure matches new implementation
      expect(result).toEqual({
        id: `${userId}-openai`,
        provider: 'openai',
        masked_key: 'sk-...6789',
        created_at: expect.any(String),
        is_active: true,
      });
    });

    it('should update existing API key when provider already exists', async () => {
      // Mock successful upsert operation (same as insert, upsert handles both cases)
      mockSupabaseClient.upsert.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await apiKeyService.saveApiKey(saveRequest);

      // Verify upsert operation with correct data structure
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith(
        {
          user_id: userId,
          provider: 'openai',
          api_key: 'sk-test123456789',
          masked_key: 'sk-...6789',
          is_active: true,
        },
        {
          onConflict: 'user_id,provider',
        }
      );

      // Check returned mock data structure matches new implementation
      expect(result).toEqual({
        id: `${userId}-openai`,
        provider: 'openai',
        masked_key: 'sk-...6789',
        created_at: expect.any(String),
        is_active: true,
      });
    });

    it('should throw error when save operation fails', async () => {
      const dbError = new Error('Upsert failed');

      // Mock failed upsert
      mockSupabaseClient.upsert.mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(apiKeyService.saveApiKey(saveRequest)).rejects.toThrow(
        'Upsert failed'
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key by provider', async () => {
      // Mock the final result of the chained operations
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await apiKeyService.deleteApiKey('openai');

      // Verify delete operation chain
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_api_keys');
      expect(mockSupabaseClient.delete).toHaveBeenCalled();
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', userId);
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('provider', 'openai');
    });

    it('should throw error when delete operation fails', async () => {
      const dbError = new Error('Delete failed');
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(apiKeyService.deleteApiKey('openai')).rejects.toThrow(
        'Failed to delete API key'
      );
    });
  });

  describe('testApiKey', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should test OpenAI API key successfully', async () => {
      const mockApiKey: ApiKey = {
        id: '1',
        user_id: userId,
        provider: 'openai',
        encrypted_key: 'encrypted-openai-key',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      // Mock database call to get API key
      mockSupabaseClient.single.mockResolvedValue({
        data: mockApiKey,
        error: null,
      });

      // Mock successful API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4' }] }),
      } as Response);

      const result = await apiKeyService.testApiKey('openai');

      // Since testApiKey now calls /api/settings/test-api-key, not OpenAI directly
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'openai', isGuest: false }),
        })
      );

      expect(result).toEqual({
        success: true,
        error: undefined,
      });
    });

    it('should handle API key test failure', async () => {
      const mockApiKey: ApiKey = {
        id: '1',
        user_id: userId,
        provider: 'openai',
        encrypted_key: 'encrypted-invalid-key',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockApiKey,
        error: null,
      });

      // Mock failed API response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid API key' }),
      } as Response);

      const result = await apiKeyService.testApiKey('openai');

      expect(result).toEqual({
        success: false,
        error: 'Invalid API key',
      });
    });

    it('should handle missing API key', async () => {
      // Mock fetch throwing an error (simulating network failure)
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await apiKeyService.testApiKey('openai');

      expect(result).toEqual({
        success: false,
        error: 'Failed to test API key',
      });
    });
  });

  describe('encryption behavior', () => {
    it('should mask API keys before storing', async () => {
      const saveRequest: SaveApiKeyRequest = {
        provider: 'openai',
        key: 'sk-plaintext-key-123',
      };

      // Mock successful upsert
      mockSupabaseClient.upsert.mockResolvedValue({
        data: null,
        error: null,
      });

      await apiKeyService.saveApiKey(saveRequest);

      // Verify that the upserted data includes both full key and masked key
      const upsertCall = mockSupabaseClient.upsert.mock.calls[0][0];
      expect(upsertCall.api_key).toBe('sk-plaintext-key-123'); // Full key stored
      expect(upsertCall.masked_key).toBe('sk-...123'); // Masked version
      expect(upsertCall.masked_key).not.toBe('sk-plaintext-key-123');
    });

    it('should handle API key testing via internal API', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await apiKeyService.testApiKey('openai');

      // Verify that fetch was called with correct API endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/test-api-key',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'openai', isGuest: false }),
        })
      );

      expect(result.success).toBe(true);
    });
  });
});
