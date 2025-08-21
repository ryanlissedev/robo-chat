import { ArrowClockwise, Check, Copy, ThumbsUp, ThumbsDown } from '@phosphor-icons/react';
import { Volume2, AudioAudioWaveform } from 'lucide-react';
import type { UIMessage as MessageAISDK } from 'ai';
import { useCallback, useRef } from 'react';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from '@/components/prompt-kit/message';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';
import { getSources } from './get-sources';
import { MessageFeedback } from './message-feedback';
import { QuoteButton } from './quote-button';
import { Reasoning } from './reasoning';
import { SearchImages } from './search-images';
import { SourcesList } from './sources-list';
import { ToolInvocation } from './tool-invocation';
import { useAssistantMessageSelection } from './useAssistantMessageSelection';
import { useVoiceOutput } from './voice-input';

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
  const toolInvocationParts = parts?.filter(
    (part) =>
      part.type === 'dynamic-tool' && 'toolName' in part && 'toolCallId' in part
  ) as Array<{
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
    [key: string]: unknown;
  }>;
  const reasoningParts = parts?.find((part) => part.type === 'reasoning');
  const contentNullOrEmpty = children === null || children === '';
  const isLastStreaming = status === 'streaming' && isLast;
  const searchImageResults =
    parts
      ?.filter((part) => {
        return (
          typeof part.type === 'string' &&
          part.type.startsWith('tool-') &&
          'state' in part &&
          (part.state === 'done' || part.state === 'output-available') &&
          'toolName' in part &&
          part.toolName === 'imageSearch' &&
          'output' in part &&
          part.output &&
          typeof part.output === 'object' &&
          'content' in part.output &&
          Array.isArray(part.output.content) &&
          part.output.content[0]?.type === 'images'
        );
      })
      .flatMap((part) => {
        return 'output' in part &&
          part.output &&
          typeof part.output === 'object' &&
          'content' in part.output &&
          Array.isArray(part.output.content) &&
          part.output.content[0]?.type === 'images'
          ? (part.output.content[0]?.results ?? [])
          : [];
      }) ?? [];

  const isQuoteEnabled = !preferences.multiModelEnabled;
  const messageRef = useRef<HTMLDivElement>(null);
  const { selectionInfo, clearSelection } = useAssistantMessageSelection(
    messageRef,
    isQuoteEnabled
  );
  const { speakMessage } = useVoiceOutput();
  
  const handleQuoteBtnClick = useCallback(() => {
    if (selectionInfo && onQuote) {
      onQuote(selectionInfo.text, selectionInfo.messageId);
      clearSelection();
    }
  }, [selectionInfo, onQuote, clearSelection]);

  const handleSpeakMessage = useCallback(() => {
    if (children) {
      speakMessage(children);
    }
  }, [children, speakMessage]);

  return (
    <Message
      className={cn(
        'group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2',
        hasScrollAnchor && 'min-h-scroll-anchor',
        className
      )}
      data-testid="chat-message"
    >
      <div
        className={cn(
          'relative flex min-w-full flex-col gap-2',
          isLast && 'pb-8'
        )}
        ref={messageRef}
        {...(isQuoteEnabled && { 'data-message-id': messageId })}
      >
        {reasoningParts && 'text' in reasoningParts && (
          <Reasoning
            isStreaming={status === 'streaming'}
            reasoningText={reasoningParts.text}
          />
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
          <>
            {/* Safety warning detection */}
            {(children.toLowerCase().includes('safety') || 
              children.toLowerCase().includes('warning') || 
              children.toLowerCase().includes('danger') || 
              children.toLowerCase().includes('caution') ||
              children.toLowerCase().includes('hazard')) && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                <p className="font-medium flex items-center gap-2">
                  ⚠️ Safety Information
                </p>
                <p className="text-xs mt-1">Always follow HGG safety protocols and consult your safety manual.</p>
              </div>
            )}
            <MessageContent
              className={cn(
                'prose dark:prose-invert relative min-w-full bg-transparent p-0',
                'prose-h2:mt-8 prose-h2:mb-3 prose-table:block prose-h1:scroll-m-20 prose-h2:scroll-m-20 prose-h3:scroll-m-20 prose-h4:scroll-m-20 prose-h5:scroll-m-20 prose-h6:scroll-m-20 prose-table:overflow-y-auto prose-h1:font-semibold prose-h2:font-medium prose-h3:font-medium prose-strong:font-medium prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base',
                'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono'
              )}
              markdown={true}
            >
              {children}
            </MessageContent>
          </>
        )}

        {sources && sources.length > 0 && <SourcesList sources={sources} />}

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
            <MessageAction
              side="bottom"
              tooltip="Read aloud"
            >
              <button
                aria-label="Read message aloud"
                className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                onClick={handleSpeakMessage}
                type="button"
              >
                <Volume2 className="size-4" />
              </button>
            </MessageAction>
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
