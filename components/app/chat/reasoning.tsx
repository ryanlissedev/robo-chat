import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Markdown } from '@/components/prompt-kit/markdown';
import { cn } from '@/lib/utils';

type ReasoningProps = {
  reasoningText: string;
  isStreaming?: boolean;
};

const TRANSITION = {
  type: 'spring' as const,
  duration: 0.2,
  bounce: 0,
};

export function Reasoning({ reasoningText, isStreaming }: ReasoningProps) {
  const [wasStreaming, setWasStreaming] = useState(isStreaming ?? false);
  const [isExpanded, setIsExpanded] = useState(() => isStreaming ?? true);

  if (wasStreaming && isStreaming === false) {
    setWasStreaming(false);
    setIsExpanded(false);
  }

  return (
    <div>
      <button
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span>Reasoning</span>
        <ChevronDown
          className={cn(
            'size-3 transition-transform',
            isExpanded ? 'rotate-180' : ''
          )}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={TRANSITION}
          >
            <div className="flex flex-col border-muted-foreground/20 border-l pl-4 text-muted-foreground text-sm">
              <Markdown>{reasoningText}</Markdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
