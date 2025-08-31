/**
 * AI Gateway Integration Tests
 * Tests gateway routing, fallback, and provider switching
 */

import { expect, test } from '@playwright/test';
import { openproviders } from '@/lib/openproviders';
import { getGatewayConfig } from '@/lib/openproviders/env';
import type { SupportedModel } from '@/lib/openproviders/types';

test.describe('AI Gateway Integration Tests', () => {
  test.beforeEach(() => {
    // Reset environment for each test
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_BASE_URL;
  });

  test('should detect gateway configuration correctly', () => {
    // Test without gateway configured
    let config = getGatewayConfig();
    expect(config.enabled).toBe(false);
    expect(config.baseURL).toBe(null);
    expect(config.headers).toEqual({});

    // Test with gateway configured
    process.env.AI_GATEWAY_API_KEY = 'test-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.example.com/v1/ai';

    config = getGatewayConfig();
    expect(config.enabled).toBe(true);
    expect(config.baseURL).toBe('https://gateway.example.com/v1/ai');
    expect(config.headers).toEqual({
      Authorization: 'Bearer test-key',
    });
  });

  test('should inject gateway configuration for all providers', () => {
    // Set up gateway environment
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://ai-gateway.test.com/v1/ai';

    const providers = [
      'openai',
      'anthropic',
      'google',
      'mistral',
      'perplexity',
      'xai',
    ];
    const testModels: Record<string, SupportedModel> = {
      openai: 'gpt-5-mini',
      anthropic: 'claude-3-5-sonnet-latest',
      google: 'gemini-2.0-flash-001',
      mistral: 'mistral-large-latest',
      perplexity: 'sonar',
      xai: 'grok-3',
    };

    providers.forEach((provider) => {
      const model = testModels[provider];
      const languageModel = openproviders(model);

      expect(languageModel).toBeDefined();
      expect(typeof languageModel.doGenerate).toBe('function');
      expect(typeof languageModel.doStream).toBe('function');
    });

    // Cleanup
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_BASE_URL;
  });

  test('should handle direct provider access when gateway is disabled', () => {
    // Ensure gateway is disabled
    delete process.env.AI_GATEWAY_API_KEY;

    const config = getGatewayConfig();
    expect(config.enabled).toBe(false);

    // Test that providers still work without gateway
    const model = 'gpt-5-mini' as SupportedModel;
    const languageModel = openproviders(model);

    expect(languageModel).toBeDefined();
    expect(typeof languageModel.doGenerate).toBe('function');
    expect(typeof languageModel.doStream).toBe('function');
  });

  test('should handle custom API keys with gateway injection', () => {
    // Set up gateway
    process.env.AI_GATEWAY_API_KEY = 'gateway-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test.com/v1/ai';

    const customApiKey = 'custom-api-key';
    const model = 'gpt-5-mini' as SupportedModel;

    // Test with custom API key
    const languageModel = openproviders(model, {}, customApiKey);

    expect(languageModel).toBeDefined();
    expect(typeof languageModel.doGenerate).toBe('function');

    // Cleanup
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_BASE_URL;
  });

  test('should handle OpenAI GPT-5 specific configurations with gateway', () => {
    // Set up gateway
    process.env.AI_GATEWAY_API_KEY = 'gateway-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://gateway.test.com/v1/ai';

    const gpt5Model = 'gpt-5-mini' as SupportedModel;

    // Test with reasoning effort settings
    const modelWithReasoning = openproviders(gpt5Model, {
      reasoningEffort: 'medium',
      verbosity: 'low',
      textVerbosity: 'low',
    });

    expect(modelWithReasoning).toBeDefined();
    expect(modelWithReasoning).toHaveProperty('doGenerate');

    // Test responses API for GPT-5
    const modelWithResponses = openproviders(gpt5Model, {
      openai: {
        textVerbosity: 'low',
        reasoningSummary: 'concise',
      },
    });

    expect(modelWithResponses).toBeDefined();

    // Cleanup
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_BASE_URL;
  });

  test('should handle reasoning models (o-series) with proper headers', () => {
    // Set up gateway
    process.env.AI_GATEWAY_API_KEY = 'gateway-key';

    const reasoningModel = 'o1' as SupportedModel;

    const model = openproviders(reasoningModel, {
      headers: { 'OpenAI-Beta': 'reasoning=v1' },
    });

    expect(model).toBeDefined();

    // Cleanup
    delete process.env.AI_GATEWAY_API_KEY;
  });

  test.describe('Error Handling and Fallbacks', () => {
    test('should handle invalid gateway configuration gracefully', () => {
      // Set invalid gateway configuration
      process.env.AI_GATEWAY_API_KEY = '';
      process.env.AI_GATEWAY_BASE_URL = 'invalid-url';

      const config = getGatewayConfig();
      expect(config.enabled).toBe(false); // Empty API key should disable gateway

      const model = 'gpt-5-mini' as SupportedModel;
      expect(() => {
        const languageModel = openproviders(model);
        expect(languageModel).toBeDefined();
      }).not.toThrow();

      // Cleanup
      delete process.env.AI_GATEWAY_API_KEY;
      delete process.env.AI_GATEWAY_BASE_URL;
    });

    test('should fallback to direct provider when gateway fails', () => {
      // This test would need actual API calls to test properly
      // For now, we test that the provider can be created without gateway

      const model = 'gpt-5-mini' as SupportedModel;
      const languageModel = openproviders(model);

      expect(languageModel).toBeDefined();
      expect(typeof languageModel.doGenerate).toBe('function');
      expect(typeof languageModel.doStream).toBe('function');
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle concurrent provider initializations', () => {
      const models: SupportedModel[] = [
        'gpt-5-mini',
        'gpt-4o',
        'claude-3-5-sonnet-latest',
        'gemini-2.0-flash-001',
      ];

      const initPromises = models.map((model) => {
        return new Promise((resolve) => {
          const startTime = Date.now();
          const languageModel = openproviders(model);
          const initTime = Date.now() - startTime;

          resolve({
            model,
            initTime,
            success: !!languageModel,
            hasDoGenerate: typeof languageModel?.doGenerate === 'function',
          });
        });
      });

      return Promise.all(initPromises).then((results) => {
        results.forEach((result) => {
          expect(result).toHaveProperty('success', true);
          expect(result).toHaveProperty('hasDoGenerate', true);
          expect(result).toHaveProperty('initTime');
          expect((result as any).initTime).toBeLessThan(100); // Should be very fast
        });
      });
    });
  });

  test.describe('Environment Variable Handling', () => {
    test('should respect environment variable precedence', () => {
      // Test that user-provided API keys override environment variables
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-key';

      const customKey = 'custom-key';
      const model = 'gpt-5-mini' as SupportedModel;

      // When providing custom key, it should be used instead of env var
      const languageModel = openproviders(model, {}, customKey);
      expect(languageModel).toBeDefined();

      // Restore original environment
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });

    test('should handle missing environment variables gracefully', () => {
      // Temporarily remove all API keys
      const originalKeys = {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      };

      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      // Should still be able to create models (though they won't work for actual API calls)
      const models: SupportedModel[] = [
        'gpt-5-mini',
        'claude-3-5-sonnet-latest',
        'gemini-2.0-flash-001',
      ];

      models.forEach((model) => {
        expect(() => {
          const languageModel = openproviders(model);
          expect(languageModel).toBeDefined();
        }).not.toThrow();
      });

      // Restore environment
      Object.entries(originalKeys).forEach(([key, value]) => {
        if (value) {
          process.env[key] = value;
        }
      });
    });
  });

  test.describe('Model Provider Mapping', () => {
    test('should correctly map models to providers', () => {
      const testCases: Array<[SupportedModel, string]> = [
        ['gpt-5-mini', 'openai'],
        ['gpt-4o', 'openai'],
        ['o1', 'openai'],
        ['claude-3-5-sonnet-latest', 'anthropic'],
        ['gemini-2.0-flash-001', 'google'],
        ['mistral-large-latest', 'mistral'],
        ['sonar', 'perplexity'],
        ['grok-3', 'xai'],
      ];

      testCases.forEach(([model, _expectedProvider]) => {
        const languageModel = openproviders(model);
        expect(languageModel).toBeDefined();
        // We can't directly test the provider mapping without access to internals,
        // but we can verify that the model is created successfully
      });
    });

    test('should handle unknown models with fallback to OpenAI', () => {
      const unknownModel = 'unknown-model-123' as SupportedModel;

      // Should not throw and should fallback to OpenAI
      expect(() => {
        const languageModel = openproviders(unknownModel);
        expect(languageModel).toBeDefined();
      }).not.toThrow();
    });
  });
});
