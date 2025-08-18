'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Brain, Lightning, Gauge } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { ReasoningEffort } from '@/lib/openproviders/types'

export type { ReasoningEffort }

interface ReasoningEffortSelectorProps {
  value: ReasoningEffort
  onChange: (value: ReasoningEffort) => void
  className?: string
  disabled?: boolean
}

const reasoningOptions = [
  {
    value: 'low' as ReasoningEffort,
    label: 'Low',
    description: 'Quick responses with basic reasoning',
    tooltip: 'Faster responses with minimal thinking time. Best for simple questions or when speed is prioritized over depth.',
    icon: Lightning,
    color: 'text-green-500',
  },
  {
    value: 'medium' as ReasoningEffort,
    label: 'Medium',
    description: 'Balanced reasoning and response time',
    tooltip: 'Balanced approach with moderate thinking time. Good for most tasks requiring some analysis (default).',
    icon: Gauge,
    color: 'text-blue-500',
  },
  {
    value: 'high' as ReasoningEffort,
    label: 'High',
    description: 'Thorough analysis with detailed reasoning',
    tooltip: 'Maximum thinking time for complex problems. Best for challenging tasks requiring deep analysis and careful consideration.',
    icon: Brain,
    color: 'text-purple-500',
  },
]

export function ReasoningEffortSelector({
  value,
  onChange,
  className,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedOption = reasoningOptions.find((opt) => opt.value === value)

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as ReasoningEffort)}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'w-[180px] h-9 bg-background border-border',
          className
        )}
      >
        <SelectValue>
          {selectedOption && (
            <div className="flex items-center gap-2">
              <selectedOption.icon
                className={cn('h-4 w-4', selectedOption.color)}
                weight="duotone"
              />
              <span className="text-sm font-medium">
                {selectedOption.label} Reasoning
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[280px]">
        {reasoningOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <option.icon
                  className={cn('h-4 w-4', option.color)}
                  weight="duotone"
                />
                <span className="font-medium">{option.label}</span>
              </div>
              <span className="text-xs text-muted-foreground pl-6">
                {option.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Compact version for mobile or limited space
export function ReasoningEffortCompact({
  value,
  onChange,
  className,
  disabled = false,
}: ReasoningEffortSelectorProps) {
  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        {reasoningOptions.map((option) => {
          const isSelected = option.value === value
          const Icon = option.icon

          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => !disabled && onChange(option.value)}
                  disabled={disabled}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${option.label} reasoning effort`}
                  className={cn(
                    'p-1.5 rounded-md transition-all',
                    'hover:bg-accent/50',
                    isSelected && 'bg-accent',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      isSelected ? option.color : 'text-muted-foreground'
                    )}
                    weight={isSelected ? 'fill' : 'duotone'}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-center">
                  <div className="font-medium">{option.label} Reasoning</div>
                  <div className="text-xs opacity-90 mt-1">{option.tooltip}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}