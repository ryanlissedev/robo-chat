'use client';

import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Key,
  Lock,
  Shield,
} from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
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
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import { clientLogger } from '@/lib/utils/client-logger';

type SecurityConfig = {
  // Content Filtering
  enableContentFiltering: boolean;
  blockPromptInjection: boolean;
  sanitizeOutputs: boolean;

  // Rate Limiting
  enableRateLimiting: boolean;
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;

  // Data Protection
  encryptApiKeys: boolean;
  logQueries: boolean;
  retentionDays: number;

  // Advanced Security
  enableJailbreakDetection: boolean;
  requireApiKeyRotation: boolean;
  rotationDays: number;
  allowedDomains: string[];
};

type SecuritySettingsProps = {
  userId: string;
};

export function SecuritySettings({ userId }: SecuritySettingsProps) {
  const [config, setConfig] = useState<SecurityConfig>({
    enableContentFiltering: true,
    blockPromptInjection: true,
    sanitizeOutputs: true,
    enableRateLimiting: true,
    maxRequestsPerMinute: 60,
    maxTokensPerDay: 100_000,
    encryptApiKeys: true,
    logQueries: false,
    retentionDays: 30,
    enableJailbreakDetection: true,
    requireApiKeyRotation: false,
    rotationDays: 90,
    allowedDomains: [],
  });
  const [loading, setLoading] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const supabase = createClient();

  // Generate unique IDs for form elements
  const contentFilteringId = useId();
  const promptInjectionId = useId();
  const sanitizeOutputsId = useId();
  const jailbreakDetectionId = useId();
  const rateLimitingId = useId();
  const encryptApiKeysId = useId();
  const apiKeyRotationId = useId();
  const logQueriesId = useId();

  const loadSettings = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Handle case where table doesn't exist yet or no data found
        if (
          error.code === '42P01' ||
          error.message.includes('does not exist')
        ) {
          clientLogger.warn('user_security_settings table does not exist yet');
          return;
        }
        if (error.code === 'PGRST116') {
          // No rows found - this is expected for first time users
          return;
        }
        clientLogger.error('Error loading security settings', error);
        return;
      }

      if ((data as unknown as { config?: SecurityConfig })?.config) {
        setConfig(
          (data as unknown as { config?: SecurityConfig })
            .config as SecurityConfig
        );
      }
    } catch (error: unknown) {
      clientLogger.error('Failed to load security settings', error);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = async () => {
    if (!supabase) {
      toast.error('Database not available');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('user_security_settings').upsert(
        {
          user_id: userId,
          config,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) {
        // Handle case where table doesn't exist yet
        if (
          error.code === '42P01' ||
          error.message.includes('does not exist')
        ) {
          toast.error(
            'Security settings storage not yet configured. Please contact support.'
          );
          return;
        }
        throw error;
      }

      toast.success('Security settings saved');
    } catch (error: unknown) {
      clientLogger.error('Failed to save security settings', error);
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = <K extends keyof SecurityConfig>(
    key: K,
    value: SecurityConfig[K]
  ) => {
    setConfig({ ...config, [key]: value });
  };

  const addDomain = () => {
    if (!newDomain) {
      return;
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(newDomain)) {
      toast.error('Invalid domain format');
      return;
    }

    if (config.allowedDomains.includes(newDomain)) {
      toast.error('Domain already in allowlist');
    } else {
      updateConfig('allowedDomains', [...config.allowedDomains, newDomain]);
      setNewDomain('');
      toast.success('Domain added to allowlist');
    }
  };

  const removeDomain = (domain: string) => {
    updateConfig(
      'allowedDomains',
      config.allowedDomains.filter((d) => d !== domain)
    );
  };

  const testSecuritySettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/test-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Security configuration is valid');
      } else {
        toast.error(`Security test failed: ${result.error}`);
      }
    } catch {
      toast.error('Failed to test security settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Content Security
          </CardTitle>
          <CardDescription>
            Protect against malicious inputs and outputs
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={contentFilteringId}>Content Filtering</Label>
              <p className="text-muted-foreground text-xs">
                Block harmful or inappropriate content
              </p>
            </div>
            <Switch
              checked={config.enableContentFiltering}
              id={contentFilteringId}
              onCheckedChange={(checked) =>
                updateConfig('enableContentFiltering', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={promptInjectionId}>Block Prompt Injection</Label>
              <p className="text-muted-foreground text-xs">
                Detect and prevent prompt injection attacks
              </p>
            </div>
            <Switch
              checked={config.blockPromptInjection}
              id={promptInjectionId}
              onCheckedChange={(checked) =>
                updateConfig('blockPromptInjection', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={sanitizeOutputsId}>Sanitize Outputs</Label>
              <p className="text-muted-foreground text-xs">
                Remove potentially dangerous content from responses
              </p>
            </div>
            <Switch
              checked={config.sanitizeOutputs}
              id={sanitizeOutputsId}
              onCheckedChange={(checked) =>
                updateConfig('sanitizeOutputs', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={jailbreakDetectionId}>Jailbreak Detection</Label>
              <p className="text-muted-foreground text-xs">
                Identify attempts to bypass safety measures
              </p>
            </div>
            <Switch
              checked={config.enableJailbreakDetection}
              id={jailbreakDetectionId}
              onCheckedChange={(checked) =>
                updateConfig('enableJailbreakDetection', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Rate Limiting
          </CardTitle>
          <CardDescription>Control API usage and prevent abuse</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={rateLimitingId}>Enable Rate Limiting</Label>
            <Switch
              checked={config.enableRateLimiting}
              id={rateLimitingId}
              onCheckedChange={(checked) =>
                updateConfig('enableRateLimiting', checked)
              }
            />
          </div>

          {config.enableRateLimiting && (
            <>
              <div className="space-y-2">
                <Label>Max Requests per Minute</Label>
                <Input
                  max={1000}
                  min={1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateConfig(
                      'maxRequestsPerMinute',
                      Number.parseInt(e.target.value, 10)
                    )
                  }
                  type="number"
                  value={config.maxRequestsPerMinute}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Tokens per Day</Label>
                <Input
                  max={10_000_000}
                  min={1000}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateConfig(
                      'maxTokensPerDay',
                      Number.parseInt(e.target.value, 10)
                    )
                  }
                  type="number"
                  value={config.maxTokensPerDay}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Key Security
          </CardTitle>
          <CardDescription>
            Manage API key encryption and rotation policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={encryptApiKeysId}>Encrypt API Keys</Label>
              <p className="text-muted-foreground text-xs">
                Store API keys with encryption at rest
              </p>
            </div>
            <Switch
              checked={config.encryptApiKeys}
              id={encryptApiKeysId}
              onCheckedChange={(checked) =>
                updateConfig('encryptApiKeys', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={apiKeyRotationId}>Require Key Rotation</Label>
              <p className="text-muted-foreground text-xs">
                Enforce periodic API key rotation
              </p>
            </div>
            <Switch
              checked={config.requireApiKeyRotation}
              id={apiKeyRotationId}
              onCheckedChange={(checked) =>
                updateConfig('requireApiKeyRotation', checked)
              }
            />
          </div>

          {config.requireApiKeyRotation && (
            <div className="space-y-2">
              <Label>Rotation Period (days)</Label>
              <Input
                max={365}
                min={7}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateConfig(
                    'rotationDays',
                    Number.parseInt(e.target.value, 10)
                  )
                }
                type="number"
                value={config.rotationDays}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Data & Privacy
          </CardTitle>
          <CardDescription>Control data logging and retention</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={logQueriesId}>Log Queries</Label>
              <p className="text-muted-foreground text-xs">
                Store user queries for analysis (with consent)
              </p>
            </div>
            <Switch
              checked={config.logQueries}
              id={logQueriesId}
              onCheckedChange={(checked) => updateConfig('logQueries', checked)}
            />
          </div>

          {config.logQueries && (
            <div className="space-y-2">
              <Label>Data Retention (days)</Label>
              <Input
                max={365}
                min={1}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateConfig(
                    'retentionDays',
                    Number.parseInt(e.target.value, 10)
                  )
                }
                type="number"
                value={config.retentionDays}
              />
              <p className="text-muted-foreground text-xs">
                Queries will be automatically deleted after this period
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Domain Allowlist</CardTitle>
          <CardDescription>
            Restrict file uploads and external access to specific domains
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDomain(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addDomain()}
              placeholder="example.com"
              value={newDomain}
            />
            <Button onClick={addDomain}>Add Domain</Button>
          </div>

          <div className="space-y-2">
            {config.allowedDomains.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No domain restrictions (all domains allowed)
              </p>
            ) : (
              config.allowedDomains.map((domain) => (
                <div
                  className="flex items-center justify-between rounded bg-muted p-2"
                  key={domain}
                >
                  <span className="font-mono text-sm">{domain}</span>
                  <Button
                    onClick={() => removeDomain(domain)}
                    size="sm"
                    variant="ghost"
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            {config.enableContentFiltering ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">
              Content filtering{' '}
              {config.enableContentFiltering ? 'enabled' : 'disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {config.blockPromptInjection ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">
              Prompt injection protection{' '}
              {config.blockPromptInjection ? 'enabled' : 'disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {config.enableRateLimiting ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">
              Rate limiting {config.enableRateLimiting ? 'enabled' : 'disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {config.encryptApiKeys ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">
              API key encryption{' '}
              {config.encryptApiKeys ? 'enabled' : 'DISABLED'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          disabled={loading}
          onClick={testSecuritySettings}
          variant="outline"
        >
          Test Configuration
        </Button>
        <Button disabled={loading} onClick={saveSettings}>
          Save Security Settings
        </Button>
      </div>
    </div>
  );
}
