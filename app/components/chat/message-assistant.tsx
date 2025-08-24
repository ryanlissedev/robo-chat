import type { UIMessage as MessageAISDK } from '@ai-sdk/react';
import { ArrowClockwise, Check, Copy } from '@phosphor-icons/react';
import { useCallback, useRef } from 'react';
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
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';
import { getSources } from './get-sources';
import { MessageFeedback } from './message-feedback';
import { QuoteButton } from './quote-button';
import { SearchImages } from './search-images';
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
  // Filter for tool parts using the AI SDK's built-in tool part types
  const toolInvocationParts = parts?.filter(
    (part) => part.type.startsWith('tool-')
  ) || [];
  
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
          const result = part.output as { content?: { type: string; results?: { title: string; imageUrl: string; sourceUrl: string }[] }[] };
          return result?.content?.[0]?.type === 'images' ? (result.content[0].results ?? []) : [];
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
            <ToolInvocation toolInvocations={toolInvocationParts as any} />
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
              {sources.map((source: { url: string; title?: string }, index: number) => (
                <Source
                  href={source.url}
                  key={index}
                  title={source.title || source.url}
                />
              ))}
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
                  <ArrowClockwise className="size-4" />
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
