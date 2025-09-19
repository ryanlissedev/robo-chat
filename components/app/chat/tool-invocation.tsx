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
      {displayParts.map((part) => {
        const typedPart = part as ToolUIPart & {
          result?: unknown;
          text?: unknown;
        };
        const outputValue =
          typedPart.output ??
          typedPart.result ??
          typedPart.text ??
          undefined;

        return (
          <AITool key={part.toolCallId}>
            <AIToolHeader
              state={part.state}
              type={part.type}
            />
            <AIToolContent>
              {part.input ? <AIToolInput input={part.input} /> : null}
              {outputValue !== undefined || part.errorText ? (
                <AIToolOutput
                  errorText={part.errorText}
                  output={outputValue}
                />
              ) : null}
            </AIToolContent>
          </AITool>
        );
      })}
    </div>
  );
}
