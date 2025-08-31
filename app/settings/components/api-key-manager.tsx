'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useApiKeyManager } from '@/lib/hooks/use-api-key-manager';
import { useApiKeys } from '@/lib/hooks/use-api-keys';
import { ProviderList } from './provider-list';
import { StorageScopeSelector } from './storage-scope-selector';

type ApiKeyManagerProps = {
  userId?: string;
};

export function ApiKeyManager({ userId }: ApiKeyManagerProps) {
  const apiKeyService = useApiKeys(userId);
  const manager = useApiKeyManager();

  const handleSaveKey = async (provider: string) => {
    const key = manager.newKeys[provider];
    if (!key) return;

    await apiKeyService.saveApiKey(provider, key, manager.storageScope);
    manager.clearNewKey(provider);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            {apiKeyService.isGuest
              ? 'Store API keys locally in your browser'
              : 'Manage your API keys securely'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <StorageScopeSelector
            storageScope={manager.storageScope}
            onStorageScopeChange={manager.setStorageScope}
            isGuest={apiKeyService.isGuest}
          />

          <ProviderList
            apiKeys={apiKeyService.apiKeys}
            guestCredentials={apiKeyService.guestCredentials}
            isGuest={apiKeyService.isGuest}
            loading={apiKeyService.loading}
            newKeys={manager.newKeys}
            showKeys={manager.showKeys}
            onKeyChange={manager.handleKeyChange}
            onToggleShowKey={manager.handleToggleShowKey}
            onSaveKey={handleSaveKey}
            onDeleteKey={apiKeyService.deleteApiKey}
            onTestKey={apiKeyService.testApiKey}
          />
        </CardContent>
      </Card>
    </div>
  );
}
