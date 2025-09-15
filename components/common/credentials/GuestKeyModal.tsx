'use client';

import { useEffect, useMemo, useState } from 'react';
// Minimal UI primitives already used elsewhere
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PROVIDERS } from '@/lib/providers';
import {
  maskKey,
  setMemoryCredential,
  setPersistentCredential,
  setSessionCredential,
} from '@/lib/security/web-crypto';

export type StorageScope = 'request' | 'tab' | 'session' | 'persistent';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProviderId?: string;
  onSaved: (args: {
    provider: string;
    masked: string;
    scope: StorageScope;
  }) => void;
};

export function GuestKeyModal({
  open,
  onOpenChange,
  defaultProviderId,
  onSaved,
}: Props) {
  const [provider, setProvider] = useState(defaultProviderId || 'openai');
  const [apiKey, setApiKey] = useState('');
  const [masked, setMasked] = useState('');
  const [scope, setScope] = useState<StorageScope>('session');
  const [passphrase, setPassphrase] = useState('');
  const [validateFormat, setValidateFormat] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setApiKey('');
      setMasked('');
      setPassphrase('');
      setError(null);
      setScope('session');
      if (defaultProviderId) setProvider(defaultProviderId);
    }
  }, [open, defaultProviderId]);

  const providerOptions = useMemo(
    () =>
      PROVIDERS.filter((p) =>
        [
          'openai',
          'anthropic',
          'google',
          'mistral',
          'perplexity',
          'xai',
          'openrouter',
        ].includes(p.id)
      ),
    []
  );

  function onBlurMask() {
    setMasked(maskKey(apiKey));
  }

  async function handleSave() {
    setError(null);
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    try {
      if (scope === 'request') {
        // Do not store; just notify caller to use request-only mode.
        onSaved({ provider, masked: maskKey(apiKey), scope });
        onOpenChange(false);
        return;
      }

      if (scope === 'tab') {
        // In-memory encryption (ephemeral) for tab scope
        const res = await setMemoryCredential(provider, apiKey);
        onSaved({ provider, masked: res.masked, scope });
        onOpenChange(false);
        return;
      }

      if (scope === 'session') {
        const res = await setSessionCredential(provider, apiKey);
        onSaved({ provider, masked: res.masked, scope });
        onOpenChange(false);
        return;
      }

      if (scope === 'persistent') {
        if (!passphrase) {
          setError('Passphrase is required for persistent storage');
          return;
        }
        const res = await setPersistentCredential(provider, apiKey, passphrase);
        onSaved({ provider, masked: res.masked, scope });
        onOpenChange(false);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save credential');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provide Provider API Key</DialogTitle>
          <DialogDescription>
            Keys are handled entirely on your device. Guest keys are never
            stored on our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={onBlurMask}
              placeholder="Enter your provider API key"
            />
            {masked && (
              <div className="text-xs text-muted-foreground">
                Masked: {masked}
              </div>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label>Storage Scope</Label>
            <RadioGroup
              value={scope}
              onValueChange={(v) => setScope(v as StorageScope)}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="request" id="scope-request" />
                <Label htmlFor="scope-request">Request-only</Label>
                <span className="text-xs text-muted-foreground">
                  Do not store; send once
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tab" id="scope-tab" />
                <Label htmlFor="scope-tab">Tab (memory)</Label>
                <span className="text-xs text-muted-foreground">
                  Ephemeral; cleared on reload
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="session" id="scope-session" />
                <Label htmlFor="scope-session">Session (encrypted)</Label>
                <span className="text-xs text-muted-foreground">
                  Encrypted and auto-attached
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="persistent" id="scope-persistent" />
                <Label htmlFor="scope-persistent">
                  Persistent (encrypted with passphrase)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {scope === 'persistent' && (
            <div className="grid gap-1.5">
              <Label>Passphrase</Label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Required for persistent"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={validateFormat}
                onCheckedChange={setValidateFormat}
                id="validate-format"
              />
              <Label htmlFor="validate-format">Validate key format</Label>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground underline cursor-help">
                  Security
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Keys never leave your device except per-request transmission; we
                never store guest keys server-side.
              </TooltipContent>
            </Tooltip>
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
