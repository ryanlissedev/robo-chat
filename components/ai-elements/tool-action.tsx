'use client';

import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Favicon } from '@/components/ui/favicon';

export interface ToolActionContainerProps extends React.ComponentPropsWithoutRef<'div'> {
  isLoading?: boolean;
  children: React.ReactNode;
}

/**
 * ToolActionContainer - Animated wrapper component for tool actions
 * Provides consistent motion behavior and styling for all tool action types
 */
export const ToolActionContainer = React.forwardRef<HTMLDivElement, ToolActionContainerProps>(
  ({ isLoading = false, className, children, ...props }, ref) => {
    const loadingAnimation = {
      opacity: [1, 0.7, 1],
    };

    const loadingTransition = {
      duration: 1.5,
      repeat: Number.POSITIVE_INFINITY,
      ease: 'easeInOut' as const,
    };

    const staticAnimation = {
      opacity: 1,
    };

    const staticTransition = {
      duration: 0.3,
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50',
          className
        )}
        animate={isLoading ? loadingAnimation : staticAnimation}
        transition={isLoading ? loadingTransition : staticTransition}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        {...(props as any)}
      >
        {children}
      </motion.div>
    );
  }
);

ToolActionContainer.displayName = 'ToolActionContainer';

export interface ToolActionKindProps {
  icon: LucideIcon;
  name: string;
  className?: string;
}

/**
 * ToolActionKind - Displays the tool type with icon and name
 * Used to identify what kind of tool action is being performed
 */
export const ToolActionKind = React.forwardRef<HTMLDivElement, ToolActionKindProps>(
  ({ icon: Icon, name, className }, ref) => {
    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)}>
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
    );
  }
);

ToolActionKind.displayName = 'ToolActionKind';

export interface ToolActionContentProps {
  title: string;
  url?: string;
  domain?: string;
  className?: string;
}

/**
 * ToolActionContent - Displays the main content with title and optional favicon
 * Shows the result or target of the tool action with visual context
 */
export const ToolActionContent = React.forwardRef<HTMLDivElement, ToolActionContentProps>(
  ({ title, url, domain, className }, ref) => {
    const [faviconLoaded, setFaviconLoaded] = React.useState(false);
    const [faviconError, setFaviconError] = React.useState(false);

    const handleFaviconLoad = React.useCallback(() => {
      setFaviconLoaded(true);
      setFaviconError(false);
    }, []);

    const handleFaviconError = React.useCallback(() => {
      setFaviconLoaded(false);
      setFaviconError(true);
    }, []);

    return (
      <div ref={ref} className={cn('flex items-center gap-2 mt-2', className)}>
        {domain && (
          <div className="flex-shrink-0">
            <Favicon
              domain={domain}
              onLoad={handleFaviconLoad}
              onError={handleFaviconError}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground truncate">{title}</span>
            {url && <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
          </div>
        </div>
      </div>
    );
  }
);

ToolActionContent.displayName = 'ToolActionContent';