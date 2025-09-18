'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { BrainIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { createContext, memo, useContext, useEffect, useRef, useState } from 'react';
import { Response } from '@/components/ai-elements/response';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';

type EnhancedReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
  hasManualInteraction: boolean;
};

const EnhancedReasoningContext = createContext<EnhancedReasoningContextValue | null>(null);

const useEnhancedReasoning = () => {
  const context = useContext(EnhancedReasoningContext);
  if (!context) {
    throw new Error('Reasoning components must be used within EnhancedReasoning');
  }
  return context;
};

export type EnhancedReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

// Auto-close delay: 1 second after streaming ends
const AUTO_CLOSE_DELAY = 1000;

export const EnhancedReasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = false,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: EnhancedReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });

    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });

    const [hasManualInteraction, setHasManualInteraction] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        const calculatedDuration = Math.round((Date.now() - startTime) / 1000);
        setDuration(calculatedDuration);
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close after streaming ends
    useEffect(() => {
      // Clear any existing auto-close timer
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }

      if (isStreaming) {
        // Auto-open when streaming starts (only if no manual interaction)
        if (!hasManualInteraction && !isOpen) {
          setIsOpen(true);
        }
      } else if (!isStreaming && isOpen && !hasManualInteraction && !defaultOpen) {
        // Schedule auto-close when streaming ends (only if no manual interaction and currently open)
        autoCloseTimerRef.current = setTimeout(() => {
          setIsOpen(false);
          autoCloseTimerRef.current = null;
        }, AUTO_CLOSE_DELAY);
      }

      // Cleanup function
      return () => {
        if (autoCloseTimerRef.current) {
          clearTimeout(autoCloseTimerRef.current);
          autoCloseTimerRef.current = null;
        }
      };
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasManualInteraction]);

    const handleOpenChange = (newOpen: boolean) => {
      // Mark that user has manually interacted
      setHasManualInteraction(true);

      // Clear any pending auto-close timer
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }

      setIsOpen(newOpen);
    };

    // Reset manual interaction flag when streaming state changes
    useEffect(() => {
      if (isStreaming) {
        setHasManualInteraction(false);
      }
    }, [isStreaming]);

    return (
      <EnhancedReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration, hasManualInteraction }}
      >
        <Collapsible
          className={cn('not-prose mb-4', className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </EnhancedReasoningContext.Provider>
    );
  }
);

export type EnhancedReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  title?: string;
};

export const EnhancedReasoningTrigger = memo(
  ({ className, children, ...props }: EnhancedReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useEnhancedReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          'flex items-center gap-2 text-muted-foreground text-sm',
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon className="size-4" />
            {isStreaming ? (
              <TextShimmer>Thinking...</TextShimmer>
            ) : (
              <p>Thought for {duration} seconds</p>
            )}
            <ChevronDownIcon
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                isOpen ? 'rotate-180' : 'rotate-0'
              )}
              data-testid="chevron-icon"
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type EnhancedReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

export const EnhancedReasoningContent = memo(
  ({ className, children, ...props }: EnhancedReasoningContentProps) => {
    // Ensure we are within the Enhanced Reasoning provider
    useEnhancedReasoning();

    return (
      <CollapsibleContent
        className={cn(
          'mt-4 text-sm grid gap-2',
          'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
          className
        )}
        {...props}
      >
        <Response className="grid gap-2">{children}</Response>
      </CollapsibleContent>
    );
  }
);

EnhancedReasoning.displayName = 'EnhancedReasoning';
EnhancedReasoningTrigger.displayName = 'EnhancedReasoningTrigger';
EnhancedReasoningContent.displayName = 'EnhancedReasoningContent';