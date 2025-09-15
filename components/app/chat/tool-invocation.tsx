import React from 'react';
'use client';

import type { UIMessage as MessageAISDK } from '@ai-sdk/react';
import { useMemo } from 'react';
import {
  Tool as AITool,
  ToolContent as AIToolContent,
  ToolHeader as AIToolHeader,
  ToolInput as AIToolInput,
  ToolOutput as AIToolOutput,
} from '@/components/ai-elements/tool';

// Type for AI SDK tool parts
export type ToolUIPart = NonNullable<MessageAISDK['parts']>[number] & {
  type: `tool-${string}`;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolInvocationProps = {
  toolInvocations: ToolUIPart[];
  className?: string;
};

export function ToolInvocation({ toolInvocations }: ToolInvocationProps) {
  const groups = useMemo(() => {
    const buckets: Record<string, ToolUIPart[]> = {};
    for (const p of toolInvocations) {
      const id = p.toolCallId || 'unknown';
      if (!buckets[id]) buckets[id] = [];
      buckets[id].push(p);
    }
    return buckets;
  }, [toolInvocations]);

  const displayParts = useMemo(() => {
    const chosen: ToolUIPart[] = [];
    for (const id of Object.keys(groups)) {
      const group = groups[id];
      const pick =
        group.find((x) => x.state === 'output-available') ||
        group.find((x) => x.state === 'input-available') ||
        group.find((x) => x.state === 'input-streaming') ||
        group.find((x) => x.state === 'output-error') ||
        group[0];
      if (pick) chosen.push(pick as ToolUIPart);
    }
    return chosen;
  }, [groups]);

  if (displayParts.length === 0) return null;

  return (
    <div className="mb-6 w-full space-y-3">
      {displayParts.map((part) => (
        <AITool key={part.toolCallId}>
          <AIToolHeader
            state={
              part.state as
                | 'input-streaming'
                | 'input-available'
                | 'output-available'
                | 'output-error'
            }
            type={part.type}
          />
          <AIToolContent>
            {'input' in part && part.input ? (
              <AIToolInput input={JSON.stringify(part.input, null, 2)} />
            ) : null}
            {'output' in part && part.output ? (
              <AIToolOutput
                errorText={part.errorText}
                output={
                  typeof part.output === 'string' ||
                  (part.output && typeof part.output === 'object') ? (
                    <pre className="whitespace-pre-wrap text-xs">
                      {typeof part.output === 'string'
                        ? part.output
                        : JSON.stringify(part.output, null, 2)}
                    </pre>
                  ) : null
                }
              />
            ) : null}
          </AIToolContent>
        </AITool>
      ))}
    </div>
  );
}
