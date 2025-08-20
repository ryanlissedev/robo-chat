'use client';

import {
  CaretDown,
  CheckCircle,
  Code,
  Link,
  Nut,
  Spinner,
  Wrench,
} from '@phosphor-icons/react';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// Define tool invocation type based on v5 structure
type ToolInvocationPart = {
  type: 'dynamic-tool';
  toolName: string;
  toolCallId: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'done'
    | 'streaming';
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolInvocationProps = {
  toolInvocations: ToolInvocationPart[];
  className?: string;
  defaultOpen?: boolean;
};

const TRANSITION = {
  type: 'spring' as const,
  duration: 0.2,
  bounce: 0,
};

export function ToolInvocation({
  toolInvocations,
  defaultOpen = false,
}: ToolInvocationProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);

  const toolInvocationsData = Array.isArray(toolInvocations)
    ? toolInvocations
    : [toolInvocations];

  // Group tool invocations by toolCallId
  const groupedTools = toolInvocationsData.reduce(
    (acc, item) => {
      const { toolCallId } = item;
      if (!acc[toolCallId]) {
        acc[toolCallId] = [];
      }
      acc[toolCallId].push(item);
      return acc;
    },
    {} as Record<string, ToolInvocationPart[]>
  );

  const uniqueToolIds = Object.keys(groupedTools);
  const isSingleTool = uniqueToolIds.length === 1;

  if (isSingleTool) {
    return (
      <SingleToolView
        className="mb-10"
        defaultOpen={defaultOpen}
        toolInvocations={toolInvocationsData}
      />
    );
  }

  return (
    <div className="mb-10">
      <div className="flex flex-col gap-0 overflow-hidden rounded-md border border-border">
        <button
          className="flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors hover:bg-accent"
          onClick={(e) => {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }}
          type="button"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
            <Nut className="size-4 text-muted-foreground" />
            <span className="text-sm">Tools executed</span>
            <div className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-secondary-foreground text-xs">
              {uniqueToolIds.length}
            </div>
          </div>
          <CaretDown
            className={cn(
              'h-4 w-4 transition-transform',
              isExpanded ? 'rotate-180 transform' : ''
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
            >
              <div className="px-3 pt-3 pb-3">
                <div className="space-y-2">
                  {uniqueToolIds.map((toolId) => {
                    const toolInvocationsForId = groupedTools[toolId];

                    if (!toolInvocationsForId?.length) {
                      return null;
                    }

                    return (
                      <div
                        className="pb-2 last:border-0 last:pb-0"
                        key={toolId}
                      >
                        <SingleToolView
                          toolInvocations={toolInvocationsForId}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type SingleToolViewProps = {
  toolInvocations: ToolInvocationPart[];
  defaultOpen?: boolean;
  className?: string;
};

function SingleToolView({
  toolInvocations,
  defaultOpen = false,
  className,
}: SingleToolViewProps) {
  // Group by toolCallId and pick the most informative state
  const groupedTools = toolInvocations.reduce(
    (acc, item) => {
      const { toolCallId } = item;
      if (!acc[toolCallId]) {
        acc[toolCallId] = [];
      }
      acc[toolCallId].push(item);
      return acc;
    },
    {} as Record<string, ToolInvocationPart[]>
  );

  // For each toolCallId, get the most informative state (done > output-available > streaming)
  const toolsToDisplay = Object.values(groupedTools)
    .map((group) => {
      const doneTool = group.find((item) => item.state === 'done');
      const outputTool = group.find(
        (item) => item.state === 'output-available'
      );
      const streamingTool = group.find((item) => item.state === 'streaming');

      // Return the most informative one
      return doneTool || outputTool || streamingTool || group[0];
    })
    .filter(Boolean) as ToolInvocationPart[];

  if (toolsToDisplay.length === 0) {
    return null;
  }

  // If there's only one tool, display it directly
  if (toolsToDisplay.length === 1) {
    return (
      <SingleToolCard
        className={className}
        defaultOpen={defaultOpen}
        toolData={toolsToDisplay[0]}
      />
    );
  }

  // If there are multiple tools, show them in a list
  return (
    <div className={className}>
      <div className="space-y-4">
        {toolsToDisplay.map((tool) => (
          <SingleToolCard
            defaultOpen={defaultOpen}
            key={tool.toolCallId}
            toolData={tool}
          />
        ))}
      </div>
    </div>
  );
}

// New component to handle individual tool cards
function SingleToolCard({
  toolData,
  defaultOpen = false,
  className,
}: {
  toolData: ToolInvocationPart;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const { state, toolName, toolCallId, input } = toolData;
  const isLoading = state === 'streaming' || state === 'input-streaming';
  const isCompleted = state === 'done' || state === 'output-available';
  const result = isCompleted ? toolData.output : undefined;

  // Parse the result JSON if available
  const { parsedResult, parseError } = useMemo(() => {
    if (!(isCompleted && result)) {
      return { parsedResult: null, parseError: null };
    }

    try {
      if (Array.isArray(result)) {
        return { parsedResult: result, parseError: null };
      }

      if (
        typeof result === 'object' &&
        result !== null &&
        'content' in result
      ) {
        const textContent = Array.isArray(result.content)
          ? result.content.find(
              (item: { type: string }) => item.type === 'text'
            )
          : null;
        if (!textContent?.text) {
          return { parsedResult: null, parseError: null };
        }

        try {
          return {
            parsedResult: JSON.parse(textContent.text),
            parseError: null,
          };
        } catch {
          return { parsedResult: textContent.text, parseError: null };
        }
      }

      return { parsedResult: result, parseError: null };
    } catch {
      return { parsedResult: null, parseError: 'Failed to parse result' };
    }
  }, [isCompleted, result]);

  // Format the arguments for display
  const formattedArgs: React.ReactNode =
    input && typeof input === 'object' && input !== null
      ? Object.entries(input as Record<string, unknown>).map(([key, value]) => (
          <div className="mb-1" key={key}>
            <span className="font-medium text-muted-foreground">{key}:</span>{' '}
            <span className="font-mono">
              {typeof value === 'object'
                ? value === null
                  ? 'null'
                  : Array.isArray(value)
                    ? value.length === 0
                      ? '[]'
                      : JSON.stringify(value)
                    : JSON.stringify(value)
                : String(value)}
            </span>
          </div>
        ))
      : null;

  // Render generic results based on their structure
  const renderResults = () => {
    if (!parsedResult) {
      return 'No result data available';
    }

    // Handle array of items with url, title, and snippet (like search results)
    if (Array.isArray(parsedResult) && parsedResult.length > 0) {
      // Check if items look like search results
      if (
        parsedResult[0] &&
        typeof parsedResult[0] === 'object' &&
        'url' in parsedResult[0] &&
        'title' in parsedResult[0]
      ) {
        return (
          <div className="space-y-3">
            {parsedResult.map(
              (
                item: { url: string; title: string; snippet?: string },
                index: number
              ) => (
                <div
                  className="border-border border-b pb-3 last:border-0 last:pb-0"
                  key={index}
                >
                  <a
                    className="group flex items-center gap-1 font-medium text-primary hover:underline"
                    href={item.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {item.title}
                    <Link className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </a>
                  <div className="mt-1 font-mono text-muted-foreground text-xs">
                    {item.url}
                  </div>
                  {item.snippet && (
                    <div className="mt-1 line-clamp-2 text-sm">
                      {item.snippet}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        );
      }

      // Generic array display
      return (
        <div className="font-mono text-xs">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(parsedResult, null, 2)}
          </pre>
        </div>
      );
    }

    // Handle object results
    if (typeof parsedResult === 'object' && parsedResult !== null) {
      const resultObj = parsedResult as Record<string, unknown>;
      const title =
        typeof resultObj.title === 'string' ? resultObj.title : null;
      const htmlUrl =
        typeof resultObj.html_url === 'string' ? resultObj.html_url : null;

      return (
        <div>
          {title && <div className="mb-2 font-medium">{title}</div>}
          {htmlUrl && (
            <div className="mb-2">
              <a
                className="flex items-center gap-1 text-primary hover:underline"
                href={htmlUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="font-mono">{htmlUrl}</span>
                <Link className="h-3 w-3 opacity-70" />
              </a>
            </div>
          )}
          <div className="font-mono text-xs">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(parsedResult, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    // Handle string results
    if (typeof parsedResult === 'string') {
      return <div className="whitespace-pre-wrap">{parsedResult}</div>;
    }

    // Fallback
    return 'No result data available';
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-0 overflow-hidden rounded-md border border-border',
        className
      )}
    >
      <button
        className="flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors hover:bg-accent"
        onClick={(e) => {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }}
        type="button"
      >
        <div className="flex flex-1 flex-row items-center gap-2 text-left text-base">
          <Wrench className="size-4 text-muted-foreground" />
          <span className="font-mono text-sm">{toolName}</span>
          <AnimatePresence initial={false} mode="popLayout">
            {isLoading ? (
              <motion.div
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                key="loading"
                transition={{ duration: 0.15 }}
              >
                <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-blue-700 text-xs dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
                  <Spinner className="mr-1 h-3 w-3 animate-spin" />
                  Running
                </div>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                initial={{ opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                key="completed"
                transition={{ duration: 0.15 }}
              >
                <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-green-700 text-xs dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <CaretDown
          className={cn(
            'h-4 w-4 transition-transform',
            isExpanded ? 'rotate-180 transform' : ''
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={TRANSITION}
          >
            <div className="space-y-3 px-3 pt-3 pb-3">
              {/* Arguments section */}
              {input &&
              typeof input === 'object' &&
              input !== null &&
              Object.keys(input).length > 0 ? (
                <div>
                  <div className="mb-1 font-medium text-muted-foreground text-xs">
                    Arguments
                  </div>
                  <div className="rounded border bg-background p-2 text-sm">
                    {formattedArgs}
                  </div>
                </div>
              ) : null}

              {/* Result section */}
              {isCompleted && (
                <div>
                  <div className="mb-1 font-medium text-muted-foreground text-xs">
                    Result
                  </div>
                  <div className="max-h-60 overflow-auto rounded border bg-background p-2 text-sm">
                    {parseError ? (
                      <div className="text-red-500">{parseError}</div>
                    ) : (
                      renderResults()
                    )}
                  </div>
                </div>
              )}

              {/* Tool call ID */}
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <div className="flex items-center">
                  <Code className="mr-1 inline size-3" />
                  Tool Call ID:{' '}
                  <span className="ml-1 font-mono">{toolCallId}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
