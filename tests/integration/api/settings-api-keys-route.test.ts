import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE, PATCH } from '@/app/api/settings/api-keys/route';

// Create hoisted mocks
const { mockEncryptApiKey, mockValidateApiKeyFormat } = vi.hoisted(() => ({
  mockEncryptApiKey: vi.fn(),
  mockValidateApiKeyFormat: vi.fn(),
}));

vi.mock('@/lib/security/encryption', () => ({
  encryptApiKey: mockEncryptApiKey,
  validateApiKeyFormat: mockValidateApiKeyFormat,
}));

const mockQuery = {
  select: vi.fn(() => mockQuery),
  eq: vi.fn(() => mockQuery),
  order: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
};

// Mock Supabase server client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => mockQuery),
  supabaseUrl: 'https://test.supabase.co',
  supabaseKey: 'test-key',
  realtimeUrl: 'wss://test.supabase.co/realtime/v1',
  authUrl: 'https://test.supabase.co/auth/v1',
  storageUrl: 'https://test.supabase.co/storage/v1',
  functionsUrl: 'https://test.supabase.co/functions/v1',
  realtime: {},
  storage: {},
  functions: {},
  schema: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
  getChannels: vi.fn(),
  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
  rest: {},
  global: {},
  headers: {},
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Import after mocking
const { createClient } = await import('@/lib/supabase/server');
const mockCreateClient = vi.mocked(createClient);

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
};

const mockApiKeys = [
  {
    provider: 'openai',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    provider: 'anthropic',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

const mockEncryptedData = {
  encrypted: 'encrypted-api-key-data',
  iv: 'initialization-vector',
};

describe('Settings API Keys Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue(mockSupabaseClient as any);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    mockEncryptApiKey.mockReturnValue(mockEncryptedData);
    mockValidateApiKeyFormat.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/settings/api-keys', () => {
    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Authentication required' });
      });

      it('should return 401 when auth error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token', status: 401 },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Authentication required' });
      });
    });

    describe('Successful API Key Retrieval', () => {
      it('should return user API keys when they exist', async () => {
        mockQuery.order.mockReturnValue({
          data: mockApiKeys,
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ keys: mockApiKeys });

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_keys');
        expect(mockQuery.select).toHaveBeenCalledWith('provider, created_at, updated_at');
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.order).toHaveBeenCalledWith('provider');
      });

      it('should return empty array when no keys exist', async () => {
        mockQuery.order.mockReturnValue({
          data: [],
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ keys: [] });
      });

      it('should handle null data from database', async () => {
        mockQuery.order.mockReturnValue({
          data: null,
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ keys: [] });
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when database query fails', async () => {
        mockQuery.order.mockReturnValue({
          data: null,
          error: { message: 'Database error' },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to fetch API keys',
        });
      });

      it('should handle connection timeout errors', async () => {
        mockQuery.order.mockReturnValue({
          data: null,
          error: { code: 'PGRST301', message: 'Request timeout' },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to fetch API keys',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when unexpected error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Unexpected error')
        );

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });
  });

  describe('POST /api/settings/api-keys', () => {
    const createMockRequest = (body: any) => {
      return new Request('http://localhost:3000/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    describe('Request Validation', () => {
      it('should return 400 when provider is missing', async () => {
        const request = createMockRequest({ apiKey: 'sk-test123' });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and API key are required',
        });
      });

      it('should return 400 when apiKey is missing', async () => {
        const request = createMockRequest({ provider: 'openai' });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and API key are required',
        });
      });

      it('should return 400 when both provider and apiKey are missing', async () => {
        const request = createMockRequest({});

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and API key are required',
        });
      });

      it('should return 400 when API key format is invalid', async () => {
        mockValidateApiKeyFormat.mockReturnValue(false);
        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'invalid-key-format',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Invalid API key format for openai',
        });
        expect(mockValidateApiKeyFormat).toHaveBeenCalledWith('invalid-key-format', 'openai');
      });
    });

    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);
        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });
        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Authentication required' });
      });
    });

    describe('Successful API Key Operations', () => {
      beforeEach(() => {
        mockQuery.upsert.mockResolvedValue({ error: null });
      });

      it('should add new API key successfully', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }, // No existing key
        });

        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          success: true,
          message: 'API key added',
        });

        expect(mockEncryptApiKey).toHaveBeenCalledWith('sk-test123', 'user-123');
        expect(mockQuery.upsert).toHaveBeenCalledWith({
          user_id: 'user-123',
          provider: 'openai',
          encrypted_key: 'encrypted-api-key-data',
          iv: 'initialization-vector',
          updated_at: expect.any(String),
        });
      });

      it('should update existing API key successfully', async () => {
        mockQuery.single.mockResolvedValue({
          data: { id: 'key-456' },
          error: null,
        });

        const request = createMockRequest({
          provider: 'anthropic',
          apiKey: 'sk-ant-test456',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          success: true,
          message: 'API key updated',
        });

        expect(mockEncryptApiKey).toHaveBeenCalledWith('sk-ant-test456', 'user-123');
        expect(mockQuery.upsert).toHaveBeenCalledWith({
          user_id: 'user-123',
          provider: 'anthropic',
          encrypted_key: 'encrypted-api-key-data',
          iv: 'initialization-vector',
          updated_at: expect.any(String),
        });
      });

      it('should handle multiple providers correctly', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });

        const providers = [
          { provider: 'openai', apiKey: 'sk-openai123' },
          { provider: 'anthropic', apiKey: 'sk-ant456' },
          { provider: 'google', apiKey: 'AIza789' },
        ];

        for (const providerData of providers) {
          const request = createMockRequest(providerData);
          const response = await POST(request);
          const json = await response.json();

          expect(response.status).toBe(200);
          expect(json.success).toBe(true);
          expect(mockValidateApiKeyFormat).toHaveBeenCalledWith(
            providerData.apiKey,
            providerData.provider
          );
        }

        expect(mockQuery.upsert).toHaveBeenCalledTimes(3);
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when upsert fails', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });
        mockQuery.upsert.mockResolvedValue({
          error: { message: 'Database constraint violation' },
        });

        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to save API key',
        });
      });

      it('should handle foreign key constraint errors', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });
        mockQuery.upsert.mockResolvedValue({
          error: { code: '23503', message: 'Foreign key violation' },
        });

        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to save API key',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when JSON parsing fails', async () => {
        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle encryption errors gracefully', async () => {
        mockEncryptApiKey.mockImplementation(() => {
          throw new Error('Encryption failed');
        });

        const request = createMockRequest({
          provider: 'openai',
          apiKey: 'sk-test123',
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });
  });

  describe('DELETE /api/settings/api-keys', () => {
    const createMockRequest = (body: any) => {
      return new Request('http://localhost:3000/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    describe('Request Validation', () => {
      it('should return 400 when provider is missing', async () => {
        const request = createMockRequest({});

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider is required',
        });
      });

      it('should return 400 when provider is null', async () => {
        const request = createMockRequest({ provider: null });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider is required',
        });
      });

      it('should return 400 when provider is empty string', async () => {
        const request = createMockRequest({ provider: '' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider is required',
        });
      });
    });

    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);
        const request = createMockRequest({ provider: 'openai' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });
        const request = createMockRequest({ provider: 'openai' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Authentication required' });
      });
    });

    describe('Successful API Key Deletion', () => {
      it('should delete API key successfully', async () => {
        mockQuery.delete.mockResolvedValue({ error: null });

        const request = createMockRequest({ provider: 'openai' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ success: true });

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_keys');
        expect(mockQuery.delete).toHaveBeenCalled();
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.eq).toHaveBeenCalledWith('provider', 'openai');
      });

      it('should handle deletion of non-existent key gracefully', async () => {
        mockQuery.delete.mockResolvedValue({ error: null });

        const request = createMockRequest({ provider: 'non-existent' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ success: true });
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when delete operation fails', async () => {
        mockQuery.delete.mockResolvedValue({
          error: { message: 'Delete constraint violation' },
        });

        const request = createMockRequest({ provider: 'openai' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to delete API key',
        });
      });

      it('should handle database connection errors during delete', async () => {
        mockQuery.delete.mockResolvedValue({
          error: { code: 'PGRST301', message: 'Connection timeout' },
        });

        const request = createMockRequest({ provider: 'anthropic' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to delete API key',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when JSON parsing fails', async () => {
        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json',
        });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Unexpected error')
        );

        const request = createMockRequest({ provider: 'openai' });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });
  });

  describe('PATCH /api/settings/api-keys', () => {
    const createMockRequest = (body: any) => {
      return new Request('http://localhost:3000/api/settings/api-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    describe('Request Validation', () => {
      it('should return 400 when provider is missing', async () => {
        const request = createMockRequest({ isActive: true });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and isActive are required',
        });
      });

      it('should return 400 when isActive is missing', async () => {
        const request = createMockRequest({ provider: 'openai' });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and isActive are required',
        });
      });

      it('should return 400 when isActive is not boolean', async () => {
        const request = createMockRequest({
          provider: 'openai',
          isActive: 'true',
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Provider and isActive are required',
        });
      });
    });

    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);
        const request = createMockRequest({
          provider: 'openai',
          isActive: true,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });
        const request = createMockRequest({
          provider: 'openai',
          isActive: true,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Authentication required' });
      });
    });

    describe('Successful Status Updates', () => {
      it('should update API key status successfully', async () => {
        mockQuery.update.mockResolvedValue({ error: null });

        const request = createMockRequest({
          provider: 'openai',
          isActive: false,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ success: true });

        expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_keys');
        expect(mockQuery.update).toHaveBeenCalledWith({
          updated_at: expect.any(String),
        });
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.eq).toHaveBeenCalledWith('provider', 'openai');
      });

      it('should handle both active and inactive status updates', async () => {
        mockQuery.update.mockResolvedValue({ error: null });

        // Test activating
        const activateRequest = createMockRequest({
          provider: 'anthropic',
          isActive: true,
        });

        const activateResponse = await PATCH(activateRequest);
        expect(activateResponse.status).toBe(200);

        // Test deactivating
        const deactivateRequest = createMockRequest({
          provider: 'anthropic',
          isActive: false,
        });

        const deactivateResponse = await PATCH(deactivateRequest);
        expect(deactivateResponse.status).toBe(200);

        expect(mockQuery.update).toHaveBeenCalledTimes(2);
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when update operation fails', async () => {
        mockQuery.update.mockResolvedValue({
          error: { message: 'Update constraint violation' },
        });

        const request = createMockRequest({
          provider: 'openai',
          isActive: true,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to update API key status',
        });
      });

      it('should handle database timeout errors during update', async () => {
        mockQuery.update.mockResolvedValue({
          error: { code: 'PGRST301', message: 'Request timeout' },
        });

        const request = createMockRequest({
          provider: 'google',
          isActive: false,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to update API key status',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when JSON parsing fails', async () => {
        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid-json',
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Unexpected error')
        );

        const request = createMockRequest({
          provider: 'openai',
          isActive: true,
        });

        const response = await PATCH(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });
  });

  describe('Edge Cases and Performance', () => {
    describe('Large Data Handling', () => {
      it('should handle large API keys efficiently', async () => {
        const largeApiKey = 'sk-' + 'x'.repeat(10000);
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });
        mockQuery.upsert.mockResolvedValue({ error: null });

        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'openai',
            apiKey: largeApiKey,
          }),
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(mockEncryptApiKey).toHaveBeenCalledWith(largeApiKey, 'user-123');
      });

      it('should handle many concurrent operations', async () => {
        mockQuery.order.mockReturnValue({
          data: mockApiKeys,
          error: null,
        });

        const concurrentRequests = Array.from({ length: 50 }, () => GET());

        const responses = await Promise.all(concurrentRequests);

        responses.forEach(response => {
          expect(response.status).toBe(200);
        });

        expect(mockSupabaseClient.from).toHaveBeenCalledTimes(50);
      });
    });

    describe('Special Characters and Unicode', () => {
      it('should handle provider names with special characters', async () => {
        const specialProvider = 'custom-ai-provider-v2.0';
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        });
        mockQuery.upsert.mockResolvedValue({ error: null });

        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: specialProvider,
            apiKey: 'sk-test123',
          }),
        });

        const response = await POST(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });

      it('should handle Unicode characters in provider names', async () => {
        const unicodeProvider = 'ai-服务商-测试';
        mockQuery.delete.mockResolvedValue({ error: null });

        const request = new Request('http://localhost:3000/api/settings/api-keys', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: unicodeProvider,
          }),
        });

        const response = await DELETE(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });

    describe('Memory Management', () => {
      it('should handle memory efficiently during bulk operations', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        const bulkOperations = Array.from({ length: 100 }, (_, i) => {
          mockQuery.single.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          });
          mockQuery.upsert.mockResolvedValue({ error: null });

          return new Request('http://localhost:3000/api/settings/api-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: `provider-${i}`,
              apiKey: `sk-test-${i}`,
            }),
          });
        });

        await Promise.all(bulkOperations.map(req => POST(req)));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should maintain API key state across operations', async () => {
      // First, add an API key
      mockQuery.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });
      mockQuery.upsert.mockResolvedValue({ error: null });

      const addRequest = new Request('http://localhost:3000/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-test123',
        }),
      });

      const addResponse = await POST(addRequest);
      expect(addResponse.status).toBe(200);

      // Then, retrieve API keys
      mockQuery.order.mockReturnValue({
        data: [
          {
            provider: 'openai',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

      const getResponse = await GET();
      const getJson = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getJson.keys).toHaveLength(1);
      expect(getJson.keys[0].provider).toBe('openai');

      // Finally, delete the API key
      mockQuery.delete.mockResolvedValue({ error: null });

      const deleteRequest = new Request('http://localhost:3000/api/settings/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
        }),
      });

      const deleteResponse = await DELETE(deleteRequest);
      expect(deleteResponse.status).toBe(200);
    });
  });
});