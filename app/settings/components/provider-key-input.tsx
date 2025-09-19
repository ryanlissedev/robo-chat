'use client';

import { Eye, EyeOff, Key } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskKey } from '@/lib/security/web-crypto';
import type { ApiKey, ValidationResult } from '@/lib/services/types';

type ProviderKeyInputProps = {
  provider: {
    id: string;
    name: string;
    required: boolean;
    description: string;
    badge: string;
  };
  existingKey?: ApiKey | { encryptedKey?: string };
  newKey: string;
  onKeyChange: (key: string) => void;
  onSave: () => void;
  onDelete: () => void;
  validation?: ValidationResult;
  showKey: boolean;
  onToggleShowKey: () => void;
  isLoading?: boolean;
};

export function ProviderKeyInput({
  provider,
  existingKey,
  newKey,
  onKeyChange,
  onSave,
  onDelete,
  validation,
  showKey,
  onToggleShowKey,
  isLoading = false,
}: ProviderKeyInputProps) {
  const hasKey = !!existingKey;
  const hasNewKey = newKey.length > 0;
  const isValid = !validation || validation.isValid;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{provider.badge}</span>
          <Label
            htmlFor={`${provider.id}-key`}
            className="flex items-center gap-2"
          >
            <Key className="h-4 w-4" />
            {provider.name}
            {provider.required && (
              <Badge variant="secondary" className="text-xs">
                Required
              </Badge>
            )}
          </Label>
        </div>
        {hasKey && !hasNewKey && (
          <Badge variant="outline" className="text-xs">
            Configured
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{provider.description}</p>

      <div className="space-y-2">
        {hasKey && !hasNewKey ? (
          <div className="flex items-center gap-2">
            <Input
              value={
                showKey
                  ? (((existingKey as ApiKey)?.encrypted_key ||
                      (existingKey as { encryptedKey?: string })
                        ?.encryptedKey) ??
                    '')
                  : maskKey(
                      ((existingKey as ApiKey)?.encrypted_key ||
                        (existingKey as { encryptedKey?: string })
                          ?.encryptedKey) ??
                        ''
                    )
              }
              readOnly
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onToggleShowKey}
              className="shrink-0"
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isLoading}
              className="shrink-0"
            >
              Delete
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                id={`${provider.id}-key`}
                type={showKey ? 'text' : 'password'}
                placeholder={`Enter your ${provider.name} API key`}
                value={newKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onKeyChange(e.target.value)
                }
                className={`font-mono text-sm ${
                  validation && !validation.isValid ? 'border-destructive' : ''
                }`}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onToggleShowKey}
                className="shrink-0"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>

            {validation && !validation.isValid && (
              <p className="text-sm text-destructive">{validation.message}</p>
            )}

            {hasNewKey && isValid && (
              <Button
                type="button"
                onClick={onSave}
                disabled={isLoading}
                className="w-full"
              >
                {hasKey ? 'Update Key' : 'Save Key'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
