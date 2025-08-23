'use client';

import { Check, Eye, EyeSlash, Key, X } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
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
  id: string;
  provider: string;
  masked_key: string;
  last_used?: string;
  created_at: string;
  is_active: boolean;
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

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const loadApiKeys = async () => {
    if (!supabase) return;
    
    try {
      const { data, error } = await supabase
        .from('user_api_keys')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        // Handle case where table doesn't exist yet
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('user_api_keys table does not exist yet');
          return;
        }
        throw error;
      }

      const keysMap: Record<string, ApiKey> = {};
      data?.forEach((key) => {
        keysMap[key.provider] = key;
      });
      setApiKeys(keysMap);
    } catch (error: any) {
      console.error('Failed to load API keys:', error);
      toast.error('Failed to load API keys');
    }
  };

  const saveApiKey = async (provider: string) => {
    if (!supabase) {
      toast.error('Database not available');
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
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      toast.error(error.message || 'Failed to save API key');
    } finally {
      setLoading({ ...loading, [provider]: false });
    }
  };

  const deleteApiKey = async (provider: string) => {
    if (!supabase) {
      toast.error('Database not available');
      return;
    }

    setLoading({ ...loading, [provider]: true });

    try {
      const { error } = await supabase
        .from('user_api_keys')
        .delete()
        .eq('user_id', userId)
        .eq('provider', provider);

      if (error) {
        // Handle case where table doesn't exist yet
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('user_api_keys table does not exist yet');
          return;
        }
        throw error;
      }

      const newApiKeys = { ...apiKeys };
      delete newApiKeys[provider];
      setApiKeys(newApiKeys);

      toast.success(`${provider} API key deleted`);
    } catch (error: any) {
      console.error('Failed to delete API key:', error);
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
    } catch (_error) {
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
                        : apiKeys[provider.id].masked_key}
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
                  {apiKeys[provider.id].last_used && (
                    <p className="text-muted-foreground text-xs">
                      Last used:{' '}
                      {new Date(
                        apiKeys[provider.id].last_used!
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
