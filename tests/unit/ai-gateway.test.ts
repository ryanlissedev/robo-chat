/**
 * AI Gateway Test Suite
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIGateway, getAIGateway, createAIProvider } from '@/lib/ai/gateway';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Mock fetch globally
global.fetch = vi.fn();

// Mock OpenAI and Anthropic
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation((config) => ({
    _config: config,
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'test response' } }],
        }),
      },
    },
  })),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation((config) => ({
    _config: config,
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ text: 'test response' }],
      }),
    },
  })),
}));

describe('AIGateway', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    
    // Reset singleton
    (global as any).gatewayInstance = undefined;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Configuration', () => {
    it('should initialize with environment variables', () => {
      process.env.AI_GATEWAY_MODE = 'auto';
      process.env.AI_GATEWAY_BASE_URL = 'https://gateway.example.com';
      process.env.AI_GATEWAY_API_KEY = 'gateway-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';

      const gateway = new AIGateway();
      expect(gateway).toBeDefined();
    });

    it('should override config with constructor params', () => {
      const gateway = new AIGateway({
        mode: 'direct',
        openaiApiKey: 'custom-openai-key',
      });
      expect(gateway).toBeDefined();
    });

    it('should default to auto mode', () => {
      delete process.env.AI_GATEWAY_MODE;
      const gateway = new AIGateway();
      expect(gateway).toBeDefined();
    });
  });

  describe('OpenAI Client', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AI_GATEWAY_BASE_URL = 'https://gateway.example.com';
      process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    });

    it('should return direct OpenAI client when mode is direct', async () => {
      const gateway = new AIGateway({ mode: 'direct' });
      const client = await gateway.getOpenAIClient();
      
      expect(client.type).toBe('openai');
      expect(client.isGateway).toBe(false);
      expect(client.client).toBeDefined();
    });

    it('should try gateway first in auto mode', async () => {
      // Mock successful gateway test
      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ success: true }),
      });

      const gateway = new AIGateway({ mode: 'auto' });
      const client = await gateway.getOpenAIClient();
      
      expect(client.type).toBe('openai');
      expect(client.isGateway).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://gateway.example.com/openai/chat/completions',
        expect.any(Object)
      );
    });

    it('should fallback to direct when gateway fails', async () => {
      // Mock failed gateway test
      (global.fetch as any).mockResolvedValueOnce({
        status: 405,
        ok: false,
      });

      const gateway = new AIGateway({ mode: 'auto' });
      const client = await gateway.getOpenAIClient();
      
      expect(client.type).toBe('openai');
      expect(client.isGateway).toBe(false);
    });

    it('should throw error when no configuration available', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      
      const gateway = new AIGateway({ mode: 'direct' });
      await expect(gateway.getOpenAIClient()).rejects.toThrow('No OpenAI configuration available');
    });

    it('should cache gateway client after successful connection', async () => {
      // Reset mocks to ensure clean state
      vi.clearAllMocks();
      
      // Mock successful gateway test - only once
      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
      });

      const gateway = new AIGateway({ 
        mode: 'gateway',
        openaiApiKey: 'test-key',  // Add API key so it doesn't throw
        gatewayUrl: 'https://gateway.example.com',
        gatewayApiKey: 'gateway-key'
      });
      
      // First call should test connection and create client
      const client1 = await gateway.getOpenAIClient();
      expect(client1.isGateway).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cached client without testing again
      const client2 = await gateway.getOpenAIClient();
      expect(client2.isGateway).toBe(true);
      expect(client1.client).toBe(client2.client);
      
      // Should still only have called fetch once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Anthropic Client', () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    it('should return direct Anthropic client', async () => {
      const gateway = new AIGateway();
      const client = await gateway.getAnthropicClient();
      
      expect(client.type).toBe('anthropic');
      expect(client.isGateway).toBe(false);
      expect(client.client).toBeDefined();
    });

    it('should throw error when no Anthropic key available', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      const gateway = new AIGateway();
      await expect(gateway.getAnthropicClient()).rejects.toThrow('No Anthropic configuration available');
    });

    it('should cache Anthropic client', async () => {
      const gateway = new AIGateway();
      const client1 = await gateway.getAnthropicClient();
      const client2 = await gateway.getAnthropicClient();
      
      expect(client1.client).toBe(client2.client);
    });
  });

  describe('Status Check', () => {
    it('should report configuration status', async () => {
      process.env.OPENAI_API_KEY = 'test-openai';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';
      process.env.AI_GATEWAY_BASE_URL = 'https://gateway.example.com';
      process.env.AI_GATEWAY_API_KEY = 'test-gateway';

      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      expect(status.openai.configured).toBe(true);
      expect(status.anthropic.configured).toBe(true);
      expect(status.gateway.configured).toBe(true);
      expect(status.gateway.url).toBe('https://gateway.example.com');
    });

    it('should detect working providers', async () => {
      process.env.OPENAI_API_KEY = 'test-openai';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';
      
      const gateway = new AIGateway({ mode: 'direct' });
      const status = await gateway.getStatus();
      
      expect(status.openai.direct).toBe(true);
      expect(status.anthropic.direct).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-openai';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic';
    });

    it('should create OpenAI provider', async () => {
      const provider = await createAIProvider('openai');
      expect(provider.type).toBe('openai');
      expect(provider.client).toBeDefined();
    });

    it('should create Anthropic provider', async () => {
      const provider = await createAIProvider('anthropic');
      expect(provider.type).toBe('anthropic');
      expect(provider.client).toBeDefined();
    });

    it('should use singleton instance', () => {
      const gateway1 = getAIGateway();
      const gateway2 = getAIGateway();
      expect(gateway1).toBe(gateway2);
    });
  });

  describe('Gateway Connection Test', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const gateway = new AIGateway({ mode: 'auto' });
      const client = await gateway.getOpenAIClient();
      
      // Should fallback to direct
      expect(client.isGateway).toBe(false);
    });

    it('should accept auth errors as gateway working', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        status: 401,
        ok: false,
      });

      const gateway = new AIGateway({ mode: 'gateway' });
      const client = await gateway.getOpenAIClient();
      
      // 401 means gateway is responding, just auth failed
      expect(client.isGateway).toBe(true);
    });

    it('should reject 404/405 as gateway not configured', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        status: 404,
        ok: false,
      });

      const gateway = new AIGateway({ mode: 'auto' });
      const client = await gateway.getOpenAIClient();
      
      // Should fallback to direct
      expect(client.isGateway).toBe(false);
    });
  });
});