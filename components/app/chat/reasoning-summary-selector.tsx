'use client';

import { FileText, ListTree } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ReasoningSummary = 'auto' | 'detailed';

type ReasoningSummarySelectorProps = {
  value: ReasoningSummary;
  onChange: (value: ReasoningSummary) => void;
  className?: string;
  disabled?: boolean;
};

const options: Array<{
  value: ReasoningSummary;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'auto', label: 'Auto summary', description: 'Provider chooses concise summaries', Icon: ListTree },
  { value: 'detailed', label: 'Detailed summary', description: 'Include longer reasoning summaries when available', Icon: FileText },
];

export function ReasoningSummarySelector({ value, onChange, className, disabled }: ReasoningSummarySelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];
  return (
    <Select disabled={disabled} onOpenChange={setOpen} onValueChange={(v) => onChange(v as ReasoningSummary)} open={open} value={value}>
      <SelectTrigger className={cn('flex h-10 w-auto items-center gap-2 border-border bg-background px-3', className)}>
        <SelectValue>
          <div className="flex items-center gap-2">
            <selected.Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-sm">{selected.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[300px]">
        {options.map((opt) => (
          <SelectItem className="cursor-pointer" key={opt.value} value={opt.value}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <opt.Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-base">{opt.label}</span>
              </div>
              <span className="pl-7 text-muted-foreground text-sm">{opt.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

