'use client';

import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ToolUIPart } from 'ai';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { isValidElement, useMemo } from 'react';
import { CodeBlock } from './code-block';

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn('not-prose mb-4 w-full rounded-md border', className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  type: string;
  state: string;
  className?: string;
  onClick?: () => void;
};

const STATUS_META: Record<
  string,
  { icon: ReactNode; label: string }
> = {
  'input-streaming': {
    icon: <CircleIcon className="size-4" />,
    label: 'Pending',
  },
  'input-available': {
    icon: <ClockIcon className="size-4 animate-pulse" />,
    label: 'Running',
  },
  'output-available': {
    icon: <CheckCircleIcon className="size-4 text-green-600" />,
    label: 'Completed',
  },
  'output-error': {
    icon: <XCircleIcon className="size-4 text-red-600" />,
    label: 'Error',
  },
};

export const ToolHeader = ({ className, type, state, onClick }: ToolHeaderProps) => {
  return (
    <CollapsibleTrigger
      className={cn(
        'flex w-full items-center justify-between gap-4 p-3 text-left transition-colors hover:bg-muted/50',
        className
      )}
      onClick={onClick}
    >
    <div className="flex items-center gap-2">
      <WrenchIcon className="size-4 text-muted-foreground" />
      <span className="font-medium text-sm">{type}</span>
      <Badge className="gap-1.5 rounded-full text-xs" variant="secondary">
        {STATUS_META[state].icon}
        {STATUS_META[state].label}
      </Badge>
    </div>
    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      'data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
      className
    )}
    {...props}
  />
);

const stringify = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[unserializable]';
  }
};

const renderStructuredValue = (value: unknown): ReactNode => {
  if (value === undefined || value === null) {
    return null;
  }
  if (isValidElement(value)) {
    return value;
  }

  const code = stringify(value);
  if (code === null) {
    return null;
  }

  return <CodeBlock code={code} language="json" />;
};

export type ToolInputProps = ComponentProps<'div'> & {
  input?: ToolUIPart['input'];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => {
  const rendered = useMemo(() => renderStructuredValue(input), [input]);

  if (!rendered) {
    return null;
  }

  return (
    <div className={cn('space-y-2 overflow-hidden p-4', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parameters
      </h4>
      <div className="rounded-md bg-muted/50">{rendered}</div>
    </div>
  );
};

export type ToolOutputProps = ComponentProps<'div'> & {
  output?: unknown;
  errorText?: ToolUIPart['errorText'];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  const hasContent = errorText || (output !== undefined && output !== null);
  const renderedOutput = useMemo(() => renderStructuredValue(output), [output]);

  if (!hasContent) {
    return null;
  }

  return (
    <div className={cn('space-y-2 p-4', className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? 'Error' : 'Result'}
      </h4>
      <div
        className={cn(
          'overflow-x-auto rounded-md text-xs [&_table]:w-full',
          errorText
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted/50 text-foreground'
        )}
      >
        {errorText && <div>{errorText}</div>}
        {renderedOutput && <div>{renderedOutput}</div>}
      </div>
    </div>
  );
};

Tool.displayName = 'Tool';
ToolHeader.displayName = 'ToolHeader';
ToolContent.displayName = 'ToolContent';
ToolInput.displayName = 'ToolInput';
ToolOutput.displayName = 'ToolOutput';
