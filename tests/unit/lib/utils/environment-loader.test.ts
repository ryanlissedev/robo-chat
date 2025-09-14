import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadEnvironmentConfig,
  validateEnvironmentConfig,
  getProviderApiKey,
  isLangSmithConfigured,
  getVectorStoreConfig,
  type EnvironmentConfig,
} from '@/lib/utils/environment-loader';

describe('environment-loader utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to clean state
    vi.resetModules();
    process.env = {};
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadEnvironmentConfig', () => {
    it('should load configuration from environment variables', () => {
      process.env.OPENAI_API_KEY = 'openai-test-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-test-key';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-test-key';
      process.env.OPENAI_VECTOR_STORE_IDS = 'store1,store2,store3';
      process.env.LANGSMITH_API_KEY = 'langsmith-key';
      process.env.LANGSMITH_PROJECT = 'test-project';
      process.env.LANGSMITH_ENDPOINT = 'https://langsmith.example.com';
      process.env.LANGSMITH_TRACING = 'true';
      process.env.LANGSMITH_TRACING_V2 = 'enabled';

      const config = loadEnvironmentConfig();

      expect(config).toEqual({
        openaiApiKey: 'openai-test-key',
        anthropicApiKey: 'anthropic-test-key',
        googleApiKey: 'google-test-key',
        vectorStoreIds: ['store1', 'store2', 'store3'],
        langsmithConfig: {
          apiKey: 'langsmith-key',
          project: 'test-project',
          endpoint: 'https://langsmith.example.com',
          tracing: 'true',
          tracingV2: 'enabled',
        },
      });
    });

    it('should handle missing environment variables gracefully', () => {
      const config = loadEnvironmentConfig();

      expect(config).toEqual({
        openaiApiKey: undefined,
        anthropicApiKey: undefined,
        googleApiKey: undefined,
        vectorStoreIds: ['vs_6849955367a88191bf89d7660230325f'], // Default fallback
        langsmithConfig: {
          apiKey: undefined,
          project: undefined,
          endpoint: undefined,
          tracing: undefined,
          tracingV2: undefined,
        },
      });
    });

    it('should prefer OPENAI_VECTOR_STORE_IDS over OPENAI_VECTORSTORE', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'plural1,plural2';
      process.env.OPENAI_VECTORSTORE = 'singular1,singular2';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual(['plural1', 'plural2']);
    });

    it('should use OPENAI_VECTORSTORE when OPENAI_VECTOR_STORE_IDS is not available', () => {
      process.env.OPENAI_VECTORSTORE = 'singular1,singular2,singular3';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual([
        'singular1',
        'singular2',
        'singular3',
      ]);
    });

    it('should filter out empty strings from vector store IDs', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'store1,,store2,';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual(['store1', 'store2']);
    });

    it('should use default vector store when both plural and singular are empty', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = '';
      process.env.OPENAI_VECTORSTORE = '';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual([
        'vs_6849955367a88191bf89d7660230325f',
      ]);
    });

    it('should use default vector store when both plural and singular have only empty strings', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = ',,,';
      process.env.OPENAI_VECTORSTORE = ',,';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual([
        'vs_6849955367a88191bf89d7660230325f',
      ]);
    });

    it('should handle single vector store ID without commas', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'single-store';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual(['single-store']);
    });

    it('should handle partial LangSmith configuration', () => {
      process.env.LANGSMITH_API_KEY = 'partial-key';
      // Missing LANGSMITH_PROJECT

      const config = loadEnvironmentConfig();

      expect(config.langsmithConfig).toEqual({
        apiKey: 'partial-key',
        project: undefined,
        endpoint: undefined,
        tracing: undefined,
        tracingV2: undefined,
      });
    });

    it('should handle complex vector store IDs with special characters', () => {
      process.env.OPENAI_VECTOR_STORE_IDS =
        'vs_abc123,vs_def456-ghi,vs_789_xyz';

      const config = loadEnvironmentConfig();

      expect(config.vectorStoreIds).toEqual([
        'vs_abc123',
        'vs_def456-ghi',
        'vs_789_xyz',
      ]);
    });
  });

  describe('validateEnvironmentConfig', () => {
    it('should return null when all required keys are present', () => {
      const config: EnvironmentConfig = {
        openaiApiKey: 'test-key',
        anthropicApiKey: 'test-key',
        vectorStoreIds: ['store1'],
      };

      const result = validateEnvironmentConfig(config, [
        'openaiApiKey',
        'anthropicApiKey',
      ]);

      expect(result).toBeNull();
    });

    it('should return error message for missing required key', () => {
      const config: EnvironmentConfig = {
        openaiApiKey: 'test-key',
        // anthropicApiKey missing
        vectorStoreIds: ['store1'],
      };

      const result = validateEnvironmentConfig(config, [
        'openaiApiKey',
        'anthropicApiKey',
      ]);

      expect(result).toBe(
        'Missing required environment variable for anthropicApiKey'
      );
    });

    it('should return error for first missing key when multiple are missing', () => {
      const config: EnvironmentConfig = {
        // Both keys missing
        vectorStoreIds: ['store1'],
      };

      const result = validateEnvironmentConfig(config, [
        'openaiApiKey',
        'anthropicApiKey',
      ]);

      expect(result).toBe(
        'Missing required environment variable for openaiApiKey'
      );
    });

    it('should handle empty required keys array', () => {
      const config: EnvironmentConfig = {};

      const result = validateEnvironmentConfig(config, []);

      expect(result).toBeNull();
    });

    it('should handle undefined values as missing', () => {
      const config: EnvironmentConfig = {
        openaiApiKey: undefined,
        anthropicApiKey: 'test-key',
      };

      const result = validateEnvironmentConfig(config, ['openaiApiKey']);

      expect(result).toBe(
        'Missing required environment variable for openaiApiKey'
      );
    });

    it('should handle empty string values as missing', () => {
      const config: EnvironmentConfig = {
        openaiApiKey: '',
        anthropicApiKey: 'test-key',
      };

      const result = validateEnvironmentConfig(config, ['openaiApiKey']);

      expect(result).toBe(
        'Missing required environment variable for openaiApiKey'
      );
    });

    it('should validate vectorStoreIds array', () => {
      const config: EnvironmentConfig = {
        vectorStoreIds: [],
      };

      const result = validateEnvironmentConfig(config, ['vectorStoreIds']);

      expect(result).toBe(
        'Missing required environment variable for vectorStoreIds'
      );
    });

    it('should accept non-empty vectorStoreIds array', () => {
      const config: EnvironmentConfig = {
        vectorStoreIds: ['store1'],
      };

      const result = validateEnvironmentConfig(config, ['vectorStoreIds']);

      expect(result).toBeNull();
    });

    it('should validate langsmithConfig object', () => {
      const config: EnvironmentConfig = {
        langsmithConfig: undefined,
      };

      const result = validateEnvironmentConfig(config, ['langsmithConfig']);

      expect(result).toBe(
        'Missing required environment variable for langsmithConfig'
      );
    });
  });

  describe('getProviderApiKey', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'google-key';
    });

    it('should return OpenAI API key for "openai" provider', () => {
      const key = getProviderApiKey('openai');

      expect(key).toBe('openai-key');
    });

    it('should return Anthropic API key for "anthropic" provider', () => {
      const key = getProviderApiKey('anthropic');

      expect(key).toBe('anthropic-key');
    });

    it('should return Google API key for "google" provider', () => {
      const key = getProviderApiKey('google');

      expect(key).toBe('google-key');
    });

    it('should handle case-insensitive provider names', () => {
      expect(getProviderApiKey('OPENAI')).toBe('openai-key');
      expect(getProviderApiKey('Anthropic')).toBe('anthropic-key');
      expect(getProviderApiKey('GOOGLE')).toBe('google-key');
    });

    it('should return undefined for unknown provider', () => {
      const key = getProviderApiKey('unknown-provider');

      expect(key).toBeUndefined();
    });

    it('should return undefined when environment variable is not set', () => {
      delete process.env.OPENAI_API_KEY;

      const key = getProviderApiKey('openai');

      expect(key).toBeUndefined();
    });

    it('should handle empty string provider names', () => {
      const key = getProviderApiKey('');

      expect(key).toBeUndefined();
    });

    it('should handle provider names with extra whitespace', () => {
      const key = getProviderApiKey('  openai  ');

      expect(key).toBe('openai-key');
    });

    it('should handle mixed case variations', () => {
      expect(getProviderApiKey('OpenAI')).toBe('openai-key');
      expect(getProviderApiKey('AnThRoPiC')).toBe('anthropic-key');
      expect(getProviderApiKey('GoOgLe')).toBe('google-key');
    });
  });

  describe('isLangSmithConfigured', () => {
    it('should return true when both API key and project are configured', () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = 'test-project';

      const result = isLangSmithConfigured();

      expect(result).toBe(true);
    });

    it('should return false when API key is missing', () => {
      process.env.LANGSMITH_PROJECT = 'test-project';
      // LANGSMITH_API_KEY missing

      const result = isLangSmithConfigured();

      expect(result).toBe(false);
    });

    it('should return false when project is missing', () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      // LANGSMITH_PROJECT missing

      const result = isLangSmithConfigured();

      expect(result).toBe(false);
    });

    it('should return false when both are missing', () => {
      // Both LANGSMITH_API_KEY and LANGSMITH_PROJECT missing

      const result = isLangSmithConfigured();

      expect(result).toBe(false);
    });

    it('should return false when API key is empty string', () => {
      process.env.LANGSMITH_API_KEY = '';
      process.env.LANGSMITH_PROJECT = 'test-project';

      const result = isLangSmithConfigured();

      expect(result).toBe(false);
    });

    it('should return false when project is empty string', () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = '';

      const result = isLangSmithConfigured();

      expect(result).toBe(false);
    });

    it('should ignore other LangSmith configuration fields', () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = 'test-project';
      process.env.LANGSMITH_ENDPOINT = 'https://test.com';
      process.env.LANGSMITH_TRACING = 'true';

      const result = isLangSmithConfigured();

      expect(result).toBe(true);
    });

    it('should handle undefined vs empty string correctly', () => {
      process.env.LANGSMITH_API_KEY = 'test-key';
      process.env.LANGSMITH_PROJECT = 'undefined'; // String "undefined", not actual undefined

      const result = isLangSmithConfigured();

      expect(result).toBe(true);
    });
  });

  describe('getVectorStoreConfig', () => {
    it('should return configuration with vector stores', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'store1,store2';

      const config = getVectorStoreConfig();

      expect(config).toEqual({
        vectorStoreIds: ['store1', 'store2'],
        hasVectorStores: true,
      });
    });

    it('should return default configuration when no stores are configured', () => {
      // No vector store environment variables set

      const config = getVectorStoreConfig();

      expect(config).toEqual({
        vectorStoreIds: ['vs_6849955367a88191bf89d7660230325f'],
        hasVectorStores: true, // Default store is available
      });
    });

    it('should handle empty vector store configuration', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = '';
      process.env.OPENAI_VECTORSTORE = '';

      const config = getVectorStoreConfig();

      expect(config).toEqual({
        vectorStoreIds: ['vs_6849955367a88191bf89d7660230325f'],
        hasVectorStores: true,
      });
    });

    it('should handle single vector store', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'single-store';

      const config = getVectorStoreConfig();

      expect(config).toEqual({
        vectorStoreIds: ['single-store'],
        hasVectorStores: true,
      });
    });

    it('should handle multiple vector stores with filtering', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'store1,,store2,store3,';

      const config = getVectorStoreConfig();

      expect(config).toEqual({
        vectorStoreIds: ['store1', 'store2', 'store3'],
        hasVectorStores: true,
      });
    });

    it('should prioritize plural environment variable', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = 'plural-store';
      process.env.OPENAI_VECTORSTORE = 'singular-store';

      const config = getVectorStoreConfig();

      expect(config.vectorStoreIds).toEqual(['plural-store']);
    });

    it('should fallback to singular environment variable', () => {
      process.env.OPENAI_VECTORSTORE = 'singular-store1,singular-store2';

      const config = getVectorStoreConfig();

      expect(config.vectorStoreIds).toEqual([
        'singular-store1',
        'singular-store2',
      ]);
    });

    it('should handle whitespace in vector store IDs', () => {
      process.env.OPENAI_VECTOR_STORE_IDS = ' store1 , store2 , store3 ';

      const config = getVectorStoreConfig();

      // Note: The implementation doesn't trim whitespace, so this reflects actual behavior
      expect(config.vectorStoreIds).toEqual([
        ' store1 ',
        ' store2 ',
        ' store3 ',
      ]);
      expect(config.hasVectorStores).toBe(true);
    });
  });

  describe('edge cases and integration', () => {
    it('should handle all environment variables being set to empty strings', () => {
      process.env.OPENAI_API_KEY = '';
      process.env.ANTHROPIC_API_KEY = '';
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = '';
      process.env.OPENAI_VECTOR_STORE_IDS = '';
      process.env.LANGSMITH_API_KEY = '';
      process.env.LANGSMITH_PROJECT = '';

      const config = loadEnvironmentConfig();

      expect(config.openaiApiKey).toBe('');
      expect(config.anthropicApiKey).toBe('');
      expect(config.googleApiKey).toBe('');
      expect(config.vectorStoreIds).toEqual([
        'vs_6849955367a88191bf89d7660230325f',
      ]);
      expect(config.langsmithConfig?.apiKey).toBe('');
      expect(config.langsmithConfig?.project).toBe('');

      expect(getProviderApiKey('openai')).toBe('');
      expect(isLangSmithConfigured()).toBe(false);
    });

    it('should handle configuration with special characters and unicode', () => {
      process.env.OPENAI_API_KEY = 'key-with-special-chars!@#$%^&*()_+-=';
      process.env.LANGSMITH_PROJECT = 'project-with-unicode-café-🚀';
      process.env.OPENAI_VECTOR_STORE_IDS =
        'store-with-émojis-🔥,another-store-日本語';

      const config = loadEnvironmentConfig();

      expect(config.openaiApiKey).toBe('key-with-special-chars!@#$%^&*()_+-=');
      expect(config.langsmithConfig?.project).toBe(
        'project-with-unicode-café-🚀'
      );
      expect(config.vectorStoreIds).toEqual([
        'store-with-émojis-🔥',
        'another-store-日本語',
      ]);
    });

    it('should maintain consistency across multiple calls', () => {
      process.env.OPENAI_API_KEY = 'consistent-key';
      process.env.LANGSMITH_API_KEY = 'consistent-langsmith';
      process.env.LANGSMITH_PROJECT = 'consistent-project';

      const config1 = loadEnvironmentConfig();
      const config2 = loadEnvironmentConfig();
      const key1 = getProviderApiKey('openai');
      const key2 = getProviderApiKey('openai');
      const langsmith1 = isLangSmithConfigured();
      const langsmith2 = isLangSmithConfigured();

      expect(config1).toEqual(config2);
      expect(key1).toBe(key2);
      expect(langsmith1).toBe(langsmith2);
    });

    it('should handle very long environment variable values', () => {
      const longKey = 'a'.repeat(1000);
      const longStoreIds = Array.from(
        { length: 100 },
        (_, i) => `store-${i}`
      ).join(',');

      process.env.OPENAI_API_KEY = longKey;
      process.env.OPENAI_VECTOR_STORE_IDS = longStoreIds;

      const config = loadEnvironmentConfig();

      expect(config.openaiApiKey).toBe(longKey);
      expect(config.vectorStoreIds).toHaveLength(100);
      expect(config.vectorStoreIds?.[0]).toBe('store-0');
      expect(config.vectorStoreIds?.[99]).toBe('store-99');
    });
  });
});
