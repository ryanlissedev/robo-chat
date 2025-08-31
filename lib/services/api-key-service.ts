import { createClient } from '@/lib/supabase/client';
import { clientLogger } from '@/lib/utils/client-logger';
import type {
  ApiKey,
  ApiKeyTestResult,
  IApiKeyService,
  SaveApiKeyRequest,
} from './types';

export class ApiKeyService implements IApiKeyService {
  private readonly supabase = createClient();

  constructor(private readonly userId: string) {}

  async loadApiKeys(): Promise<Record<string, ApiKey>> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    try {
      const { data, error } = await this.supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', this.userId);

      if (error) {
        // Handle case where table doesn't exist yet
        if (
          error.code === '42P01' ||
          error.message.includes('does not exist')
        ) {
          clientLogger.warn('user_api_keys table does not exist yet');
          return {};
        }
        throw error;
      }

      const keysMap: Record<string, ApiKey> = {};
      ((data as ApiKey[]) || []).forEach((key: ApiKey) => {
        keysMap[key.provider] = key;
      });

      return keysMap;
    } catch (error) {
      clientLogger.error('Failed to load API keys', error);
      throw new Error('Failed to load API keys');
    }
  }

  async saveApiKey(request: SaveApiKeyRequest): Promise<ApiKey> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    // Mask the key for storage (show only first 3 and last 4 characters)
    const maskedKey = `${request.key.substring(0, 3)}...${request.key.substring(
      request.key.length - 4
    )}`;

    try {
      const { error } = await this.supabase.from('user_api_keys').upsert(
        {
          user_id: this.userId,
          provider: request.provider,
          api_key: request.key, // This should be encrypted in production
          masked_key: maskedKey,
          is_active: true,
        },
        {
          onConflict: 'user_id,provider',
        }
      );

      if (error) {
        // Handle case where table doesn't exist yet
        if (
          error.code === '42P01' ||
          error.message.includes('does not exist')
        ) {
          throw new Error(
            'API key storage not yet configured. Please contact support.'
          );
        }
        throw error;
      }

      // Return the created API key
      return {
        id: `${this.userId}-${request.provider}`,
        provider: request.provider,
        masked_key: maskedKey,
        created_at: new Date().toISOString(),
        is_active: true,
      };
    } catch (error) {
      clientLogger.error('Failed to save API key', error);
      throw error;
    }
  }

  async deleteApiKey(provider: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Database not available');
    }

    try {
      const { error } = await this.supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', this.userId)
        .eq('provider', provider);

      if (error) {
        // Handle case where table doesn't exist yet
        if (
          error.code === '42P01' ||
          error.message.includes('does not exist')
        ) {
          clientLogger.warn('user_api_keys table does not exist yet');
          return;
        }
        throw error;
      }
    } catch (error) {
      clientLogger.error('Failed to delete API key', error);
      throw new Error('Failed to delete API key');
    }
  }

  async testApiKey(provider: string): Promise<ApiKeyTestResult> {
    try {
      const response = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, isGuest: false }),
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
