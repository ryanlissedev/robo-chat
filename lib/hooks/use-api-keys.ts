import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CredentialResolver } from '@/lib/services/credential-resolver';
import type {
  ApiKey,
  GuestCredential,
  IApiKeyService,
  IGuestCredentialService,
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
        const credentials = await (
          service as IGuestCredentialService
        ).loadCredentials();
        setGuestCredentials(credentials);
      } else {
        const keys = await (service as IApiKeyService).loadApiKeys();
        setApiKeys(keys);
      }
    } catch (_error) {
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
          const credential = await (
            service as IGuestCredentialService
          ).saveCredential({
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
          const savedKey = await (service as IApiKeyService).saveApiKey({
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
          await (service as IGuestCredentialService).deleteCredential(provider);
          setGuestCredentials((prev) => {
            const updated = { ...prev };
            delete updated[provider];
            return updated;
          });
          toast.success(`${provider} API key deleted from local storage`);
        } else {
          await (service as IApiKeyService).deleteApiKey(provider);
          setApiKeys((prev) => {
            const updated = { ...prev };
            delete updated[provider];
            return updated;
          });
          toast.success(`${provider} API key deleted`);
        }
      } catch (_error) {
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
        if ('testApiKey' in service) {
          const result = await (service as IApiKeyService).testApiKey(provider);
          if (result.success) {
            toast.success(`${provider} API key is valid`);
          } else {
            toast.error(`${provider} API key test failed: ${result.error}`);
          }
        } else {
          toast.error('Testing not available in guest mode');
        }
      } catch (_error) {
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
        const service = resolver.getApiKeyService() as IGuestCredentialService;
        const credential = await service.loadPersistentCredential(
          provider,
          passphrase
        );

        setGuestCredentials((prev) => ({
          ...prev,
          [provider]: credential,
        }));

        toast.success(`${provider} API key loaded from persistent storage`);
      } catch (_error) {
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
