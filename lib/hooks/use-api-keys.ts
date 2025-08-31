import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CredentialResolver } from '@/lib/services/credential-resolver';
import type {
  ApiKey,
  GuestCredential,
  StorageScope,
} from '@/lib/services/types';
import { ValidationService } from '@/lib/services/validation-service';

type UseApiKeysState = {
  apiKeys: Record<string, ApiKey>;
  guestCredentials: Record<string, GuestCredential>;
  loading: Record<string, boolean>;
  isGuest: boolean;
};

type UseApiKeysActions = {
  loadApiKeys: () => Promise<void>;
  saveApiKey: (
    provider: string,
    key: string,
    storageScope?: StorageScope,
    passphrase?: string
  ) => Promise<void>;
  deleteApiKey: (provider: string) => Promise<void>;
  testApiKey: (provider: string) => Promise<void>;
  loadPersistentCredential: (
    provider: string,
    passphrase: string
  ) => Promise<void>;
};

export function useApiKeys(
  userId?: string
): UseApiKeysState & UseApiKeysActions {
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKey>>({});
  const [guestCredentials, setGuestCredentials] = useState<
    Record<string, GuestCredential>
  >({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const resolver = new CredentialResolver(userId);
  const validationService = new ValidationService();
  const isGuest = resolver.isGuestMode();

  const setProviderLoading = useCallback(
    (provider: string, isLoading: boolean) => {
      setLoading((prev) => ({ ...prev, [provider]: isLoading }));
    },
    []
  );

  const loadApiKeys = useCallback(async () => {
    try {
      const service = resolver.getApiKeyService();

      if (isGuest) {
        const credentials = await (service as any).loadCredentials();
        setGuestCredentials(credentials);
      } else {
        const keys = await (service as any).loadApiKeys();
        setApiKeys(keys);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
      toast.error('Failed to load API keys');
    }
  }, [resolver, isGuest]);

  const saveApiKey = useCallback(
    async (
      provider: string,
      key: string,
      storageScope?: StorageScope,
      passphrase?: string
    ) => {
      if (!key) {
        toast.error('Please enter an API key');
        return;
      }

      // Validate the request
      const validation = validationService.validateStorageRequest({
        provider,
        key,
        storageScope,
        passphrase,
      });

      if (!validation.isValid) {
        toast.error(validation.error);
        return;
      }

      setProviderLoading(provider, true);

      try {
        const service = resolver.getApiKeyService();

        if (isGuest) {
          const credential = await (service as any).saveCredential({
            provider,
            key,
            storageScope,
            passphrase,
          });

          setGuestCredentials((prev) => ({
            ...prev,
            [provider]: credential,
          }));

          toast.success(`${provider} API key saved (${storageScope} storage)`);
        } else {
          const savedKey = await (service as any).saveApiKey({
            provider,
            key,
          });

          setApiKeys((prev) => ({
            ...prev,
            [provider]: savedKey,
          }));

          toast.success(`${provider} API key saved successfully`);
        }
      } catch (error) {
        console.error('Failed to save API key:', error);
        toast.error((error as Error).message || 'Failed to save API key');
      } finally {
        setProviderLoading(provider, false);
      }
    },
    [resolver, validationService, isGuest, setProviderLoading]
  );

  const deleteApiKey = useCallback(
    async (provider: string) => {
      setProviderLoading(provider, true);

      try {
        const service = resolver.getApiKeyService();

        if (isGuest) {
          await (service as any).deleteCredential(provider);
          setGuestCredentials((prev) => {
            const updated = { ...prev };
            delete updated[provider];
            return updated;
          });
          toast.success(`${provider} API key deleted from local storage`);
        } else {
          await (service as any).deleteApiKey(provider);
          setApiKeys((prev) => {
            const updated = { ...prev };
            delete updated[provider];
            return updated;
          });
          toast.success(`${provider} API key deleted`);
        }
      } catch (error) {
        console.error('Failed to delete API key:', error);
        toast.error('Failed to delete API key');
      } finally {
        setProviderLoading(provider, false);
      }
    },
    [resolver, isGuest, setProviderLoading]
  );

  const testApiKey = useCallback(
    async (provider: string) => {
      setProviderLoading(`test-${provider}`, true);

      try {
        const service = resolver.getApiKeyService();
        const result = await (service as any).testApiKey(provider);

        if (result.success) {
          toast.success(`${provider} API key is valid`);
        } else {
          toast.error(`${provider} API key test failed: ${result.error}`);
        }
      } catch (error) {
        toast.error('Failed to test API key');
      } finally {
        setProviderLoading(`test-${provider}`, false);
      }
    },
    [resolver, setProviderLoading]
  );

  const loadPersistentCredential = useCallback(
    async (provider: string, passphrase: string) => {
      if (!isGuest) return;

      try {
        const service = resolver.getApiKeyService() as any;
        const credential = await service.loadPersistentCredential(
          provider,
          passphrase
        );

        setGuestCredentials((prev) => ({
          ...prev,
          [provider]: credential,
        }));

        toast.success(`${provider} API key loaded from persistent storage`);
      } catch (error) {
        toast.error('Invalid passphrase or corrupted data');
      }
    },
    [resolver, isGuest]
  );

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  return {
    // State
    apiKeys,
    guestCredentials,
    loading,
    isGuest,
    // Actions
    loadApiKeys,
    saveApiKey,
    deleteApiKey,
    testApiKey,
    loadPersistentCredential,
  };
}
