import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';

// Create mock implementations
const mockGetAllModels = vi.fn();
const mockGetModelsForUserProviders = vi.fn();
const mockGetModelsWithAccessFlags = vi.fn();
const mockRefreshModelsCache = vi.fn();
const mockCreateClient = vi.fn();

// Hoist vi.mock calls to ensure proper module mocking
vi.mock('@/lib/models', () => ({
  getAllModels: mockGetAllModels,
  getModelsForUserProviders: mockGetModelsForUserProviders,
  getModelsWithAccessFlags: mockGetModelsWithAccessFlags,
  refreshModelsCache: mockRefreshModelsCache,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

import { GET, POST } from '@/app/api/models/route';

// Mock environment variables
const originalEnv = process.env;

describe('Models API Route', () => {
  // Use the mock functions defined above

  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnValue({
      data: [
        { provider: 'openai' },
        { provider: 'anthropic' }
      ],
      error: null
    })
  };

  const mockModels = [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      providerId: 'openai',
      provider: 'openai',
      baseProviderId: 'openai',
      accessible: true
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      providerId: 'anthropic',
      provider: 'anthropic',
      baseProviderId: 'anthropic',
      accessible: true
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      providerId: 'google',
      provider: 'google',
      baseProviderId: 'google',
      accessible: false
    },
    {
      id: 'mistral-7b',
      name: 'Mistral 7B',
      providerId: 'mistral',
      provider: 'mistral',
      baseProviderId: 'mistral',
      accessible: true
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'sk-test-openai-key',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      GOOGLE_API_KEY: 'test-google-key',
      // MISTRAL_API_KEY intentionally missing to test env availability
    };

    // Reset all mocks with proper return values
    mockGetAllModels.mockResolvedValue(mockModels);
    mockGetModelsForUserProviders.mockResolvedValue(mockModels);
    mockGetModelsWithAccessFlags.mockResolvedValue(mockModels);
    mockRefreshModelsCache.mockImplementation(() => {});
    mockCreateClient.mockResolvedValue(mockSupabaseClient as any);
    
    // Add debug logging to verify mocks are called
    mockGetAllModels.mockImplementation(async () => {
      console.log('mockGetAllModels called');
      return mockModels;
    });
    mockGetModelsForUserProviders.mockImplementation(async (providers) => {
      console.log('mockGetModelsForUserProviders called with:', providers);
      return mockModels;
    });
    mockGetModelsWithAccessFlags.mockImplementation(async () => {
      console.log('mockGetModelsWithAccessFlags called');
      return mockModels;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('GET /api/models', () => {
    it('should return models for authenticated user with API keys', async () => {
      // First verify our mocks are working
      console.log('Testing mock setup...');
      console.log('mockGetModelsForUserProviders type:', typeof mockGetModelsForUserProviders);
      console.log('mockGetModelsForUserProviders isMock:', vi.isMockFunction(mockGetModelsForUserProviders));
      
      // Manually test the mock
      try {
        const testResult = await mockGetModelsForUserProviders(['test']);
        console.log('Mock test result:', testResult);
      } catch (error) {
        console.log('Mock test error:', error);
      }

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      try {
        const response = await GET();
        
        if (response.status !== 200) {
          const errorData = await response.json();
          console.log('API returned 500 error:', errorData);
        }
        
        expect(response.status).toBe(200);
        
        const responseData = await response.json();
        expect(responseData.models).toHaveLength(4);
        
        // Check credential info is added
        const openaiModel = responseData.models.find((m: any) => m.providerId === 'openai');
        expect(openaiModel.credentialInfo).toEqual({
          envAvailable: true,
          guestByokAvailable: true,
          userByokAvailable: true
        });

        const mistralModel = responseData.models.find((m: any) => m.providerId === 'mistral');
        expect(mistralModel.credentialInfo).toEqual({
          envAvailable: false, // No MISTRAL_API_KEY in env
          guestByokAvailable: true,
          userByokAvailable: false // Not in user providers
        });
      } catch (error) {
        console.log('Direct error thrown:', error);
        throw error;
      }
    });

    it('should handle unauthenticated users', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const response = await GET();
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.models).toHaveLength(4);
      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });

    it('should handle missing user ID', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: null } },
        error: null
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });

    it('should handle supabase client creation failure', async () => {
      mockCreateClient.mockResolvedValue(null);

      const response = await GET();
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.models).toHaveLength(4);
      expect(mockGetAllModels).toHaveBeenCalled();
    });

    it('should handle database query errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      mockSupabaseClient.eq.mockReturnValue({
        data: null,
        error: new Error('Database connection failed')
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });

    it('should handle empty user providers', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      mockSupabaseClient.eq.mockReturnValue({
        data: [],
        error: null
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });

    it('should handle user with specific providers', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      mockSupabaseClient.eq.mockReturnValue({
        data: [{ provider: 'openai' }, { provider: 'google' }],
        error: null
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsForUserProviders).toHaveBeenCalledWith(['openai', 'google']);
    });

    it('should check environment variable availability correctly', async () => {
      process.env = {
        ...originalEnv,
        OPENAI_API_KEY: 'sk-test',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-key', // Alternative Google env var
        // Missing other keys
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const response = await GET();
      const responseData = await response.json();

      const openaiModel = responseData.models.find((m: any) => m.providerId === 'openai');
      expect(openaiModel.credentialInfo.envAvailable).toBe(true);

      const googleModel = responseData.models.find((m: any) => m.providerId === 'google');
      expect(googleModel.credentialInfo.envAvailable).toBe(true);

      const anthropicModel = responseData.models.find((m: any) => m.providerId === 'anthropic');
      expect(anthropicModel.credentialInfo.envAvailable).toBe(false);
    });

    it('should handle Google API key variants', async () => {
      process.env = {
        ...originalEnv,
        GOOGLE_API_KEY: 'test-key-1',
        GOOGLE_GENERATIVE_AI_API_KEY: 'test-key-2', // Both present
      };

      const response = await GET();
      const responseData = await response.json();

      const googleModel = responseData.models.find((m: any) => m.providerId === 'google');
      expect(googleModel.credentialInfo.envAvailable).toBe(true);
    });

    it('should handle unknown provider gracefully', async () => {
      const modelsWithUnknownProvider = [
        ...mockModels,
        {
          id: 'unknown-model',
          name: 'Unknown Model',
          providerId: 'unknown-provider',
          provider: 'unknown-provider',
          baseProviderId: 'unknown-provider',
          accessible: true
        }
      ];

      mockGetAllModels.mockResolvedValue(modelsWithUnknownProvider);
      mockCreateClient.mockResolvedValue(null);

      const response = await GET();
      const responseData = await response.json();

      const unknownModel = responseData.models.find((m: any) => m.providerId === 'unknown-provider');
      expect(unknownModel.credentialInfo.envAvailable).toBe(false);
      expect(unknownModel.credentialInfo.guestByokAvailable).toBe(true);
      expect(unknownModel.credentialInfo.userByokAvailable).toBe(false);
    });

    it('should handle general errors gracefully', async () => {
      mockGetAllModels.mockRejectedValue(new Error('Models service unavailable'));
      mockCreateClient.mockResolvedValue(null);

      const response = await GET();
      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to fetch models');
    });

    it('should handle authentication errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth service unavailable')
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });

    it('should preserve model accessibility flags', async () => {
      const modelsWithVariedAccess = [
        { id: 'model-1', name: 'Model 1', providerId: 'openai', provider: 'openai', baseProviderId: 'openai', accessible: true },
        { id: 'model-2', name: 'Model 2', providerId: 'openai', provider: 'openai', baseProviderId: 'openai', accessible: false },
      ];

      mockGetAllModels.mockResolvedValue(modelsWithVariedAccess);
      mockCreateClient.mockResolvedValue(null);

      const response = await GET();
      const responseData = await response.json();

      expect(responseData.models[0].accessible).toBe(true);
      expect(responseData.models[1].accessible).toBe(false);
    });
  });

  describe('POST /api/models', () => {
    it('should refresh models cache successfully', async () => {
      const response = await POST();
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.message).toBe('Models cache refreshed');
      expect(responseData.models).toHaveLength(4);
      expect(responseData.count).toBe(4);
      expect(responseData.timestamp).toBeDefined();

      expect(mockRefreshModelsCache).toHaveBeenCalled();
      expect(mockGetAllModels).toHaveBeenCalled();
    });

    it('should handle cache refresh errors', async () => {
      mockRefreshModelsCache.mockImplementation(() => {
        throw new Error('Cache refresh failed');
      });

      const response = await POST();
      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to refresh models');
    });

    it('should handle model loading errors after refresh', async () => {
      mockGetAllModels.mockRejectedValue(new Error('Models loading failed'));

      const response = await POST();
      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to refresh models');
    });

    it('should return proper timestamp format', async () => {
      const beforeTime = new Date();
      const response = await POST();
      const afterTime = new Date();
      
      const responseData = await response.json();
      const timestamp = new Date(responseData.timestamp);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('Environment Variable Detection', () => {
    it('should detect OpenAI API key', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const response = await GET();
      const responseData = await response.json();
      
      const openaiModel = responseData.models.find((m: any) => m.providerId === 'openai');
      expect(openaiModel.credentialInfo.envAvailable).toBe(true);
    });

    it('should detect Anthropic API key', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      
      const response = await GET();
      const responseData = await response.json();
      
      const anthropicModel = responseData.models.find((m: any) => m.providerId === 'anthropic');
      expect(anthropicModel.credentialInfo.envAvailable).toBe(true);
    });

    it('should detect Google API keys (both variants)', async () => {
      // Test GOOGLE_API_KEY
      process.env = { ...originalEnv, GOOGLE_API_KEY: 'test-key' };
      let response = await GET();
      let responseData = await response.json();
      let googleModel = responseData.models.find((m: any) => m.providerId === 'google');
      expect(googleModel.credentialInfo.envAvailable).toBe(true);

      // Test GOOGLE_GENERATIVE_AI_API_KEY
      process.env = { ...originalEnv, GOOGLE_GENERATIVE_AI_API_KEY: 'test-key' };
      response = await GET();
      responseData = await response.json();
      googleModel = responseData.models.find((m: any) => m.providerId === 'google');
      expect(googleModel.credentialInfo.envAvailable).toBe(true);
    });

    it('should detect other provider keys', async () => {
      process.env = {
        ...originalEnv,
        MISTRAL_API_KEY: 'test-mistral',
        PERPLEXITY_API_KEY: 'test-perplexity',
        XAI_API_KEY: 'test-xai',
        OPENROUTER_API_KEY: 'test-openrouter'
      };

      const response = await GET();
      const responseData = await response.json();

      const mistralModel = responseData.models.find((m: any) => m.providerId === 'mistral');
      if (mistralModel) {
        expect(mistralModel.credentialInfo.envAvailable).toBe(true);
      }

      // Add more provider models to test if needed
    });

    it('should handle empty environment variables', async () => {
      vi.unstubAllEnvs();

      const response = await GET();
      const responseData = await response.json();

      responseData.models.forEach((model: any) => {
        expect(model.credentialInfo.envAvailable).toBe(false);
        expect(model.credentialInfo.guestByokAvailable).toBe(true);
      });
    });
  });

  describe('User Provider Integration', () => {
    it('should mark models as user available when user has provider keys', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      mockSupabaseClient.eq.mockReturnValue({
        data: [{ provider: 'openai' }, { provider: 'anthropic' }],
        error: null
      });

      const response = await GET();
      const responseData = await response.json();

      const openaiModel = responseData.models.find((m: any) => m.providerId === 'openai');
      expect(openaiModel.credentialInfo.userByokAvailable).toBe(true);

      const googleModel = responseData.models.find((m: any) => m.providerId === 'google');
      expect(googleModel.credentialInfo.userByokAvailable).toBe(false);
    });

    it('should handle null user provider data', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      });

      mockSupabaseClient.eq.mockReturnValue({
        data: null,
        error: null
      });

      const response = await GET();
      expect(response.status).toBe(200);

      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of models efficiently', async () => {
      const largeModelSet = Array.from({ length: 100 }, (_, i) => ({
        id: `model-${i}`,
        name: `Model ${i}`,
        providerId: 'openai',
        provider: 'openai',
        baseProviderId: 'openai',
        accessible: true
      }));

      mockGetAllModels.mockResolvedValue(largeModelSet);
      mockCreateClient.mockResolvedValue(null);

      const startTime = Date.now();
      const response = await GET();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast

      const responseData = await response.json();
      expect(responseData.models).toHaveLength(100);
    });

    it('should handle concurrent requests safely', async () => {
      const [response1, response2, response3] = await Promise.all([
        GET(),
        GET(),
        GET()
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });

    it('should handle memory cleanup properly', async () => {
      await GET();
      
      // Verify mocks are called correct number of times
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });
  });
});