'use client';

import { Gauge, ListFilter, Volume2 } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Verbosity = 'low' | 'medium' | 'high';

type VerbositySelectorProps = {
  value: Verbosity;
  onChange: (value: Verbosity) => void;
  className?: string;
  disabled?: boolean;
};

const options: Array<{
  value: Verbosity;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'low',
    label: 'Concise',
    description: 'Short, to the point',
    Icon: ListFilter,
  },
  {
    value: 'medium',
    label: 'Balanced',
    description: 'Default detail level',
    Icon: Gauge,
  },
  {
    value: 'high',
    label: 'Detailed',
    description: 'More elaborate answers',
    Icon: Volume2,
  },
];

export function VerbositySelector({
  value,
  onChange,
  className,
  disabled,
}: VerbositySelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[1];
  return (
    <Select
      disabled={disabled}
      onOpenChange={setOpen}
      onValueChange={(v) => onChange(v as Verbosity)}
      open={open}
      value={value}
    >
      <SelectTrigger
        className={cn(
          'flex h-10 w-auto items-center gap-2 border-border bg-background px-3',
          className
        )}
      >
        <SelectValue>
          <div className="flex items-center gap-2">
            <selected.Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-sm">{selected.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[260px]">
        {options.map((opt) => (
          <SelectItem
            className="cursor-pointer"
            key={opt.value}
            value={opt.value}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <opt.Icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-base">{opt.label}</span>
              </div>
              <span className="pl-7 text-muted-foreground text-sm">
                {opt.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
