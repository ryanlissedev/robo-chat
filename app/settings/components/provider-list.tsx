'use client';

import { Button } from '@/components/ui/button';
import { API_PROVIDERS } from '@/lib/constants/api-providers';
import type {
  ApiKey,
  GuestCredential,
  ApiKeyTestResult,
  ValidationResult,
} from '@/lib/services/types';
import { KeyTestResult } from './key-test-result';
import { ProviderKeyInput } from './provider-key-input';

type ProviderListProps = {
  apiKeys: Record<string, ApiKey>;
  guestCredentials: Record<string, GuestCredential>;
  isGuest: boolean;
  loading: Record<string, boolean>;
  validation?: Record<string, ValidationResult>;
  testResults?: Record<string, ApiKeyTestResult>;
  newKeys: Record<string, string>;
  showKeys: Record<string, boolean>;
  onKeyChange: (provider: string, key: string) => void;
  onToggleShowKey: (provider: string) => void;
  onSaveKey: (provider: string) => void;
  onDeleteKey: (provider: string) => void;
  onTestKey: (provider: string) => void;
};

export function ProviderList({
  apiKeys,
  guestCredentials,
  isGuest,
  loading,
  validation,
  testResults,
  newKeys,
  showKeys,
  onKeyChange,
  onToggleShowKey,
  onSaveKey,
  onDeleteKey,
  onTestKey,
}: ProviderListProps) {
  const getExistingKey = (provider: string) => {
    return isGuest ? undefined : apiKeys[provider];
  };

  return (
    <>
      {API_PROVIDERS.map((provider) => (
        <div
          key={provider.id}
          className="space-y-4 border-b pb-4 last:border-b-0"
        >
          <ProviderKeyInput
            provider={provider}
            existingKey={getExistingKey(provider.id)}
            newKey={newKeys[provider.id] || ''}
            onKeyChange={(key) => onKeyChange(provider.id, key)}
            onSave={() => onSaveKey(provider.id)}
            onDelete={() => onDeleteKey(provider.id)}
            validation={validation?.[provider.id]}
            showKey={showKeys[provider.id] || false}
            onToggleShowKey={() => onToggleShowKey(provider.id)}
            isLoading={loading[provider.id]}
          />

          <KeyTestResult
            testResult={testResults?.[provider.id]}
            isLoading={loading[`test-${provider.id}`]}
          />

          {getExistingKey(provider.id) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTestKey(provider.id)}
              disabled={loading[`test-${provider.id}`]}
            >
              Test Key
            </Button>
          )}
        </div>
      ))}
    </>
  );
}
