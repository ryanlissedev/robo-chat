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
          encrypted_key: 'encrypted-openai-key',
          created_at: '2023-01-01',
          updated_at: '2023-01-01',
        },
        {
          id: '2',
          user_id: userId,
          provider: 'anthropic',
          encrypted_key: 'encrypted-anthropic-key',
          created_at: '2023-01-01',
          updated_at: '2023-01-01',
        },
      ];

      mockSupabaseClient.select.mockResolvedValue({
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
      mockSupabaseClient.select.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await apiKeyService.loadApiKeys();

      expect(result).toEqual({});
    });

    it('should throw error when database query fails', async () => {
      const dbError = new Error('Database connection failed');
      mockSupabaseClient.select.mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(apiKeyService.loadApiKeys()).rejects.toThrow(
        'Failed to load API keys: Database connection failed'
      );
    });
  });

  describe('saveApiKey', () => {
    const saveRequest: SaveApiKeyRequest = {
      provider: 'openai',
      key: 'sk-test123456789',
    };

    it('should insert new API key when provider does not exist', async () => {
      const mockSavedKey: ApiKey = {
        id: 'new-key-id',
        user_id: userId,
        provider: 'openai',
        encrypted_key: 'encrypted-key',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      // Mock existing key check (not found)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' }, // Not found error
      });

      // Mock insert operation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: mockSavedKey,
        error: null,
      });

      const result = await apiKeyService.saveApiKey(saveRequest);

      // Verify insert operation
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        user_id: userId,
        provider: 'openai',
        encrypted_key: expect.any(String),
      });

      expect(result).toEqual(mockSavedKey);
    });

    it('should update existing API key when provider already exists', async () => {
      const existingKey: ApiKey = {
        id: 'existing-key-id',
        user_id: userId,
        provider: 'openai',
        encrypted_key: 'old-encrypted-key',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      const updatedKey: ApiKey = {
        ...existingKey,
        encrypted_key: 'new-encrypted-key',
        updated_at: '2023-01-02',
      };

      // Mock existing key check (found)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: existingKey,
        error: null,
      });

      // Mock update operation
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: updatedKey,
        error: null,
      });

      const result = await apiKeyService.saveApiKey(saveRequest);

      // Verify update operation
      expect(mockSupabaseClient.update).toHaveBeenCalledWith({
        encrypted_key: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('id', existingKey.id);

      expect(result).toEqual(updatedKey);
    });

    it('should throw error when save operation fails', async () => {
      const dbError = new Error('Insert failed');

      // Mock existing key check (not found)
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock failed insert
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: dbError,
      });

      await expect(apiKeyService.saveApiKey(saveRequest)).rejects.toThrow(
        'Failed to save API key: Insert failed'
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should delete API key by provider', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await apiKeyService.deleteApiKey('openai');

      // Verify delete operation
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
        'Failed to delete API key: Delete failed'
      );
    });
  });

  describe('testApiKey', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
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
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4' }] }),
      });

      const result = await apiKeyService.testApiKey('openai');

      // Verify API call was made
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer '),
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual({
        success: true,
        provider: 'openai',
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
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await apiKeyService.testApiKey('openai');

      expect(result).toEqual({
        success: false,
        provider: 'openai',
        error: 'API key test failed (401: Unauthorized)',
      });
    });

    it('should handle missing API key', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await apiKeyService.testApiKey('openai');

      expect(result).toEqual({
        success: false,
        provider: 'openai',
        error: 'API key not found for provider: openai',
      });
    });
  });

  describe('encryption behavior', () => {
    it('should encrypt API keys before storing', async () => {
      const saveRequest: SaveApiKeyRequest = {
        provider: 'openai',
        key: 'sk-plaintext-key-123',
      };

      // Mock new key insertion
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: '1', encrypted_key: 'encrypted-result' },
        error: null,
      });

      await apiKeyService.saveApiKey(saveRequest);

      // Verify that the inserted key is encrypted (not plaintext)
      const insertCall = mockSupabaseClient.insert.mock.calls[0][0];
      expect(insertCall.encrypted_key).not.toBe('sk-plaintext-key-123');
      expect(insertCall.encrypted_key).toBeDefined();
      expect(typeof insertCall.encrypted_key).toBe('string');
    });

    it('should decrypt API keys when testing', async () => {
      const mockApiKey: ApiKey = {
        id: '1',
        user_id: userId,
        provider: 'openai',
        encrypted_key: 'encrypted-key-data',
        created_at: '2023-01-01',
        updated_at: '2023-01-01',
      };

      mockSupabaseClient.single.mockResolvedValue({
        data: mockApiKey,
        error: null,
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await apiKeyService.testApiKey('openai');

      // Verify that fetch was called with decrypted key
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const authHeader = fetchCall[1].headers.Authorization;
      expect(authHeader).toMatch(/^Bearer /);
      expect(authHeader).not.toContain('encrypted-key-data');
    });
  });
});
