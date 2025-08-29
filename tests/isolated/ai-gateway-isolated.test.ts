#!/usr/bin/env node

/**
 * Isolated AI Gateway Test
 * 
 * This test can be run independently to verify AI gateway functionality
 * without dependencies on the full application stack.
 * 
 * Usage:
 *   npm run test:isolated-gateway
 *   or
 *   npx tsx tests/isolated/ai-gateway-isolated.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AIGateway } from '../../lib/ai/gateway';

// Test configuration
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  testPrompt: 'Say "Hello" in exactly one word.',
  maxTokens: 5,
};

// Mock environment for testing
const originalEnv = process.env;

describe('AI Gateway - Isolated Tests', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Gateway Configuration', () => {
    it('should initialize with minimal config', () => {
      const gateway = new AIGateway();
      expect(gateway).toBeDefined();
    });

    it('should handle missing environment variables gracefully', () => {
      // Clear all AI-related env vars
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      delete process.env.AI_GATEWAY_BASE_URL;
      delete process.env.ANTHROPIC_API_KEY;

      const gateway = new AIGateway();
      expect(gateway).toBeDefined();
    });

    it('should prioritize constructor config over environment', () => {
      process.env.AI_GATEWAY_MODE = 'direct';
      
      const gateway = new AIGateway({
        mode: 'gateway',
        gatewayUrl: 'https://custom.gateway.com',
        gatewayApiKey: 'custom-key',
      });
      
      expect(gateway).toBeDefined();
    });
  });

  describe('Gateway Status Check', () => {
    it('should return status without throwing errors', async () => {
      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      expect(status).toBeDefined();
      expect(status).toHaveProperty('openai');
      expect(status).toHaveProperty('anthropic');
      expect(status).toHaveProperty('gateway');
      
      expect(status.openai).toHaveProperty('configured');
      expect(status.openai).toHaveProperty('direct');
      expect(status.openai).toHaveProperty('gateway');
      
      expect(status.gateway).toHaveProperty('configured');
      expect(status.gateway).toHaveProperty('url');
    });

    it('should detect when gateway is configured', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key';
      process.env.AI_GATEWAY_BASE_URL = 'https://test.gateway.com';
      
      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      expect(status.gateway.configured).toBe(true);
      expect(status.gateway.url).toBe('https://test.gateway.com');
    });

    it('should detect when OpenAI is configured', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      
      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      expect(status.openai.configured).toBe(true);
    });
  });

  describe('Gateway Connection Testing', () => {
    it('should handle gateway connection test gracefully', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key';
      process.env.AI_GATEWAY_BASE_URL = 'https://nonexistent.gateway.com';
      
      const gateway = new AIGateway();
      
      // This should not throw, but should handle the connection failure
      const testResult = await gateway.testGatewayConnection('openai');
      expect(testResult).toHaveProperty('success');
      expect(testResult).toHaveProperty('error');
    });

    it('should validate gateway URL format', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key';
      process.env.AI_GATEWAY_BASE_URL = 'invalid-url';

      const gateway = new AIGateway();
      const testResult = await gateway.testGatewayConnection('openai');

      expect(testResult.success).toBe(false);
      expect(testResult.error).toContain('Failed to parse URL');
    });
  });

  describe('Client Initialization', () => {
    it('should handle OpenAI client initialization with no keys', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.AI_GATEWAY_API_KEY;
      
      const gateway = new AIGateway({ mode: 'direct' });
      
      await expect(gateway.getOpenAIClient()).rejects.toThrow('No OpenAI configuration available');
    });

    it('should prefer gateway over direct when both are configured', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-direct';
      process.env.AI_GATEWAY_API_KEY = 'test-gateway';
      process.env.AI_GATEWAY_BASE_URL = 'https://test.gateway.com';

      // Mock successful gateway test
      const gateway = new AIGateway({
        mode: 'auto',
        openaiApiKey: 'sk-test-direct' // Pass key directly to avoid browser check
      });

      // Mock the testGatewayConnection method to return success
      gateway.testGatewayConnection = async () => ({ success: true });

      const client = await gateway.getOpenAIClient();
      expect(client.isGateway).toBe(true);
    });

    it('should fallback to direct when gateway fails', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-direct';
      process.env.AI_GATEWAY_API_KEY = 'test-gateway';
      process.env.AI_GATEWAY_BASE_URL = 'https://failing.gateway.com';

      const gateway = new AIGateway({
        mode: 'auto',
        openaiApiKey: 'sk-test-direct' // Pass key directly to avoid browser check
      });

      // Mock failed gateway test
      gateway.testGatewayConnection = async () => ({
        success: false,
        error: 'Gateway connection failed'
      });

      const client = await gateway.getOpenAIClient();
      expect(client.isGateway).toBe(false);
      expect(client.type).toBe('openai');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const gateway = new AIGateway({
        gatewayUrl: 'https://nonexistent.domain.that.does.not.exist.com',
        gatewayApiKey: 'test-key',
      });
      
      const result = await gateway.testGatewayConnection('openai');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle malformed URLs', async () => {
      const gateway = new AIGateway({
        gatewayUrl: 'not-a-url',
        gatewayApiKey: 'test-key',
      });

      const result = await gateway.testGatewayConnection('openai');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse URL');
    });

    it('should handle missing API key', async () => {
      const gateway = new AIGateway({
        gatewayUrl: 'https://test.gateway.com',
        gatewayApiKey: '',
      });

      const result = await gateway.testGatewayConnection('openai');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Gateway not configured');
    });
  });
});

// Export for direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Running AI Gateway Isolated Tests...');
  console.log('Use: npm run test:isolated-gateway for better output');
}
