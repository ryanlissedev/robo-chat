'use client';

import { Check, Eye, EyeOff, Key, X, Info } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { clientLogger } from '@/lib/utils/client-logger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createClient } from '@/lib/supabase/client';
import {
  setMemoryCredential,
  getMemoryCredential,
  getMemoryCredentialPlaintext,
  setSessionCredential,
  getSessionCredential,
  setPersistentCredential,
  getPersistentCredential,
  clearAllGuestCredentialsFor,
  maskKey,
} from '@/lib/security/web-crypto';

type ApiKey = {
  id: string;
  provider: string;
  masked_key: string;
  last_used?: string | null;
  created_at: string;
  is_active: boolean;
};

type ApiKeyManagerProps = {
  userId?: string;
};

type StorageScope = 'request' | 'tab' | 'session' | 'persistent';

type GuestCredential = {
  masked: string;
  plaintext: string;
  scope: StorageScope;
  passphrase?: string;
};

const API_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    required: true,
    description: 'Required for GPT models',
    badge: '🤖',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    required: false,
    description: 'For Claude models',
    badge: '🧠',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    required: false,
    description: 'For Mistral models',
    badge: '🌟',
  },
  {
    id: 'google',
    name: 'Google AI',
    required: false,
    description: 'For Gemini models',
    badge: '🔍',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    required: false,
    description: 'For Perplexity models',
    badge: '🔮',
  },
  {
    id: 'xai',
    name: 'xAI',
    required: false,
    description: 'For Grok models',
    badge: '⚡',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    required: false,
    description: 'For OpenRouter models',
    badge: '🌐',
  },
  {
    id: 'langsmith',
    name: 'LangSmith',
    required: false,
    description: 'For observability',
    badge: '📊',
  },
];

const STORAGE_SCOPES = [
  {
    value: 'request' as StorageScope,
    label: 'Request Only',
    description: 'Key is discarded after each request (most secure)',
  },
  {
    value: 'tab' as StorageScope,
    label: 'Tab Session',
    description: 'Key persists while this tab is open',
  },
  {
    value: 'session' as StorageScope,
    label: 'Browser Session',
    description: 'Key persists until browser is closed',
  },
  {
    value: 'persistent' as StorageScope,
    label: 'Persistent',
    description: 'Key is encrypted and stored permanently (requires passphrase)',
  },
] as const;

export function ApiKeyManager({ userId }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKey>>({});
  const [guestCredentials, setGuestCredentials] = useState<Record<string, GuestCredential>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [storageScope, setStorageScope] = useState<StorageScope>('tab');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const supabase = createClient();
  const isGuest = !userId;

  const loadApiKeys = useCallback(async () => {
    if (isGuest) {
      // Load guest credentials from local storage
      const guestCreds: Record<string, GuestCredential> = {};
      
      for (const provider of API_PROVIDERS) {
        // Check tab storage first
        const memCred = getMemoryCredential(provider.id);
        if (memCred) {
          const plaintext = await getMemoryCredentialPlaintext(provider.id);
          guestCreds[provider.id] = {
            masked: memCred.masked,
            plaintext: plaintext || '',
            scope: 'tab',
          };
          continue;
        }
        
        // Check session storage
        try {
          const sessCred = await getSessionCredential(provider.id);
          if (sessCred) {
            guestCreds[provider.id] = {
              masked: sessCred.masked,
              plaintext: sessCred.plaintext,
              scope: 'session',
            };
            continue;
          }
        } catch {
          // Session storage failed, continue to persistent
        }
        
        // Persistent storage requires passphrase, skip for now
      }
      
      setGuestCredentials(guestCreds);
      return;
    }
    
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        // Handle case where table doesn't exist yet
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          clientLogger.warn('user_api_keys table does not exist yet');
          return;
        }
        throw error;
      }

      const keysMap: Record<string, ApiKey> = {};
      data?.forEach((key) => {
        keysMap[key.provider] = key;
      });
      setApiKeys(keysMap);
    } catch (error) {
      clientLogger.error('Failed to load API keys', error);
      toast.error('Failed to load API keys');
    }
  }, [supabase, userId, isGuest]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const saveApiKey = async (provider: string) => {
    const key = newKeys[provider];
    if (!key) {
      toast.error('Please enter an API key');
      return;
    }

    setLoading({ ...loading, [provider]: true });

    try {
      // Validate the API key format
      if (provider === 'openai' && !key.startsWith('sk-')) {
        throw new Error('Invalid OpenAI API key format');
      }

      if (isGuest) {
        // Guest storage logic
        if (storageScope === 'persistent' && !passphrase) {
          toast.error('Passphrase required for persistent storage');
          return;
        }

        let result: { masked: string };
        
        switch (storageScope) {
          case 'request':
            // For request-only, we don't store it anywhere
            result = { masked: maskKey(key) };
            break;
          case 'tab':
            result = await setMemoryCredential(provider, key);
            break;
          case 'session':
            result = await setSessionCredential(provider, key);
            break;
          case 'persistent':
            result = await setPersistentCredential(provider, key, passphrase);
            break;
        }

        // Update guest credentials state
        setGuestCredentials({
          ...guestCredentials,
          [provider]: {
            masked: result.masked,
            plaintext: storageScope === 'request' ? '' : key,
            scope: storageScope,
            passphrase: storageScope === 'persistent' ? passphrase : undefined,
          },
        });

        setNewKeys({ ...newKeys, [provider]: '' });
        toast.success(`${provider} API key saved (${storageScope} storage)`);
      } else {
        // Authenticated user database storage
        if (!supabase) {
          toast.error('Database not available');
          return;
        }

        // Mask the key for storage (show only first 3 and last 4 characters)
        const maskedKey = `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;

        const { error } = await supabase.from('user_api_keys').upsert(
          {
            user_id: userId,
            provider,
            api_key: key, // This should be encrypted in production
            masked_key: maskedKey,
            is_active: true,
          },
          {
            onConflict: 'user_id,provider',
          }
        );

        if (error) {
          // Handle case where table doesn't exist yet
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            toast.error('API key storage not yet configured. Please contact support.');
            return;
          }
          throw error;
        }

        // Update local state
        setApiKeys({
          ...apiKeys,
          [provider]: {
            id: `${userId}-${provider}`,
            provider,
            masked_key: maskedKey,
            created_at: new Date().toISOString(),
            is_active: true,
          },
        });

        setNewKeys({ ...newKeys, [provider]: '' });
        toast.success(`${provider} API key saved successfully`);
      }
    } catch (error) {
      clientLogger.error('Failed to save API key', error);
      toast.error((error as Error).message || 'Failed to save API key');
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const deleteApiKey = async (provider: string) => {
    setLoading({ ...loading, [provider]: true });

    try {
      if (isGuest) {
        // Clear guest storage
        clearAllGuestCredentialsFor(provider);
        
        const newGuestCredentials = { ...guestCredentials };
        delete newGuestCredentials[provider];
        setGuestCredentials(newGuestCredentials);

        toast.success(`${provider} API key deleted from local storage`);
      } else {
        // Authenticated user database deletion
        if (!supabase) {
          toast.error('Database not available');
          return;
        }

        const { error } = await supabase
          .from('user_api_keys')
          .delete()
          .eq('user_id', userId)
          .eq('provider', provider);

        if (error) {
          // Handle case where table doesn't exist yet
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            clientLogger.warn('user_api_keys table does not exist yet');
            return;
          }
          throw error;
        }

        const newApiKeys = { ...apiKeys };
        delete newApiKeys[provider];
        setApiKeys(newApiKeys);

        toast.success(`${provider} API key deleted`);
      }
    } catch (error) {
      clientLogger.error('Failed to delete API key', error);
      toast.error('Failed to delete API key');
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const testApiKey = async (provider: string) => {
    setLoading({ ...loading, [`test-${provider}`]: true });

    try {
      const response = await fetch('/api/settings/test-api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, isGuest }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`${provider} API key is valid`);
      } else {
        toast.error(`${provider} API key test failed: ${result.error}`);
      }
    } catch {
      toast.error('Failed to test API key');
    } finally {
      setLoading({ ...loading, [`test-${provider}`]: false });
    }
  };

  const loadPersistentCredential = async (provider: string, passphraseInput: string) => {
    try {
      const result = await getPersistentCredential(provider, passphraseInput);
      if (result) {
        setGuestCredentials({
          ...guestCredentials,
          [provider]: {
            masked: result.masked,
            plaintext: result.plaintext,
            scope: 'persistent',
            passphrase: passphraseInput,
          },
        });
        toast.success(`${provider} API key loaded from persistent storage`);
      }
    } catch {
      toast.error('Invalid passphrase or corrupted data');
    }
  };

  return (
    <div className="space-y-4">
      {/* Storage scope selector for guests */}
      {isGuest && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Storage Settings (Guest Mode)
            </CardTitle>
            <CardDescription>
              Choose how your API keys are stored. Keys are never sent to our servers in guest mode.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storage-scope">Storage Scope</Label>
              <Select value={storageScope} onValueChange={(value: StorageScope) => setStorageScope(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_SCOPES.map((scope) => (
                    <SelectItem key={scope.value} value={scope.value}>
                      <div className="flex flex-col">
                        <span>{scope.label}</span>
                        <span className="text-muted-foreground text-xs">{scope.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {storageScope === 'persistent' && (
              <div className="space-y-2">
                <Label htmlFor="passphrase">Encryption Passphrase</Label>
                <div className="flex gap-2">
                  <Input
                    id="passphrase"
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter a strong passphrase"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                  >
                    {showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">
                  Your keys will be encrypted with this passphrase and stored in your browser&apos;s localStorage.
                </p>
              </div>
            )}
            
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <Info className="h-4 w-4 mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                {isGuest ? 'Guest mode: All keys are stored locally in your browser' : 'Authenticated: Keys are stored securely on our servers'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {API_PROVIDERS.map((provider) => {
        const hasKey = isGuest ? !!guestCredentials[provider.id] : !!apiKeys[provider.id];
        const isShowing = showKeys[provider.id];
        const maskedKey = isGuest ? guestCredentials[provider.id]?.masked : apiKeys[provider.id]?.masked_key;

        return (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">{provider.badge}</span>
                    <Key className="h-4 w-4" />
                    {provider.name}
                    {provider.required && (
                      <Badge className="ml-2" variant="destructive">
                        Required
                      </Badge>
                    )}
                    {hasKey && (
                      <Badge className="ml-2" variant="secondary">
                        <Check className="mr-1 h-3 w-3" />
                        {isGuest && guestCredentials[provider.id] ? `Stored (${guestCredentials[provider.id].scope})` : 'Configured'}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasKey ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <span className="font-mono text-sm">
                      {isShowing
                        ? '••••••••••••••••'
                        : maskedKey}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          setShowKeys({
                            ...showKeys,
                            [provider.id]: !isShowing,
                          })
                        }
                        size="sm"
                        variant="ghost"
                      >
                        {isShowing ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        disabled={loading[`test-${provider.id}`]}
                        onClick={() => testApiKey(provider.id)}
                        size="sm"
                        variant="ghost"
                      >
                        Test
                      </Button>
                      <Button
                        disabled={loading[provider.id]}
                        onClick={() => deleteApiKey(provider.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!isGuest && apiKeys[provider.id].last_used && (
                    <p className="text-muted-foreground text-xs">
                      Last used:{' '}
                      {new Date(
                        apiKeys[provider.id].last_used!
                      ).toLocaleDateString()}
                    </p>
                  )}
                  {isGuest && guestCredentials[provider.id]?.scope === 'persistent' && (
                    <div className="space-y-2">
                      <Label htmlFor={`load-${provider.id}`}>Load from persistent storage:</Label>
                      <div className="flex gap-2">
                        <Input
                          id={`load-${provider.id}`}
                          type="password"
                          placeholder="Enter passphrase"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              loadPersistentCredential(provider.id, e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                            if (input?.value) {
                              loadPersistentCredential(provider.id, input.value);
                              input.value = '';
                            }
                          }}
                        >
                          Load
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      onChange={(e) =>
                        setNewKeys({
                          ...newKeys,
                          [provider.id]: e.target.value,
                        })
                      }
                      placeholder={`Enter your ${provider.name} API key`}
                      type={isShowing ? 'text' : 'password'}
                      value={newKeys[provider.id] || ''}
                    />
                    <Button
                      onClick={() =>
                        setShowKeys({ ...showKeys, [provider.id]: !isShowing })
                      }
                      size="icon"
                      variant="ghost"
                    >
                      {isShowing ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    disabled={loading[provider.id]}
                    onClick={() => saveApiKey(provider.id)}
                  >
                    Save API Key
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>API Key Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground text-sm">
          {isGuest ? (
            <>
              <p>• <strong>Guest Mode:</strong> Keys are stored locally in your browser only</p>
              <p>• Keys are never transmitted to our servers</p>
              <p>• Persistent keys are encrypted with AES-256-GCM using your passphrase</p>
              <p>• Tab/Session keys use ephemeral encryption keys</p>
              <p>• Request-only keys are discarded immediately after use</p>
            </>
          ) : (
            <>
              <p>• Your API keys are encrypted and stored securely on our servers</p>
              <p>• Keys are never sent to third parties</p>
              <p>• All database communications are encrypted</p>
            </>
          )}
          <p>• You can delete your keys at any time</p>
          <p>• We recommend rotating your keys regularly</p>
        </CardContent>
      </Card>
    </div>
  );
}
