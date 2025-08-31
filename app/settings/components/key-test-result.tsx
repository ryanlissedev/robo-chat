'use client';

import { Check, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ApiKeyTestResult } from '@/lib/services/types';

type KeyTestResultProps = {
  testResult?: ApiKeyTestResult;
  isLoading?: boolean;
};

export function KeyTestResult({
  testResult,
  isLoading = false,
}: KeyTestResultProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Testing API key...</span>
      </div>
    );
  }

  if (!testResult) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {testResult.success ? (
        <>
          <Check className="h-4 w-4 text-green-500" />
          <Badge
            variant="outline"
            className="text-green-700 border-green-200 bg-green-50"
          >
            Valid
          </Badge>
          <span className="text-sm text-muted-foreground">
            API key is working correctly
          </span>
        </>
      ) : (
        <>
          <X className="h-4 w-4 text-red-500" />
          <Badge
            variant="outline"
            className="text-red-700 border-red-200 bg-red-50"
          >
            Invalid
          </Badge>
          <span className="text-sm text-red-600">
            {testResult.error || 'API key test failed'}
          </span>
        </>
      )}
    </div>
  );
}
