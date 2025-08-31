import {
  clearAllGuestCredentialsFor,
  getMemoryCredential,
  getMemoryCredentialPlaintext,
  getPersistentCredential,
  getSessionCredential,
  maskKey,
  setMemoryCredential,
  setPersistentCredential,
  setSessionCredential,
} from '@/lib/security/web-crypto';
import type {
  ApiKeyTestResult,
  GuestCredential,
  IGuestCredentialService,
  SaveApiKeyRequest,
} from './types';

const API_PROVIDERS = [
  'openai',
  'anthropic',
  'mistral',
  'google',
  'perplexity',
  'xai',
  'openrouter',
  'langsmith',
];

export class GuestCredentialService implements IGuestCredentialService {
  async loadCredentials(): Promise<Record<string, GuestCredential>> {
    const guestCreds: Record<string, GuestCredential> = {};

    for (const provider of API_PROVIDERS) {
      // Check tab storage first
      const memCred = getMemoryCredential(provider);
      if (memCred) {
        const plaintext = await getMemoryCredentialPlaintext(provider);
        guestCreds[provider] = {
          masked: memCred.masked,
          plaintext: plaintext || '',
          scope: 'tab',
        };
        continue;
      }

      // Check session storage
      try {
        const sessCred = await getSessionCredential(provider);
        if (sessCred) {
          guestCreds[provider] = {
            masked: sessCred.masked,
            plaintext: sessCred.plaintext,
            scope: 'session',
          };
        }
      } catch {
        // Session storage failed, continue to next provider
      }

      // Persistent storage requires passphrase, skip for automatic loading
    }

    return guestCreds;
  }

  async saveCredential(request: SaveApiKeyRequest): Promise<GuestCredential> {
    if (!request.storageScope) {
      throw new Error('Storage scope is required for guest credentials');
    }

    if (request.storageScope === 'persistent' && !request.passphrase) {
      throw new Error('Passphrase required for persistent storage');
    }

    let result: { masked: string };

    switch (request.storageScope) {
      case 'request':
        // For request-only, we don't store it anywhere
        result = { masked: maskKey(request.key) };
        break;
      case 'tab':
        result = await setMemoryCredential(request.provider, request.key);
        break;
      case 'session':
        result = await setSessionCredential(request.provider, request.key);
        break;
      case 'persistent':
        result = await setPersistentCredential(
          request.provider,
          request.key,
          request.passphrase || ''
        );
        break;
    }

    return {
      masked: result.masked,
      plaintext: request.storageScope === 'request' ? '' : request.key,
      scope: request.storageScope,
      passphrase:
        request.storageScope === 'persistent' ? request.passphrase : undefined,
    };
  }

  async deleteCredential(provider: string): Promise<void> {
    clearAllGuestCredentialsFor(provider);
  }

  async loadPersistentCredential(
    provider: string,
    passphrase: string
  ): Promise<GuestCredential> {
    const result = await getPersistentCredential(provider, passphrase);
    if (!result) {
      throw new Error('Invalid passphrase or no stored credential found');
    }

    return {
      masked: result.masked,
      plaintext: result.plaintext,
      scope: 'persistent',
      passphrase,
    };
  }

  async testApiKey(provider: string): Promise<ApiKeyTestResult> {
    try {
      const response = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, isGuest: true }),
      });

      const result = await response.json();

      return {
        success: result.success,
        error: result.error,
      };
    } catch (_error) {
      return {
        success: false,
        error: 'Failed to test API key',
      };
    }
  }
}
