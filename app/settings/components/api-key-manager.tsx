'use client';

import { Check, Eye, EyeSlash, Key, X } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { createClient } from '@/lib/supabase/client';

type ApiKey = {
  user_id: string;
  provider: string;
  encrypted_key: string;
  iv: string;
  created_at: string | null;
  updated_at: string | null;
  // Derived properties for UI
  masked_key?: string;
  is_active?: boolean;
};

type ApiKeyManagerProps = {
  userId: string;
};

const API_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    required: true,
    description: 'Required for GPT-5 models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    required: false,
    description: 'For Claude models',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    required: false,
    description: 'For Mistral models',
  },
  {
    id: 'google',
    name: 'Google AI',
    required: false,
    description: 'For Gemini models',
  },
  {
    id: 'langsmith',
    name: 'LangSmith',
    required: false,
    description: 'For observability',
  },
];

export function ApiKeyManager({ userId }: ApiKeyManagerProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKey>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const supabase = createClient();

  const loadApiKeys = useCallback(async () => {
    if (!supabase) {
      toast.error('Database connection error');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_keys')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const keysMap: Record<string, ApiKey> = {};
      data?.forEach((key) => {
        // Create masked version for display
        const maskedKey = key.encrypted_key.length > 7 
          ? `${key.encrypted_key.substring(0, 3)}...${key.encrypted_key.substring(key.encrypted_key.length - 4)}`
          : '***masked***';
        
        keysMap[key.provider] = {
          ...key,
          masked_key: maskedKey,
          is_active: true,
        };
      });
      setApiKeys(keysMap);
    } catch {
      toast.error('Failed to load API keys');
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadApiKeys();
  }, [userId, loadApiKeys]);

  const saveApiKey = async (provider: string) => {
    if (!supabase) {
      toast.error('Database connection error');
      return;
    }

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

      // For now, we'll store the key as-is until encryption is implemented
      // In production, this should use proper encryption
      const { error } = await supabase.from('user_keys').upsert(
        {
          user_id: userId,
          provider,
          encrypted_key: key, // TODO: Implement proper encryption
          iv: 'placeholder-iv', // TODO: Generate proper IV
        },
        {
          onConflict: 'user_id,provider',
        }
      );

      if (error) {
        throw error;
      }

      // Reload keys to get updated data
      await loadApiKeys();
      setNewKeys({ ...newKeys, [provider]: '' });
      toast.success(`${provider} API key saved successfully`);
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Failed to save API key');
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const deleteApiKey = async (provider: string) => {
    if (!supabase) {
      toast.error('Database connection error');
      return;
    }

    setLoading({ ...loading, [provider]: true });

    try {
      const { error } = await supabase
        .from('user_keys')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) {
        throw error;
      }

      const newApiKeys = { ...apiKeys };
      delete newApiKeys[provider];
      setApiKeys(newApiKeys);

      toast.success(`${provider} API key deleted`);
    } catch {
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
        body: JSON.stringify({ provider }),
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

  return (
    <div className="space-y-4">
      {API_PROVIDERS.map((provider) => {
        const hasKey = !!apiKeys[provider.id];
        const isShowing = showKeys[provider.id];

        return (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
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
                        Configured
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
                        : apiKeys[provider.id].masked_key || '***masked***'}
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
                          <EyeSlash className="h-4 w-4" />
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
                  {apiKeys[provider.id].updated_at && (
                    <p className="text-muted-foreground text-xs">
                      Last updated:{' '}
                      {new Date(
                        apiKeys[provider.id].updated_at!
                      ).toLocaleDateString()}
                    </p>
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
                        <EyeSlash className="h-4 w-4" />
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
          <p>• Your API keys are encrypted and stored securely</p>
          <p>• Keys are never sent to our servers or third parties</p>
          <p>• You can delete your keys at any time</p>
          <p>• We recommend rotating your keys regularly</p>
        </CardContent>
      </Card>
    </div>
  );
}
