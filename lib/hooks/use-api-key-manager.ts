'use client';

import { useState } from 'react';
import type { StorageScope } from '@/lib/services/types';

export function useApiKeyManager() {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [storageScope, setStorageScope] = useState<StorageScope>('session');

  const handleKeyChange = (provider: string, key: string) => {
    setNewKeys((prev) => ({ ...prev, [provider]: key }));
  };

  const handleToggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  };

  const clearNewKey = (provider: string) => {
    setNewKeys((prev) => ({ ...prev, [provider]: '' }));
  };

  return {
    showKeys,
    newKeys,
    storageScope,
    setStorageScope,
    handleKeyChange,
    handleToggleShowKey,
    clearNewKey,
  };
}
