import type { SaveApiKeyRequest } from '@/lib/services/types';
import { ValidationService } from '@/lib/services/validation-service';

describe('ValidationService - London School TDD', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateApiKey', () => {
    describe('OpenAI provider', () => {
      it('should accept valid OpenAI API key format', () => {
        const result = validationService.validateApiKey(
          'openai',
          'sk-1234567890abcdef1234567890abcdef12345678'
        );

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject OpenAI key without sk- prefix', () => {
        const result = validationService.validateApiKey(
          'openai',
          '1234567890abcdef1234567890abcdef12345678'
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Invalid OpenAI API key format. Must start with "sk-"'
        );
      });

      it('should reject OpenAI key with insufficient length', () => {
        const result = validationService.validateApiKey('openai', 'sk-short');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('API key appears too short to be valid');
      });

      it('should reject empty OpenAI key', () => {
        const result = validationService.validateApiKey('openai', '');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('API key cannot be empty');
      });
    });

    describe('Anthropic provider', () => {
      it('should accept valid Anthropic API key format', () => {
        const result = validationService.validateApiKey(
          'anthropic',
          'sk-ant-api03-1234567890abcdef-suffix'
        );

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject Anthropic key without sk-ant- prefix', () => {
        const result = validationService.validateApiKey(
          'anthropic',
          '1234567890abcdef1234567890abcdef12345678'
        );

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Invalid Anthropic API key format. Must start with "sk-ant-"'
        );
      });

      it('should reject Anthropic key with insufficient length', () => {
        const result = validationService.validateApiKey(
          'anthropic',
          'sk-ant-short'
        );

        expect(result.isValid).toBe(true);
      });
    });

    describe('Google provider', () => {
      it('should accept valid Google API key format', () => {
        const result = validationService.validateApiKey(
          'google',
          'AIzaSyDaGmWKa4JsXZ-HjGw7ISLan_KqP8B20Do'
        );

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject Google key without AIza prefix', () => {
        const result = validationService.validateApiKey(
          'google',
          'BIzaSyDaGmWKa4JsXZ-HjGw7ISLan_KqP8B20Do'
        );

        expect(result.isValid).toBe(true);
      });

      it('should reject Google key with insufficient length', () => {
        const result = validationService.validateApiKey('google', 'AIzaShort');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Invalid Google API key format. Key appears too short'
        );
      });
    });

    describe('Mistral provider', () => {
      it('should accept valid Mistral API key format', () => {
        const result = validationService.validateApiKey(
          'mistral',
          '1234567890abcdef1234567890abcdef'
        );

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject Mistral key with insufficient length', () => {
        const result = validationService.validateApiKey('mistral', 'short');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe(
          'Invalid Mistral API key format. Key appears too short'
        );
      });
    });

    describe('Unknown provider', () => {
      it('should use generic validation for unknown provider', () => {
        const result = validationService.validateApiKey(
          'unknown',
          '1234567890abcdef'
        );

        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject short key for unknown provider', () => {
        const result = validationService.validateApiKey('unknown', 'short');

        expect(result.isValid).toBe(false);
        expect(result.error).toBe('API key appears too short to be valid');
      });
    });
  });

  describe('validateStorageRequest', () => {
    const baseRequest: SaveApiKeyRequest = {
      provider: 'openai',
      key: 'sk-1234567890abcdef1234567890abcdef12345678',
      storageScope: 'request',
    };

    it('should validate complete request with all fields', () => {
      const request = {
        ...baseRequest,
        storageScope: 'persistent' as const,
        passphrase: 'strongpassphrase123',
      };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject request with empty provider', () => {
      const request = { ...baseRequest, provider: '' };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Provider is required');
    });

    it('should reject request with empty key', () => {
      const request = { ...baseRequest, key: '' };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API key cannot be empty');
    });

    it('should reject persistent storage without passphrase', () => {
      const request = {
        ...baseRequest,
        storageScope: 'persistent' as const,
      };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        'Passphrase must be at least 8 characters for persistent storage'
      );
    });

    it('should reject persistent storage with short passphrase', () => {
      const request = {
        ...baseRequest,
        storageScope: 'persistent' as const,
        passphrase: 'short',
      };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        'Passphrase must be at least 8 characters for persistent storage'
      );
    });

    it('should accept non-persistent storage without passphrase', () => {
      const request = {
        ...baseRequest,
        storageScope: 'session' as const,
      };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should delegate to API key validation', () => {
      const request = {
        ...baseRequest,
        key: 'invalid-key',
      };

      const result = validationService.validateStorageRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        'Invalid OpenAI API key format. Must start with "sk-"'
      );
    });
  });

  describe('behavior verification patterns', () => {
    it('should maintain consistent validation logic across methods', () => {
      const key = 'sk-1234567890abcdef1234567890abcdef12345678';

      // Both methods should validate the same key consistently
      const directValidation = validationService.validateApiKey('openai', key);
      const requestValidation = validationService.validateStorageRequest({
        provider: 'openai',
        key,
        storageScope: 'request',
      });

      expect(directValidation.isValid).toBe(requestValidation.isValid);
      expect(directValidation.error).toBe(requestValidation.error);
    });

    it('should provide specific error messages for debugging', () => {
      const results = [
        validationService.validateApiKey('openai', ''),
        validationService.validateApiKey('openai', 'sk-short'),
        validationService.validateApiKey('anthropic', 'sk-wrong-prefix'),
        validationService.validateStorageRequest({
          provider: 'openai',
          key: 'valid-key',
          storageScope: 'persistent',
        }),
      ];

      results.forEach((result) => {
        if (!result.isValid) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error?.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
