import type { UIMessage as MessageAISDK } from '@ai-sdk/react';
import { Check, Copy, RotateCw } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

// AI SDK Elements
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { TextShimmer } from '@/components/ui/text-shimmer';

import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/source';
import {
  ToolActionContainer,
  ToolActionKind,
  ToolActionContent,
} from '@/components/ai-elements/tool-action';

import {
  Tool as AITool,
  ToolContent as AIToolContent,
  ToolHeader as AIToolHeader,
  ToolInput as AIToolInput,
  ToolOutput as AIToolOutput,
} from '@/components/ai-elements/tool';

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
import { SmoothStreamingMessage } from './smooth-streaming-message';
import type { ToolUIPart } from './tool-invocation';
import { useAssistantMessageSelection } from './useAssistantMessageSelection';

// ========= Types & Typeguards =========

type Part = NonNullable<MessageAISDK['parts']>[number];

type ToolPartState =
  | 'output-available'
  | 'input-available'
  | 'input-streaming'
  | 'output-error';

// Type for reasoning parts
interface ReasoningPart {
  type: 'reasoning' | 'reasoning-delta' | string;
  text?: string;
  delta?: string;
  reasoningText?: string;
  toolName?: string;
  output?: unknown;
}

interface TypedToolPart {
  toolCallId?: string;
  state?: ToolPartState;
  type: string;
  toolName?: string;
  output?: unknown;
  input?: unknown;
  errorText?: string;
  text?: string;
  reasoningText?: string;
}

interface ImageResult {
  title: string;
  imageUrl: string;
  sourceUrl: string;
}

const isToolUIPart = (part: Part): part is ToolUIPart => {
  const rec = part as unknown as Record<string, unknown>;
  return (
    typeof rec?.type === 'string' &&
    String(rec.type).startsWith('tool-') &&
    'toolCallId' in rec
  );
};

// ========= Pure helpers (éénpass, herbruikbaar) =========

const BEST_STATE_ORDER: ToolPartState[] = [
  'output-available',
  'input-available',
  'input-streaming',
  'output-error',
];

const pickBestState = (group: ToolUIPart[]): ToolUIPart => {
  // Kies de "informatiereikste" part volgens BEST_STATE_ORDER
  let best: ToolUIPart | undefined;
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const p of group) {
    const s = (p as TypedToolPart).state;
    const idx = s ? BEST_STATE_ORDER.indexOf(s) : BEST_STATE_ORDER.length;
    if (idx >= 0 && idx < bestIdx) {
      best = p;
      bestIdx = idx;
    }
  }
  return best ?? group[0];
};

const groupToolParts = (toolParts: ToolUIPart[]): ToolUIPart[] => {
  if (toolParts.length === 0) return [];
  const map = new Map<string, ToolUIPart[]>();
  for (const p of toolParts) {
    const id = (p as TypedToolPart).toolCallId || 'unknown';
    const arr = map.get(id);
    if (arr) arr.push(p);
    else map.set(id, [p]);
  }
  const picks: ToolUIPart[] = [];
  for (const [, group] of map) picks.push(pickBestState(group));
  return picks;
};

const extractToolInvocationParts = (
  parts?: MessageAISDK['parts']
): ToolUIPart[] => {
  if (!parts || parts.length === 0) return [];
  // filter zonder extra allocaties
  const out: ToolUIPart[] = [];
  for (const p of parts) if (isToolUIPart(p)) out.push(p);
  return out;
};

const parseMaybeJson = (value: unknown): unknown => {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const extractFileSearchFailure = (toolParts: ToolUIPart[]) => {
  // Zoek eerste fileSearch met success=false
  for (const p of toolParts) {
    const tp = p as TypedToolPart;
    if (
      tp.toolName === 'fileSearch' &&
      tp.state === 'output-available' &&
      'output' in tp
    ) {
      let parsed: unknown | undefined;

      // Output kan string of { content: [{type:'text', text:string}]} zijn
      const out = tp.output;
      if (
        out &&
        typeof out === 'object' &&
        out !== null &&
        'content' in out &&
        Array.isArray((out as Record<string, unknown>).content)
      ) {
        const content = (out as Record<string, unknown>).content as Array<
          Record<string, unknown>
        >;
        const textNode = content.find((c) => c?.type === 'text');
        parsed = parseMaybeJson(textNode?.text);
        if (!parsed) parsed = out; // val terug op object
      } else {
        parsed = parseMaybeJson(out);
      }

      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as Record<string, unknown>).success === false
      ) {
        const obj = parsed as Record<string, unknown>;
        const description =
          (obj.error as string | undefined) ||
          (obj.summary as string | undefined) ||
          'File search failed. Please try again.';
        return String(description);
      }
    }
  }
  return null;
};

const extractReasoningText = (
  parts?: MessageAISDK['parts']
): string | undefined => {
  if (!parts || parts.length === 0) return undefined;

  // Collect all reasoning parts and combine them
  const reasoningTexts: string[] = [];

  for (const part of parts as ReasoningPart[]) {
    // AI SDK v5 reasoning parts - handle both text and delta
    if (part?.type === 'reasoning' || part?.type === 'reasoning-delta') {
      const reasoningText = part?.text || part?.delta || part?.reasoningText;
      if (typeof reasoningText === 'string' && reasoningText.trim()) {
        reasoningTexts.push(reasoningText);
      }
    }

    // Tool-based reasoning (for some models)
    if (typeof part?.type === 'string' && part.type.startsWith('tool-')) {
      if (part.toolName === 'reasoning') {
        const direct = part.text ?? part.reasoningText ?? part.delta;
        if (typeof direct === 'string' && direct.trim()) {
          reasoningTexts.push(direct);
        }
      }
      if (part.output && typeof part.output === 'object') {
        const out = part.output as Record<string, unknown>;
        if (out.reasoning != null) {
          const reasoning = String(out.reasoning);
          if (reasoning.trim()) {
            reasoningTexts.push(reasoning);
          }
        }
      }
    }
  }

  // Return combined reasoning text if we found any
  if (reasoningTexts.length > 0) {
    return reasoningTexts.join('');
  }

  return undefined;
};

const extractSearchImageResults = (
  parts?: MessageAISDK['parts']
): ImageResult[] => {
  if (!parts || parts.length === 0) return [];
  const results: ImageResult[] = [];
  for (const p of parts as TypedToolPart[]) {
    if (
      typeof p.type === 'string' &&
      p.type.startsWith('tool-') &&
      p.state === 'output-available' &&
      p.toolName === 'imageSearch' &&
      p.output
    ) {
      const out = p.output as {
        content?: Array<{ type: string; results?: ImageResult[] }>;
      };
      const first = out?.content?.[0];
      if (first?.type === 'images' && Array.isArray(first.results)) {
        // push zonder extra arrays
        for (const r of first.results) results.push(r);
      }
    }
  }
  return results;
};

// Dedup urls zodat Sources niet explodeert
const dedupSources = (
  sources: Array<{ id: string; url: string; title: string }>
) => {
  if (!sources.length) return sources;
  const seen = new Set<string>();
  const out: typeof sources = [];
  for (const s of sources) {
    if (!seen.has(s.url)) {
      seen.add(s.url);
      out.push(s);
    }
  }
  return out;
};

// ========= Subcomponent: ToolInvocationCard (gememoized) =========

const ToolInvocationCard = memo(function ToolInvocationCard({
  part,
}: {
  part: ToolUIPart;
}) {
  const tp = part as TypedToolPart;

  // Alleen stringify wanneer output-referentie wijzigt
  const outputNode = useMemo(() => {
    const out = tp.output as unknown;
    if (out == null) return null;

    if (typeof out === 'string') {
      return (
        <pre
          className="whitespace-pre-wrap text-xs"
          role="log"
          aria-describedby="tool-output"
        >
          {out}
        </pre>
      );
    }
    if (typeof out === 'object') {
      let text = '';
      try {
        text = JSON.stringify(out, null, 2);
      } catch {
        text = '[Unserializable output]';
      }
      return (
        <pre
          className="whitespace-pre-wrap text-xs"
          role="log"
          aria-describedby="tool-output"
        >
          {text}
        </pre>
      );
    }
    return null;
  }, [tp.output]);

  // Use original tool visualization with enhanced styling
  return (
    <AITool key={tp.toolCallId}>
      <AIToolHeader
        state={tp.state ?? 'input-available'}
        type={tp.type}
      />
      <AIToolContent>
        {tp.input ? <AIToolInput input={tp.input} /> : null}
        {tp.output ? (
          <AIToolOutput errorText={tp.errorText} output={outputNode} />
        ) : null}
      </AIToolContent>
    </AITool>
  );
});

// ========= Component =========

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

  // ---- Derived data (gememoized) ----
  const toolInvocationParts = useMemo(
    () => extractToolInvocationParts(parts),
    [parts]
  );
  const groupedToolParts = useMemo(
    () => groupToolParts(toolInvocationParts),
    [toolInvocationParts]
  );
  const reasoningText = useMemo(() => extractReasoningText(parts), [parts]);
  const searchImageResults = useMemo(
    () => extractSearchImageResults(parts),
    [parts]
  );

  // Sources (met dedup)
  const sources = useMemo(() => dedupSources(getSources(parts ?? [])), [parts]);

  const contentNullOrEmpty = children == null || children === '';
  const isLastStreaming = status === 'streaming' && isLast;
  const showTools =
    groupedToolParts.length > 0 && preferences.showToolInvocations;

  // ---- FileSearch error toast (één keer) ----
  const hasShownFileSearchErrorRef = useRef(false);
  useEffect(() => {
    if (hasShownFileSearchErrorRef.current) return;
    if (toolInvocationParts.length === 0) return;

    const description = extractFileSearchFailure(toolInvocationParts);
    if (description) {
      hasShownFileSearchErrorRef.current = true;
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
    }
  }, [toolInvocationParts, onReload]);

  // ---- Quote selectie ----
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

  // ---- Stabiele handlers voor acties ----
  const handleCopy = useCallback(() => copyToClipboard?.(), [copyToClipboard]);
  const handleReload = useCallback(() => onReload?.(), [onReload]);

  return (
    <Message
      className={cn(
        'group flex w-full max-w-3xl flex-1 items-start gap-4 px-6 pb-2',
        hasScrollAnchor && 'min-h-scroll-anchor',
        status === 'error' && 'border-red-200 bg-red-50',
        className
      )}
      data-testid="message-assistant"
      data-role="assistant"
      data-status={status}
    >
      <div
        className={cn(
          'relative flex min-w-full flex-col gap-2',
          isLast && 'pb-8'
        )}
        ref={messageRef}
        {...(isQuoteEnabled && { 'data-message-id': messageId })}
      >
        {/* Reasoning - Enhanced with auto-open/close and duration tracking */}
        {((status === 'streaming' && isLast) || reasoningText) && (
          <Reasoning
            defaultOpen={false}
            isStreaming={status === 'streaming'}
          >
            <ReasoningTrigger />
            {reasoningText ? (
              <ReasoningContent>{reasoningText}</ReasoningContent>
            ) : status === 'streaming' && isLast ? (
              <ReasoningContent>
                <TextShimmer>Thinking...</TextShimmer>
              </ReasoningContent>
            ) : null}
          </Reasoning>
        )}

        {/* Tool invocations */}
        {showTools && (
          <div className="mb-6 w-full space-y-3">
            {groupedToolParts.map((part) => (
              <ToolInvocationCard
                key={(part as TypedToolPart).toolCallId ?? part.type}
                part={part}
              />
            ))}
          </div>
        )}

        {/* Image search resultaten */}
        {searchImageResults.length > 0 && (
          <SearchImages results={searchImageResults} />
        )}

        {/* Error state display */}
        {status === 'error' && (
          <div
            className="rounded-md bg-red-50 p-3 text-sm text-red-700"
            data-testid="message-error"
            role="alert"
          >
            An error occurred processing this message. Please try again.
          </div>
        )}

        {/* Text content */}
        {!contentNullOrEmpty && (
          <div className="relative min-w-full">
            <SmoothStreamingMessage
              text={children}
              animate={isLastStreaming}
              sources={sources.map((source, _index) => ({
                id: source.id,
                url: source.url,
                title: source.title,
                description: undefined, // Add description if available in source
                quote: undefined, // Add quote if available in source
              }))}
            />
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length} />
            <SourcesContent>
              {sources.map((source, index) => (
                <Source
                  href={source.url}
                  key={`${source.url}-${index}`}
                  title={source.title || source.url}
                  description={undefined} // Add description if available in source data
                  chunk={undefined} // Add chunk/excerpt if available in source data
                  index={index}
                />
              ))}
            </SourcesContent>
          </Sources>
        )}

        {/* Acties (copy / regen / feedback) */}
        {!isLastStreaming && !contentNullOrEmpty && (
          <MessageActions className="-ml-2 flex gap-0 opacity-0 transition-opacity group-hover:opacity-100">
            <MessageAction
              side="bottom"
              tooltip={copied ? 'Copied!' : 'Copy text'}
            >
              <button
                aria-label="Copy text"
                className="flex size-7.5 items-center justify-center rounded-full bg-transparent text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
                onClick={handleCopy}
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
                  onClick={handleReload}
                  type="button"
                  data-testid="retry-button"
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

        {/* Quote button */}
        {isQuoteEnabled && selectionInfo?.messageId && (
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
