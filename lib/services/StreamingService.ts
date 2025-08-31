import type { LanguageModel, ModelMessage } from 'ai';
import { streamText } from 'ai';
import {
  extractRunId,
  isLangSmithEnabled,
  logMetrics,
  updateRun,
} from '@/lib/langsmith/client';
import {
  extractReasoningFromResponse,
  type ReasoningContext,
} from '@/lib/middleware/extract-reasoning-middleware';
import logger from '@/lib/utils/logger';
import { type Provider, trackCredentialUsage } from '@/lib/utils/metrics';
import { storeAssistantMessage } from '../../app/api/chat/api';
import type { ResponseWithUsage, SupabaseClientType } from './types';

/**
 * Minimal shapes we rely on from the AI SDK message formats.
 */
type TextPart = { type?: string; text?: string | null };
type MaybeAssistantLike = {
  role?: string;
  content?: unknown;
  parts?: TextPart[] | undefined;
  toolInvocations?: unknown[] | undefined;
};

type StreamContext = {
  isGPT5Model: boolean;
  chatId: string;
  userId: string;
  resolvedModel: string;
  reasoningEffort: string;
  enableSearch: boolean;
  supabase: SupabaseClientType | null;
  message_group_id?: string | undefined;
  langsmithRunId?: string | null;
};

type StreamArgs = {
  model: LanguageModel;
  systemPrompt: string;
  messages: ModelMessage[];
  tools?: any;
  // For labeling logs only (e.g. "fallback" vs "main")
  phase: 'main' | 'fallback';
} & StreamContext;

const getPreview = (text: string | undefined | null, max = 500): string => {
  if (!text) return '';
  const trimmed = String(text).trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';

const last = <T>(arr: readonly T[] | T[] | undefined): T | undefined =>
  Array.isArray(arr) && arr.length ? arr[arr.length - 1] : undefined;

/**
 * Return the last assistant message's text, regardless of whether it's in `content` or `parts`.
 */
const extractAssistantText = (response: ResponseWithUsage): string => {
  const msgs = (response.messages || []) as unknown[];
  // Prefer the last message but guard for cases where assistant is not last
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i] as MaybeAssistantLike;
    if (m?.role === 'assistant') {
      // Case 1: content is a string
      if (typeof m.content === 'string') return m.content;
      // Case 2: content is parts-like array
      if (Array.isArray(m.content)) {
        return (m.content as TextPart[])
          .map((p) =>
            p && typeof p === 'object' && 'text' in p ? p.text || '' : ''
          )
          .join('');
      }
      // Case 3: parts on the message object
      if (Array.isArray(m.parts)) {
        return m.parts
          .map((p) =>
            p && typeof p === 'object' && p.type === 'text' ? p.text || '' : ''
          )
          .join('');
      }
      // If assistant but no text payload
      return '';
    }
  }
  return '';
};

const logToolInvocations = (
  response: ResponseWithUsage,
  phase: 'main' | 'fallback'
): void =>
  (() => {
    const lastMsg = last(response.messages as unknown[]);
    if (!isObject(lastMsg)) return;
    const withTools = lastMsg as MaybeAssistantLike;
    const inv = withTools.toolInvocations;
    if (Array.isArray(inv)) {
      for (const invocation of inv) {
        logger.info(
          { at: 'api.chat.toolInvocation', phase, invocation },
          'Tool invocation result'
        );
      }
    }
  })();

const handleReasoningExtraction = (
  assistantText: string,
  isGPT5Model: boolean,
  resolvedModel: string,
  chatId: string,
  userId: string,
  reasoningEffort: string,
  response: ResponseWithUsage
): ReasoningContext | null => {
  if (!isGPT5Model || !assistantText) return null;

  const usage = response.usage;
  const reasoningContext = extractReasoningFromResponse(
    assistantText,
    /* processingTime */ undefined,
    usage?.totalTokens
  );

  if (reasoningContext.traces.length > 0) {
    logger.info(
      {
        at: 'api.chat.reasoningExtracted',
        chatId,
        userId,
        model: resolvedModel,
        traceCount: reasoningContext.traces.length,
        traceTypes: reasoningContext.traces.map((t) => t.type),
        summary: reasoningContext.summary,
        reasoningTraces: reasoningContext.traces.map((trace, index) => ({
          index,
          type: trace.type,
          contentPreview: getPreview(trace.content, 200),
          fullContentLength: trace.content?.length || 0,
        })),
        reasoningSummaryFull: reasoningContext.summary,
      },
      'Reasoning traces extracted from model response'
    );

    reasoningContext.traces.forEach((trace, index) => {
      logger.info(
        {
          at: 'api.chat.reasoningTrace',
          chatId,
          userId,
          model: resolvedModel,
          traceIndex: index,
          traceType: trace.type,
          reasoningContent: trace.content,
        },
        `Reasoning Trace ${index + 1}/${reasoningContext.traces.length}: ${trace.type}`
      );
    });
  } else {
    logger.info(
      {
        at: 'api.chat.noReasoningFound',
        chatId,
        userId,
        model: resolvedModel,
        assistantTextLength: assistantText.length,
        assistantTextPreview: getPreview(assistantText, 300),
        isGPT5Model,
        reasoningEffort,
      },
      'NO reasoning traces found in response'
    );
  }

  return reasoningContext;
};

const logAssistantResponse = (
  assistantText: string,
  chatId: string,
  userId: string,
  resolvedModel: string,
  reasoningSummary?: string
): void => {
  logger.info(
    {
      at: 'api.chat.assistantResponse',
      chatId,
      userId,
      model: resolvedModel,
      preview: getPreview(assistantText),
      reasoningSummary,
    },
    'Assistant response preview'
  );
};

const handleLangSmithUpdates = async (
  response: ResponseWithUsage,
  langsmithRunId: string | null | undefined,
  reasoningEffort: string,
  enableSearch: boolean
): Promise<void> => {
  if (!isLangSmithEnabled()) return;

  // ResponseWithUsage doesn't have metadata or headers, so just use the provided langsmithRunId
  if (!langsmithRunId) return;

  try {
    await updateRun({
      runId: langsmithRunId,
      outputs: {
        messages: response.messages,
        usage: response.usage,
      },
    });

    const usage = response.usage;
    if (usage) {
      await logMetrics({
        runId: langsmithRunId,
        metrics: {
          totalTokens: usage.totalTokens,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          reasoningEffort,
          enableSearch,
        },
      });
    }
  } catch (error) {
    logger.error(
      { at: 'api.chat.langSmithUpdate', error, runId: langsmithRunId },
      'Failed to update LangSmith run'
    );
  }
};

const inferProviderFromModel = (modelId: string): Provider => {
  const id = modelId.toLowerCase();
  if (id.includes('claude')) return 'anthropic' as Provider;
  if (id.includes('gpt')) return 'openai' as Provider;
  // Default fallback keeps prior behavior
  return 'openai' as Provider;
};

/**
 * A single shared stream pipeline. Both public methods delegate to this.
 */
const stream = ({
  model,
  systemPrompt,
  messages,
  tools,
  phase,
  isGPT5Model,
  chatId,
  userId,
  resolvedModel,
  reasoningEffort,
  enableSearch,
  supabase,
  message_group_id,
  langsmithRunId,
}: StreamArgs): Response => {
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    tools, // undefined for fallback path is OK; don't send `{}` needlessly
    temperature: isGPT5Model ? 1 : undefined,
    onError: () => {
      logger.warn(
        { at: 'api.chat.streamText', phase, event: 'error' },
        'Stream encountered an error'
      );
    },
    onFinish: async ({ response }) => {
      // 1) Tools log
      logToolInvocations(
        {
          response,
          messages: response.messages,
          usage: (response as any).usage,
        } as ResponseWithUsage,
        phase
      );

      // 2) Reasoning & assistant preview
      try {
        const assistantText = extractAssistantText({
          response,
          messages: response.messages,
          usage: (response as any).usage,
        } as ResponseWithUsage);
        const reasoningContext = handleReasoningExtraction(
          assistantText,
          isGPT5Model,
          resolvedModel,
          chatId,
          userId,
          reasoningEffort,
          {
            response,
            messages: response.messages,
            usage: (response as any).usage,
          } as ResponseWithUsage
        );
        logAssistantResponse(
          assistantText,
          chatId,
          userId,
          resolvedModel,
          reasoningContext?.summary
        );
      } catch {
        // swallow logging errors to avoid impacting user flow
      }

      // 3) Persist assistant message (if storage provided)
      // ResponseWithUsage doesn't have metadata/headers for extractRunId, use langsmithRunId directly
      const actualRunId = langsmithRunId || null;

      if (supabase) {
        await storeAssistantMessage({
          supabase,
          chatId,
          messages: response.messages as unknown as any[], // retained external shape
          userId,
          message_group_id,
          model: resolvedModel,
          langsmithRunId: actualRunId,
          reasoningEffort: reasoningEffort as any,
        });
      }

      // 4) Metrics
      const usage = (response as any).usage;
      const responseTime = usage?.totalTokens
        ? usage.totalTokens * 10
        : undefined;

      trackCredentialUsage(
        'environment',
        inferProviderFromModel(resolvedModel),
        resolvedModel,
        { userId, success: true, responseTime }
      );

      await handleLangSmithUpdates(
        {
          response,
          messages: response.messages,
          usage: (response as any).usage,
        } as ResponseWithUsage,
        actualRunId,
        reasoningEffort,
        enableSearch
      );
    },
  });

  return result.toUIMessageStreamResponse();
};

/**
 * Public API (kept for compatibility). Both methods delegate to `stream()`.
 */
export class StreamingService {
  /**
   * Original: "fallback retrieval" used to pass `{}` tools.
   * Now it simply omits tools to avoid needless payload noise.
   */
  static async createStreamingResponseWithFallback(
    model: LanguageModel,
    systemPrompt: string,
    messages: ModelMessage[],
    _apiKey: string | undefined, // unused, kept for API compatibility
    _modelSettings: unknown,
    _modelConfig: unknown,
    chatId: string,
    userId: string,
    resolvedModel: string,
    isGPT5Model: boolean,
    reasoningEffort: string,
    enableSearch: boolean,
    supabase: SupabaseClientType | null,
    messageGroupId: string | undefined,
    langsmithRunId: string | null
  ): Promise<Response> {
    return stream({
      model,
      systemPrompt,
      messages,
      tools: undefined,
      phase: 'fallback',
      isGPT5Model,
      chatId,
      userId,
      resolvedModel,
      reasoningEffort,
      enableSearch,
      supabase,
      message_group_id: messageGroupId,
      langsmithRunId,
    });
  }

  /**
   * Original: "regular" streaming with real tools.
   */
  static async createStreamingResponse(
    model: LanguageModel,
    systemPrompt: string,
    messages: ModelMessage[],
    tools: Record<string, unknown> | undefined,
    isGPT5Model: boolean,
    chatId: string,
    userId: string,
    resolvedModel: string,
    reasoningEffort: string,
    enableSearch: boolean,
    supabase: SupabaseClientType | null,
    messageGroupId: string | undefined,
    langsmithRunId: string | null
  ): Promise<Response> {
    return stream({
      model,
      systemPrompt,
      messages,
      tools,
      phase: 'main',
      isGPT5Model,
      chatId,
      userId,
      resolvedModel,
      reasoningEffort,
      enableSearch,
      supabase,
      message_group_id: messageGroupId,
      langsmithRunId,
    });
  }
}
