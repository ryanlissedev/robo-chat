'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Shield, Lock, Warning, CheckCircle, Key, Eye } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

interface SecurityConfig {
  // Content Filtering
  enableContentFiltering: boolean
  blockPromptInjection: boolean
  sanitizeOutputs: boolean
  
  // Rate Limiting
  enableRateLimiting: boolean
  maxRequestsPerMinute: number
  maxTokensPerDay: number
  
  // Data Protection
  encryptApiKeys: boolean
  logQueries: boolean
  retentionDays: number
  
  // Advanced Security
  enableJailbreakDetection: boolean
  requireApiKeyRotation: boolean
  rotationDays: number
  allowedDomains: string[]
}

interface SecuritySettingsProps {
  userId: string
}

export function SecuritySettings({ userId }: SecuritySettingsProps) {
  const [config, setConfig] = useState<SecurityConfig>({
    enableContentFiltering: true,
    blockPromptInjection: true,
    sanitizeOutputs: true,
    enableRateLimiting: true,
    maxRequestsPerMinute: 60,
    maxTokensPerDay: 100000,
    encryptApiKeys: true,
    logQueries: false,
    retentionDays: 30,
    enableJailbreakDetection: true,
    requireApiKeyRotation: false,
    rotationDays: 90,
    allowedDomains: [],
  })
  const [loading, setLoading] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_security_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        setConfig(data.config)
      }
    } catch (error) {
      console.error('Error loading security settings:', error)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_security_settings')
        .upsert({
          user_id: userId,
          config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      toast.success('Security settings saved')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = (key: keyof SecurityConfig, value: any) => {
    setConfig({ ...config, [key]: value })
  }

  const addDomain = () => {
    if (!newDomain) return
    
    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i
    if (!domainRegex.test(newDomain)) {
      toast.error('Invalid domain format')
      return
    }

    if (!config.allowedDomains.includes(newDomain)) {
      updateConfig('allowedDomains', [...config.allowedDomains, newDomain])
      setNewDomain('')
      toast.success('Domain added to allowlist')
    } else {
      toast.error('Domain already in allowlist')
    }
  }

  const removeDomain = (domain: string) => {
    updateConfig('allowedDomains', config.allowedDomains.filter(d => d !== domain))
  }

  const testSecuritySettings = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/test-security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('Security configuration is valid')
      } else {
        toast.error('Security test failed: ' + result.error)
      }
    } catch (error) {
      toast.error('Failed to test security settings')
    } finally {
      setLoading(false)
    }
  }

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
              <Label htmlFor="content-filtering">Content Filtering</Label>
              <p className="text-xs text-muted-foreground">
                Block harmful or inappropriate content
              </p>
            </div>
            <Switch
              id="content-filtering"
              checked={config.enableContentFiltering}
              onCheckedChange={(checked) => updateConfig('enableContentFiltering', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="prompt-injection">Block Prompt Injection</Label>
              <p className="text-xs text-muted-foreground">
                Detect and prevent prompt injection attacks
              </p>
            </div>
            <Switch
              id="prompt-injection"
              checked={config.blockPromptInjection}
              onCheckedChange={(checked) => updateConfig('blockPromptInjection', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sanitize-outputs">Sanitize Outputs</Label>
              <p className="text-xs text-muted-foreground">
                Remove potentially dangerous content from responses
              </p>
            </div>
            <Switch
              id="sanitize-outputs"
              checked={config.sanitizeOutputs}
              onCheckedChange={(checked) => updateConfig('sanitizeOutputs', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="jailbreak-detection">Jailbreak Detection</Label>
              <p className="text-xs text-muted-foreground">
                Identify attempts to bypass safety measures
              </p>
            </div>
            <Switch
              id="jailbreak-detection"
              checked={config.enableJailbreakDetection}
              onCheckedChange={(checked) => updateConfig('enableJailbreakDetection', checked)}
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
          <CardDescription>
            Control API usage and prevent abuse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="rate-limiting">Enable Rate Limiting</Label>
            <Switch
              id="rate-limiting"
              checked={config.enableRateLimiting}
              onCheckedChange={(checked) => updateConfig('enableRateLimiting', checked)}
            />
          </div>

          {config.enableRateLimiting && (
            <>
              <div className="space-y-2">
                <Label>Max Requests per Minute</Label>
                <Input
                  type="number"
                  value={config.maxRequestsPerMinute}
                  onChange={(e) => updateConfig('maxRequestsPerMinute', parseInt(e.target.value))}
                  min={1}
                  max={1000}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Tokens per Day</Label>
                <Input
                  type="number"
                  value={config.maxTokensPerDay}
                  onChange={(e) => updateConfig('maxTokensPerDay', parseInt(e.target.value))}
                  min={1000}
                  max={10000000}
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
              <Label htmlFor="encrypt-keys">Encrypt API Keys</Label>
              <p className="text-xs text-muted-foreground">
                Store API keys with encryption at rest
              </p>
            </div>
            <Switch
              id="encrypt-keys"
              checked={config.encryptApiKeys}
              onCheckedChange={(checked) => updateConfig('encryptApiKeys', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="key-rotation">Require Key Rotation</Label>
              <p className="text-xs text-muted-foreground">
                Enforce periodic API key rotation
              </p>
            </div>
            <Switch
              id="key-rotation"
              checked={config.requireApiKeyRotation}
              onCheckedChange={(checked) => updateConfig('requireApiKeyRotation', checked)}
            />
          </div>

          {config.requireApiKeyRotation && (
            <div className="space-y-2">
              <Label>Rotation Period (days)</Label>
              <Input
                type="number"
                value={config.rotationDays}
                onChange={(e) => updateConfig('rotationDays', parseInt(e.target.value))}
                min={7}
                max={365}
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
          <CardDescription>
            Control data logging and retention
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="log-queries">Log Queries</Label>
              <p className="text-xs text-muted-foreground">
                Store user queries for analysis (with consent)
              </p>
            </div>
            <Switch
              id="log-queries"
              checked={config.logQueries}
              onCheckedChange={(checked) => updateConfig('logQueries', checked)}
            />
          </div>

          {config.logQueries && (
            <div className="space-y-2">
              <Label>Data Retention (days)</Label>
              <Input
                type="number"
                value={config.retentionDays}
                onChange={(e) => updateConfig('retentionDays', parseInt(e.target.value))}
                min={1}
                max={365}
              />
              <p className="text-xs text-muted-foreground">
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
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addDomain()}
            />
            <Button onClick={addDomain}>Add Domain</Button>
          </div>

          <div className="space-y-2">
            {config.allowedDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No domain restrictions (all domains allowed)
              </p>
            ) : (
              config.allowedDomains.map(domain => (
                <div key={domain} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm font-mono">{domain}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDomain(domain)}
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
            <Warning className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            {config.enableContentFiltering ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Warning className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">Content filtering {config.enableContentFiltering ? 'enabled' : 'disabled'}</span>
          </div>
          <div className="flex items-center gap-2">
            {config.blockPromptInjection ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Warning className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">Prompt injection protection {config.blockPromptInjection ? 'enabled' : 'disabled'}</span>
          </div>
          <div className="flex items-center gap-2">
            {config.enableRateLimiting ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Warning className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm">Rate limiting {config.enableRateLimiting ? 'enabled' : 'disabled'}</span>
          </div>
          <div className="flex items-center gap-2">
            {config.encryptApiKeys ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Warning className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">API key encryption {config.encryptApiKeys ? 'enabled' : 'DISABLED'}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={testSecuritySettings} disabled={loading}>
          Test Configuration
        </Button>
        <Button onClick={saveSettings} disabled={loading}>
          Save Security Settings
        </Button>
      </div>
    </div>
  )
}