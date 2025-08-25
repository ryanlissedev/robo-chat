'use client';

import { Brain, Gauge, Lightning } from '@phosphor-icons/react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReasoningEffort } from '@/lib/openproviders/types';
import { cn } from '@/lib/utils';

export type { ReasoningEffort };

type ReasoningEffortSelectorProps = {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
  className?: string;
  disabled?: boolean;
};

const reasoningOptions = [
  {
    value: 'low' as ReasoningEffort,
    label: 'Low',
    description: 'Fast, basic reasoning',
    icon: Lightning,
    color: 'text-green-500',
  },
  {
    value: 'medium' as ReasoningEffort,
    label: 'Medium',
    description: 'Balanced analysis (default)',
    icon: Gauge,
    color: 'text-blue-500',
  },
  {
    value: 'high' as ReasoningEffort,
    label: 'High',
    description: 'Deep, thorough analysis',
    icon: Brain,
    color: 'text-purple-500',
  },
];

export function ReasoningEffortSelector({
  value,
  onChange,
  className,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = reasoningOptions.find((opt) => opt.value === value);

  return (
    <Select
      disabled={disabled}
      onOpenChange={setOpen}
      onValueChange={(val) => onChange(val as ReasoningEffort)}
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
          {selectedOption && (
            <div className="flex items-center gap-2">
              <selectedOption.icon
                className={cn('h-5 w-5', selectedOption.color)}
                weight="duotone"
              />
              <span className="font-medium text-sm">
                {selectedOption.label}
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[280px]">
        {reasoningOptions.map((option) => (
          <SelectItem
            className="cursor-pointer"
            key={option.value}
            value={option.value}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <option.icon
                  className={cn('h-5 w-5', option.color)}
                  weight="duotone"
                />
                <span className="font-medium text-base">{option.label}</span>
              </div>
              <span className="pl-7 text-muted-foreground text-sm">
                {option.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Compact version for mobile or limited space
export function ReasoningEffortCompact({
  value,
  onChange,
  className,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {reasoningOptions.map((option) => {
        const isSelected = option.value === value;
        const Icon = option.icon;

        return (
          <button
            aria-pressed={isSelected}
            className={cn(
              'rounded-md p-1.5 transition-all',
              'hover:bg-accent/50',
              isSelected && 'bg-accent',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            disabled={disabled}
            key={option.value}
            onClick={() => !disabled && onChange(option.value)}
            title={`${option.label}: ${option.description}`}
            type="button"
          >
            <Icon
              className={cn(
                'h-4 w-4',
                isSelected ? option.color : 'text-muted-foreground'
              )}
              weight={isSelected ? 'fill' : 'duotone'}
            />
          </button>
        );
      })}
    </div>
  );
}
