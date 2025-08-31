'use client';

import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { StorageScope } from '@/lib/services/types';

type StorageScopeSelectorProps = {
  storageScope: StorageScope;
  onStorageScopeChange: (scope: StorageScope) => void;
  isGuest: boolean;
};

export function StorageScopeSelector({
  storageScope,
  onStorageScopeChange,
  isGuest,
}: StorageScopeSelectorProps) {
  if (!isGuest) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="storage-scope">Storage Location</Label>
      <Select
        value={storageScope}
        onValueChange={(value) => onStorageScopeChange(value as StorageScope)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select storage location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="session">Session Only</SelectItem>
          <SelectItem value="browser">Browser Storage</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Guest Mode Storage:</p>
          <ul className="text-xs space-y-1">
            <li>
              <strong>Session Only:</strong> Keys cleared when tab closes
            </li>
            <li>
              <strong>Browser Storage:</strong> Keys persist between sessions
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
