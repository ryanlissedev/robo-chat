import type {
  IValidationService,
  SaveApiKeyRequest,
  ValidationResult,
} from './types';

export class ValidationService implements IValidationService {
  validateApiKey(provider: string, key: string): ValidationResult {
    if (!key || key.trim().length === 0) {
      return {
        isValid: false,
        error: 'API key cannot be empty',
      };
    }

    // Provider-specific validation rules
    switch (provider.toLowerCase()) {
      case 'openai':
        if (!key.startsWith('sk-')) {
          return {
            isValid: false,
            error: 'Invalid OpenAI API key format. Must start with "sk-"',
          };
        }
        break;

      case 'anthropic':
        if (!key.startsWith('sk-ant-')) {
          return {
            isValid: false,
            error:
              'Invalid Anthropic API key format. Must start with "sk-ant-"',
          };
        }
        break;

      case 'google':
        // Google API keys are typically 39 characters long
        if (key.length < 20) {
          return {
            isValid: false,
            error: 'Invalid Google API key format. Key appears too short',
          };
        }
        break;

      case 'mistral':
        // Mistral keys typically have specific patterns
        if (key.length < 20) {
          return {
            isValid: false,
            error: 'Invalid Mistral API key format. Key appears too short',
          };
        }
        break;
    }

    // Basic length validation
    if (key.length < 10) {
      return {
        isValid: false,
        error: 'API key appears too short to be valid',
      };
    }

    if (key.length > 200) {
      return {
        isValid: false,
        error: 'API key appears too long to be valid',
      };
    }

    return { isValid: true };
  }

  validateStorageRequest(request: SaveApiKeyRequest): ValidationResult {
    // Validate the API key first
    const keyValidation = this.validateApiKey(request.provider, request.key);
    if (!keyValidation.isValid) {
      return keyValidation;
    }

    // Validate provider
    if (!request.provider || request.provider.trim().length === 0) {
      return {
        isValid: false,
        error: 'Provider is required',
      };
    }

    // Validate storage scope for guest mode
    if (request.storageScope) {
      const validScopes = ['request', 'tab', 'session', 'persistent'];
      if (!validScopes.includes(request.storageScope)) {
        return {
          isValid: false,
          error: 'Invalid storage scope',
        };
      }

      // Validate passphrase for persistent storage
      if (
        request.storageScope === 'persistent' &&
        (!request.passphrase || request.passphrase.trim().length < 8)
      ) {
        return {
          isValid: false,
          error:
            'Passphrase must be at least 8 characters for persistent storage',
        };
      }
    }

    return { isValid: true };
  }
}
