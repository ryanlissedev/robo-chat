import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { GET, POST } from '@/app/api/models/route';
import type { ModelConfig } from '@/lib/models/types';

// Mock dependencies
vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(),
  getModelsForUserProviders: vi.fn(),
  getModelsWithAccessFlags: vi.fn(),
  refreshModelsCache: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Import mocked functions
import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from '@/lib/models';
import { createClient } from '@/lib/supabase/server';

// Mock model data
const mockModels: ModelConfig[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    providerId: 'openai',
    baseProviderId: 'openai',
    contextWindow: 8192,
    inputCost: 0.03,
    outputCost: 0.06,
    description: 'GPT-4 model',
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    providerId: 'anthropic',
    baseProviderId: 'anthropic',
    contextWindow: 200000,
    inputCost: 0.003,
    outputCost: 0.015,
    description: 'Claude 3 Sonnet model',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'Google',
    providerId: 'google',
    baseProviderId: 'google',
    contextWindow: 32768,
    inputCost: 0.0005,
    outputCost: 0.0015,
    description: 'Gemini Pro model',
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    provider: 'Mistral',
    providerId: 'mistral',
    baseProviderId: 'mistral',
    contextWindow: 32768,
    inputCost: 0.008,
    outputCost: 0.024,
    description: 'Mistral Large model',
  },
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xAI',
    providerId: 'xai',
    baseProviderId: 'xai',
    contextWindow: 131072,
    inputCost: 0.002,
    outputCost: 0.01,
    description: 'Grok 2 model',
  },
];

const mockModelsWithAccess = mockModels.map((model) => ({
  ...model,
  accessible: true,
}));

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
};

describe('/api/models', () => {
  let mockGetAllModels: Mock;
  let mockGetModelsWithAccessFlags: Mock;
  let mockGetModelsForUserProviders: Mock;
  let mockRefreshModelsCache: Mock;
  let mockCreateClient: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Cast imported functions as mocks
    mockGetAllModels = getAllModels as Mock;
    mockGetModelsWithAccessFlags = getModelsWithAccessFlags as Mock;
    mockGetModelsForUserProviders = getModelsForUserProviders as Mock;
    mockRefreshModelsCache = refreshModelsCache as Mock;
    mockCreateClient = createClient as Mock;

    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  describe('GET - Unauthenticated requests (no Supabase)', () => {
    beforeEach(() => {
      mockCreateClient.mockResolvedValue(null);
      mockGetAllModels.mockResolvedValue(mockModels);
    });

    it('should return all models with credentialInfo when no environment variables are set', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models).toHaveLength(mockModels.length);

      data.models.forEach((model: any) => {
        expect(model).toHaveProperty('accessible', true);
        expect(model.credentialInfo).toEqual({
          envAvailable: false,
          guestByokAvailable: true,
          userByokAvailable: false,
        });
      });
    });

    it('should detect environment variables correctly for each provider', async () => {
      // Set environment variables
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-test';
      process.env.MISTRAL_API_KEY = 'mistral-test';
      process.env.XAI_API_KEY = 'xai-test';

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);

      const openaiModel = data.models.find(
        (m: any) => m.providerId === 'openai'
      );
      const anthropicModel = data.models.find(
        (m: any) => m.providerId === 'anthropic'
      );
      const googleModel = data.models.find(
        (m: any) => m.providerId === 'google'
      );
      const mistralModel = data.models.find(
        (m: any) => m.providerId === 'mistral'
      );
      const xaiModel = data.models.find((m: any) => m.providerId === 'xai');

      expect(openaiModel.credentialInfo.envAvailable).toBe(true);
      expect(anthropicModel.credentialInfo.envAvailable).toBe(true);
      expect(googleModel.credentialInfo.envAvailable).toBe(true);
      expect(mistralModel.credentialInfo.envAvailable).toBe(true);
      expect(xaiModel.credentialInfo.envAvailable).toBe(true);
    });

    it('should detect GOOGLE_API_KEY as alternative to GOOGLE_GENERATIVE_AI_API_KEY', async () => {
      process.env.GOOGLE_API_KEY = 'google-alt-test';

      const response = await GET();
      const data = await response.json();

      const googleModel = data.models.find(
        (m: any) => m.providerId === 'google'
      );
      expect(googleModel.credentialInfo.envAvailable).toBe(true);
    });
  });

  describe('GET - Guest users (authenticated but no user ID)', () => {
    beforeEach(() => {
      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
      });
      mockGetModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccess);
    });

    it('should return models with access flags and credentialInfo', async () => {
      process.env.OPENAI_API_KEY = 'sk-test';

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();

      data.models.forEach((model: any) => {
        expect(model).toHaveProperty('credentialInfo');
        expect(model.credentialInfo.guestByokAvailable).toBe(true);
        expect(model.credentialInfo.userByokAvailable).toBe(false);
      });

      const openaiModel = data.models.find(
        (m: any) => m.providerId === 'openai'
      );
      expect(openaiModel.credentialInfo.envAvailable).toBe(true);
    });
  });

  describe('GET - Authenticated users', () => {
    const mockUserId = 'user-123';

    beforeEach(() => {
      mockCreateClient.mockResolvedValue(mockSupabaseClient as any);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
      });
    });

    it('should handle database error gracefully', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      }));

      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });
      mockGetModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccess);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();

      data.models.forEach((model: any) => {
        expect(model).toHaveProperty('credentialInfo');
      });
    });

    it('should return models with access flags when user has no BYOK keys', async () => {
      const mockSelect = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });
      mockGetModelsWithAccessFlags.mockResolvedValue(mockModelsWithAccess);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetModelsWithAccessFlags).toHaveBeenCalled();

      data.models.forEach((model: any) => {
        expect(model.credentialInfo.userByokAvailable).toBe(false);
      });
    });

    it('should return user provider models with enhanced credentialInfo', async () => {
      const userProviders = ['openai', 'anthropic'];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          data: userProviders.map((provider) => ({ provider })),
          error: null,
        }),
      }));

      mockSupabaseClient.from.mockReturnValue({ select: mockSelect });
      mockGetModelsForUserProviders.mockResolvedValue(
        mockModels
          .filter((m) => userProviders.includes(m.providerId))
          .map((m) => ({ ...m, accessible: true }))
      );

      // Set some env vars
      process.env.OPENAI_API_KEY = 'sk-test';

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockGetModelsForUserProviders).toHaveBeenCalledWith(userProviders);

      const openaiModel = data.models.find(
        (m: any) => m.providerId === 'openai'
      );
      const anthropicModel = data.models.find(
        (m: any) => m.providerId === 'anthropic'
      );

      expect(openaiModel.credentialInfo).toEqual({
        envAvailable: true,
        guestByokAvailable: true,
        userByokAvailable: true,
      });

      expect(anthropicModel.credentialInfo).toEqual({
        envAvailable: false,
        guestByokAvailable: true,
        userByokAvailable: true,
      });
    });
  });

  describe('GET - Error handling', () => {
    it('should return 500 when an unexpected error occurs', async () => {
      mockCreateClient.mockRejectedValue(new Error('Unexpected error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch models');
    });
  });

  describe('POST - Refresh models cache', () => {
    it('should refresh cache and return models with metadata', async () => {
      mockGetAllModels.mockResolvedValue(mockModels);

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockRefreshModelsCache).toHaveBeenCalled();
      expect(data.message).toBe('Models cache refreshed');
      expect(data.models).toEqual(mockModels);
      expect(data.count).toBe(mockModels.length);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle refresh errors gracefully', async () => {
      mockRefreshModelsCache.mockImplementation(() => {
        throw new Error('Cache refresh failed');
      });

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to refresh models');
    });
  });

  describe('Environment variable detection', () => {
    it('should correctly identify all supported providers', async () => {
      // Set all environment variables
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-test';
      process.env.MISTRAL_API_KEY = 'mistral-test';
      process.env.PERPLEXITY_API_KEY = 'pplx-test';
      process.env.XAI_API_KEY = 'xai-test';
      process.env.OPENROUTER_API_KEY = 'or-test';

      mockCreateClient.mockResolvedValue(null);
      mockGetAllModels.mockResolvedValue(mockModels);

      const response = await GET();
      const data = await response.json();

      const providerAvailability = data.models.reduce(
        (acc: any, model: any) => {
          acc[model.providerId] = model.credentialInfo.envAvailable;
          return acc;
        },
        {}
      );

      expect(providerAvailability.openai).toBe(true);
      expect(providerAvailability.anthropic).toBe(true);
      expect(providerAvailability.google).toBe(true);
      expect(providerAvailability.mistral).toBe(true);
      expect(providerAvailability.xai).toBe(true);
    });

    it('should handle partial environment variable availability', async () => {
      // Only set some environment variables
      process.env.OPENAI_API_KEY = 'sk-test';
      process.env.MISTRAL_API_KEY = 'mistral-test';

      mockCreateClient.mockResolvedValue(null);
      mockGetAllModels.mockResolvedValue(mockModels);

      const response = await GET();
      const data = await response.json();

      const openaiModel = data.models.find(
        (m: any) => m.providerId === 'openai'
      );
      const anthropicModel = data.models.find(
        (m: any) => m.providerId === 'anthropic'
      );
      const mistralModel = data.models.find(
        (m: any) => m.providerId === 'mistral'
      );

      expect(openaiModel.credentialInfo.envAvailable).toBe(true);
      expect(anthropicModel.credentialInfo.envAvailable).toBe(false);
      expect(mistralModel.credentialInfo.envAvailable).toBe(true);
    });
  });
});
