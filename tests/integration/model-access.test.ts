import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getModels } from '@/app/api/models/route';
import { POST as chatHandler } from '@/app/api/chat/route';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock model data
vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(() => [
    { id: 'gpt-4o-mini', providerId: 'openai', name: 'GPT-4o Mini' },
    { id: 'claude-3-haiku', providerId: 'anthropic', name: 'Claude 3 Haiku' },
    { id: 'gemini-1.5-flash', providerId: 'google', name: 'Gemini 1.5 Flash' },
    { id: 'mistral-large-latest', providerId: 'mistral', name: 'Mistral Large' },
    { id: 'deepseek-chat', providerId: 'deepseek', name: 'DeepSeek Chat' },
    { id: 'openrouter:deepseek/deepseek-r1:free', providerId: 'openrouter', name: 'DeepSeek R1 Free' },
    { id: 'ollama:llama3', providerId: 'ollama', name: 'Llama 3 (Local)' },
  ]),
  getModelsWithAccessFlags: vi.fn(),
  getModelsForUserProviders: vi.fn(),
  refreshModelsCache: vi.fn(),
  getModelInfo: vi.fn(),
}));

// Mock environment variables
const originalEnv = process.env;

describe('E2E: Model Access Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Guest User Access', () => {
    beforeEach(() => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(null); // No auth = guest user
    });

    it('should allow guest users to access free models', async () => {
      const { getModelsWithAccessFlags } = require('@/lib/models');
      getModelsWithAccessFlags.mockResolvedValue([
        { id: 'gpt-4o-mini', providerId: 'openai', accessible: true },
        { id: 'openrouter:deepseek/deepseek-r1:free', providerId: 'openrouter', accessible: true },
        { id: 'ollama:llama3', providerId: 'ollama', accessible: true },
        { id: 'mistral-large-latest', providerId: 'mistral', accessible: true },
        { id: 'claude-3-haiku', providerId: 'anthropic', accessible: false },
      ]);

      const response = await getModels();
      const data = await response.json();

      expect(data.models).toBeDefined();
      expect(data.models.length).toBeGreaterThan(0);
      
      // Check free models are accessible
      const freeModel = data.models.find((m: any) => m.id === 'gpt-4o-mini');
      expect(freeModel?.accessible).toBe(true);
      
      const deepseekFree = data.models.find((m: any) => m.id === 'openrouter:deepseek/deepseek-r1:free');
      expect(deepseekFree?.accessible).toBe(true);
      
      // Check ollama is always accessible
      const ollamaModel = data.models.find((m: any) => m.id === 'ollama:llama3');
      expect(ollamaModel?.accessible).toBe(true);
    });

    it('should allow guest BYOK (bring your own key) for all models', async () => {
      const response = await getModels();
      const data = await response.json();

      data.models.forEach((model: any) => {
        expect(model.credentialInfo.guestByokAvailable).toBe(true);
      });
    });

    it('should handle guest chat requests with BYOK credentials', async () => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(null); // Guest user

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-api-key': 'test-api-key-123',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'claude-3-haiku',
        }),
      });

      // Mock the chat completion
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi!"}}]}\n\n'));
          controller.close();
        },
      });

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream,
      } as any);

      const response = await chatHandler(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Authenticated User Access', () => {
    it('should give authenticated users access to their provider models', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { provider: 'openai' },
                { provider: 'anthropic' },
              ],
              error: null,
            }),
          })),
        })),
      };
      createClient.mockResolvedValue(mockSupabase);

      const { getModelsForUserProviders } = require('@/lib/models');
      getModelsForUserProviders.mockResolvedValue([
        { id: 'gpt-4o-mini', providerId: 'openai', accessible: true },
        { id: 'claude-3-haiku', providerId: 'anthropic', accessible: true },
      ]);

      const response = await getModels();
      const data = await response.json();

      expect(data.models).toBeDefined();
      
      // Check user has access to their provider models
      const openaiModel = data.models.find((m: any) => m.providerId === 'openai');
      expect(openaiModel?.credentialInfo.userByokAvailable).toBe(true);
      
      const anthropicModel = data.models.find((m: any) => m.providerId === 'anthropic');
      expect(anthropicModel?.credentialInfo.userByokAvailable).toBe(true);
    });
  });

  describe('Environment-based Access', () => {
    it('should mark models as accessible when env keys are available', async () => {
      // Set environment variables
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(null); // Guest user

      const { getModelsWithAccessFlags } = require('@/lib/models');
      getModelsWithAccessFlags.mockResolvedValue([
        { id: 'gpt-4o-mini', providerId: 'openai', accessible: true },
        { id: 'claude-3-haiku', providerId: 'anthropic', accessible: true },
        { id: 'gemini-1.5-flash', providerId: 'google', accessible: false },
      ]);

      const response = await getModels();
      const data = await response.json();

      // Check env-based access
      const openaiModel = data.models.find((m: any) => m.providerId === 'openai');
      expect(openaiModel?.credentialInfo.envAvailable).toBe(true);
      
      const anthropicModel = data.models.find((m: any) => m.providerId === 'anthropic');
      expect(anthropicModel?.credentialInfo.envAvailable).toBe(true);
      
      const googleModel = data.models.find((m: any) => m.providerId === 'google');
      expect(googleModel?.credentialInfo.envAvailable).toBe(false);
    });
  });

  describe('Model Selection in Chat', () => {
    it('should reject requests for inaccessible models without credentials', async () => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(null); // Guest user

      const { getModelInfo } = require('@/lib/models');
      getModelInfo.mockReturnValue({ 
        id: 'claude-3-opus', 
        providerId: 'anthropic',
        accessible: false 
      });

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No API key provided
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'claude-3-opus',
        }),
      });

      const response = await chatHandler(request);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toContain('API key required');
    });

    it('should allow requests with valid provider API keys', async () => {
      const { createClient } = require('@/lib/supabase/server');
      createClient.mockResolvedValue(null); // Guest user

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-api-key': 'sk-valid-api-key',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4',
        }),
      });

      // Mock successful API response
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: new ReadableStream(),
      } as any);

      const response = await chatHandler(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Free Model Limits', () => {
    it('should enforce daily limits for free models', async () => {
      const { createClient } = require('@/lib/supabase/server');
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            gte: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { message_count: 10001 }, // Over limit
                error: null,
              }),
            })),
          })),
        })),
      };
      createClient.mockResolvedValue(mockSupabase);

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'gpt-4o-mini',
        }),
      });

      const response = await chatHandler(request);
      expect(response.status).toBe(429);
      
      const data = await response.json();
      expect(data.error).toContain('daily limit');
    });
  });

  describe('Model Feature Support', () => {
    it('should correctly identify models with vision capabilities', async () => {
      const { getAllModels } = require('@/lib/models');
      getAllModels.mockResolvedValue([
        { id: 'gpt-4-vision', providerId: 'openai', supportsImages: true },
        { id: 'claude-3-haiku', providerId: 'anthropic', supportsImages: true },
        { id: 'gpt-3.5-turbo', providerId: 'openai', supportsImages: false },
      ]);

      const response = await getModels();
      const data = await response.json();

      const visionModel = data.models.find((m: any) => m.id === 'gpt-4-vision');
      expect(visionModel?.supportsImages).toBe(true);
      
      const textOnlyModel = data.models.find((m: any) => m.id === 'gpt-3.5-turbo');
      expect(textOnlyModel?.supportsImages).toBe(false);
    });

    it('should correctly identify models with function calling support', async () => {
      const { getAllModels } = require('@/lib/models');
      getAllModels.mockResolvedValue([
        { id: 'gpt-4-turbo', providerId: 'openai', supportsFunctionCalling: true },
        { id: 'claude-2', providerId: 'anthropic', supportsFunctionCalling: false },
      ]);

      const response = await getModels();
      const data = await response.json();

      const functionModel = data.models.find((m: any) => m.id === 'gpt-4-turbo');
      expect(functionModel?.supportsFunctionCalling).toBe(true);
      
      const noFunctionModel = data.models.find((m: any) => m.id === 'claude-2');
      expect(noFunctionModel?.supportsFunctionCalling).toBe(false);
    });
  });
});