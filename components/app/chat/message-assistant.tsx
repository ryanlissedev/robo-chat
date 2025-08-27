import type { UIMessage as MessageAISDK } from '@ai-sdk/react';
import { Check, Copy, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
// AI SDK Elements
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { Response } from '@/components/ai-elements/response';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/source';
import {
  Message,
  MessageAction,
  MessageActions,
} from '@/components/prompt-kit/message';
import { toast } from '@/components/ui/toast';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';
import { getSources } from './get-sources';
import { MessageFeedback } from './message-feedback';
import { QuoteButton } from './quote-button';
import { SearchImages } from './search-images';
import type { ToolUIPart } from './tool-invocation';
import { ToolInvocation } from './tool-invocation';
import { useAssistantMessageSelection } from './useAssistantMessageSelection';

type MessageAssistantProps = {
  children: string;
  isLast?: boolean;
  hasScrollAnchor?: boolean;
  copied?: boolean;
  copyToClipboard?: () => void;
  onReload?: () => void;
  parts?: MessageAISDK['parts'];
  status?: 'streaming' | 'ready' | 'submitted' | 'error';
  className?: string;
  messageId: string;
  onQuote?: (text: string, messageId: string) => void;
  langsmithRunId?: string;
};

export function MessageAssistant({
  children,
  isLast,
  hasScrollAnchor,
  copied,
  copyToClipboard,
  onReload,
  parts,
  status,
  className,
  messageId,
  onQuote,
  langsmithRunId,
}: MessageAssistantProps) {
  const { preferences } = useUserPreferences();
  const sources = getSources(parts || []);
  // Type guard to narrow AI SDK parts to tool invocation parts
  const isToolUIPart = (
    part: NonNullable<MessageAISDK['parts']>[number]
  ): part is ToolUIPart => {
    return (
      typeof part.type === 'string' &&
      part.type.startsWith('tool-') &&
      'toolCallId' in part
    );
  };
  // Filter for tool parts using the AI SDK's built-in tool part types
  const toolInvocationParts: ToolUIPart[] = useMemo(
    () => parts?.filter(isToolUIPart) || [],
    [parts, isToolUIPart]
  );

  // Show actionable toast when fileSearch tool fails
  const hasShownFileSearchErrorRef = useRef(false);
  useEffect(() => {
    if (hasShownFileSearchErrorRef.current) return;
    if (!toolInvocationParts.length) return;

    // Find fileSearch tool outputs and check for success=false
    const fileSearchOutputs = toolInvocationParts.filter(
      (p) =>
        typeof p.type === 'string' &&
        'toolName' in p &&
        (p as { toolName?: string }).toolName === 'fileSearch' &&
        'state' in p &&
        (p as { state?: string }).state === 'output-available' &&
        'output' in p
    );

    for (const part of fileSearchOutputs) {
      // Attempt to parse the output as JSON from text content or object
      let parsed: unknown;
      const output = (part as { output?: unknown }).output;
      try {
        if (
          output &&
          typeof output === 'object' &&
          'content' in (output as Record<string, unknown>)
        ) {
          const content = (
            output as { content?: Array<{ type: string; text?: string }> }
          ).content;
          const textNode = Array.isArray(content)
            ? content.find(
                (c) =>
                  c &&
                  typeof c === 'object' &&
                  (c as { type?: string }).type === 'text'
              )
            : undefined;
          if (textNode && typeof textNode.text === 'string') {
            try {
              parsed = JSON.parse(textNode.text);
            } catch {
              parsed = undefined;
            }
          }
        } else if (typeof output === 'string') {
          try {
            parsed = JSON.parse(output);
          } catch {
            parsed = undefined;
          }
        } else if (output && typeof output === 'object') {
          parsed = output;
        }
      } catch {
        // ignore parse errors
      }

      const result = parsed as
        | { success?: boolean; error?: string; summary?: string }
        | undefined;
      if (result && result.success === false) {
        hasShownFileSearchErrorRef.current = true;
        const description =
          result.error ||
          result.summary ||
          'File search failed. Please try again.';
        toast({
          title: 'File search failed',
          description,
          status: 'error',
          ...(onReload
            ? {
                button: {
                  label: 'Retry',
                  onClick: () => {
                    try {
                      onReload?.();
                    } catch {
                      /* noop */
                    }
                  },
                },
              }
            : {}),
        });
        break;
      }
    }
  }, [toolInvocationParts, onReload]);

  const reasoningParts = parts?.find((part) => part.type === 'reasoning');
  const contentNullOrEmpty = children === null || children === '';
  const isLastStreaming = status === 'streaming' && isLast;

  // Extract search image results from tool parts
  const searchImageResults =
    parts
      ?.filter(
        (part) =>
          part.type.startsWith('tool-') &&
          'state' in part &&
          part.state === 'output-available' &&
          'toolName' in part &&
          part.toolName === 'imageSearch'
      )
      .flatMap((part) => {
        if ('output' in part) {
          const result = part.output as {
            content?: {
              type: string;
              results?: {
                title: string;
                imageUrl: string;
                sourceUrl: string;
              }[];
            }[];
          };
          return result?.content?.[0]?.type === 'images'
            ? (result.content[0].results ?? [])
            : [];
        }
        return [];
      }) ?? [];

  const isQuoteEnabled = !preferences.multiModelEnabled;
  const messageRef = useRef<HTMLDivElement>(null);
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  );
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId);
      clearSelection();
    }
  }, [selectionInfo, onQuote, clearSelection]);

  return (
    <Message
      className={cn(
        'group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2',
        hasScrollAnchor && 'min-h-scroll-anchor',
        className
      )}
    >
      <div
        className={cn(
          'relative flex min-w-full flex-col gap-2',
          isLast && 'pb-8'
        )}
        ref={messageRef}
        {...(isQuoteEnabled && { 'data-message-id': messageId })}
      >
        {reasoningParts && 'text' in reasoningParts && reasoningParts.text && (
          <Reasoning defaultOpen={false} isStreaming={status === 'streaming'}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoningParts.text}</ReasoningContent>
          </Reasoning>
        )}

        {toolInvocationParts &&
          toolInvocationParts.length > 0 &&
          preferences.showToolInvocations && (
            <ToolInvocation toolInvocations={toolInvocationParts} />
          )}

        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults} />
        )}

        {contentNullOrEmpty ? null : (
          <Response
            className={cn(
              'prose dark:prose-invert relative min-w-full bg-transparent p-0',
              'prose-h2:mt-8 prose-h2:mb-3 prose-table:block prose-h1:scroll-m-20 prose-h2:scroll-m-20 prose-h3:scroll-m-20 prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-table:overflow-y-auto prose-h1:font-semibold prose-h2:font-medium prose-h3:font-medium prose-strong:font-medium prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base'
            )}
          >
            {children}
          </Response>
        )}

        {sources && sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length} />
            <SourcesContent>
              {sources.map(
                (source: { url: string; title?: string }, index: number) => (
                  <Source
                    href={source.url}
                    key={index}
                    title={source.title || source.url}
                  />
                )
              )}
            </SourcesContent>
          </Sources>
        )}

        {isLastStreaming || contentNullOrEmpty ? null : (
          <MessageActions
            className={cn(
              '-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100'
            )}
          >
            <MessageAction
              side="bottom"
              tooltip={copied ? 'Copied!' : 'Copy text'}
            >
              <button
                aria-label="Copy text"
                className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                onClick={copyToClipboard}
                type="button"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </MessageAction>
            {isLast ? (
              <MessageAction
                delayDuration={0}
                side="bottom"
                tooltip="Regenerate"
              >
                <button
                  aria-label="Regenerate"
                  className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                  onClick={onReload}
                  type="button"
                >
                  <RotateCw className="size-4" />
                </button>
              </MessageAction>
            ) : null}
            <MessageFeedback
              className="ml-1"
              langsmithRunId={langsmithRunId}
              messageId={messageId}
            />
          </MessageActions>
        )}

        {isQuoteEnabled && selectionInfo && selectionInfo.messageId && (
          <QuoteButton
            messageContainerRef={messageRef}
            mousePosition={selectionInfo.position}
            onDismiss={clearSelection}
            onQuote={handleQuoteBtnClick}
          />
        )}
      </div>
    </Message>
  );
}
