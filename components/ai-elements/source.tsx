'use client';

import { BookIcon, ChevronDownIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export type SourcesProps = ComponentProps<'div'>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn('not-prose mb-4 text-primary text-xs', className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger className="flex items-center gap-2" {...props}>
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      'mt-3 flex w-fit flex-col gap-2',
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<'a'> & {
  description?: string;
  chunk?: string;
  index?: number;
};

export const Source = ({
  href,
  title,
  description,
  chunk,
  index,
  children,
  ...props
}: SourceProps) => (
  <a
    className="flex flex-col gap-2 p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors"
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <div className="flex items-center gap-2">
          <BookIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm truncate flex-1">{title}</span>
          {index !== undefined && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {index + 1}
            </span>
          )}
        </div>
        {href && (
          <div className="text-xs text-muted-foreground truncate">
            {new URL(href).hostname}
          </div>
        )}
        {description && (
          <div className="text-xs text-muted-foreground line-clamp-2">
            {description}
          </div>
        )}
        {chunk && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border-l-2 border-primary/20 line-clamp-3">
            "{chunk}"
          </div>
        )}
      </>
    )}
  </a>
);
