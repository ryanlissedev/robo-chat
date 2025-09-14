import type { LanguageModel } from 'ai';
import {
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
} from '@/lib/config';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';
import {
  selectRetrievalMode,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';
import logger from '@/lib/utils/logger';
import { StreamingService } from './StreamingService';
import type { ExtendedUIMessage, SupabaseClientType } from './types';

/** Shape for retrieved context chunks used to augment the system prompt. */
type RetrievedChunk = {
  fileId: string;
  fileName: string;
  score: number;
  content: string;
  url?: string;
};

/** Narrow type for model settings; pass-through from model configuration. */
type ModelSettings = Record<string, unknown>;

export class RetrievalService {
  /**
   * Determines if fallback retrieval should be used based on search settings and model capabilities.
   */
  static shouldUseFallbackRetrieval(
    enableSearch: boolean,
    modelSupportsFileSearchTools: boolean
  ): boolean {
    return shouldUseFallbackRetrieval(
      enableSearch,
      modelSupportsFileSearchTools
    );
  }

  /**
   * Handles fallback retrieval path when file-search tools are not enabled/supported.
   * Builds an augmented system prompt with retrieved chunks and streams with a fallback method.
   */
  static async handleFallbackRetrieval({
    compatibleMessages,
    languageModel,
    effectiveSystemPrompt,
    apiKey,
    modelSettings,
    modelConfig,
    chatId,
    userId,
    resolvedModel,
    isGPT5Model,
    reasoningEffort,
    enableSearch,
    supabase,
    messageGroupId,
    langsmithRunId,
    messages,
    precomputedModelMessages,
  }: {
    compatibleMessages: ExtendedUIMessage[];
    languageModel: LanguageModel;
    effectiveSystemPrompt: string;
    apiKey: string | undefined;
    modelSettings: ModelSettings;
    modelConfig: unknown;
    chatId: string;
    userId: string;
    resolvedModel: string;
    isGPT5Model: boolean;
    reasoningEffort: string;
    enableSearch: boolean;
    supabase: SupabaseClientType | null;
    messageGroupId: string | undefined;
    langsmithRunId: string | null;
    messages: ExtendedUIMessage[];
    precomputedModelMessages: ReturnType<
      typeof import('ai').convertToModelMessages
    >;
  }): Promise<Response> {
    const userQuery = RetrievalService.getLastUserText(messages);

    let retrieved: RetrievedChunk[];

    // Choose retrieval mode, with two-pass preferred when flagged.
    try {
      const mode = selectRetrievalMode(RETRIEVAL_TWO_PASS_ENABLED);
      retrieved =
        mode === 'two-pass'
          ? await retrieveWithGpt41(userQuery, messages, {
              topK: RETRIEVAL_TOP_K,
            })
          : await performVectorRetrieval(userQuery, { topK: RETRIEVAL_TOP_K });
    } catch (e) {
      // On failure, fall back to vector retrieval.
      logger.warn(
        { at: 'fallbackRetrieval', error: e },
        'two-pass retrieval failed; falling back to vector retrieval'
      );
      retrieved = await performVectorRetrieval(userQuery, {
        topK: RETRIEVAL_TOP_K,
      });
    }

    // Build augmented system prompt with token budget.
    const augmentedSystem = buildAugmentedSystemPrompt(
      effectiveSystemPrompt,
      retrieved,
      { budgetTokens: RETRIEVAL_MAX_TOKENS }
    );

    // Stream using the service variant that is aware of the augmented system.
    return await StreamingService.createStreamingResponseWithFallback(
      languageModel,
      augmentedSystem,
      precomputedModelMessages,
      apiKey,
      modelSettings,
      modelConfig,
      chatId,
      userId,
      resolvedModel,
      isGPT5Model,
      reasoningEffort,
      enableSearch,
      supabase,
      messageGroupId,
      langsmithRunId
    );
  }

  /**
   * Performs vector retrieval for the given user query.
   */
  static async performVectorRetrieval(
    userQuery: string,
    options: { topK?: number } = {}
  ): Promise<RetrievedChunk[]> {
    const { topK = RETRIEVAL_TOP_K } = options;
    return await performVectorRetrieval(userQuery, { topK });
  }

  /**
   * Performs two-pass retrieval using GPT-4.1 for query enhancement.
   */
  static async performTwoPassRetrieval(
    userQuery: string,
    messages: ExtendedUIMessage[],
    options: { topK?: number } = {}
  ): Promise<RetrievedChunk[]> {
    const { topK = RETRIEVAL_TOP_K } = options;
    return await retrieveWithGpt41(userQuery, messages, { topK });
  }

  /**
   * Builds an augmented system prompt with retrieved context chunks.
   */
  static buildAugmentedSystemPrompt(
    baseSystemPrompt: string,
    retrievedChunks: RetrievedChunk[],
    options: { budgetTokens?: number } = {}
  ): string {
    const { budgetTokens = RETRIEVAL_MAX_TOKENS } = options;
    return buildAugmentedSystemPrompt(baseSystemPrompt, retrievedChunks, {
      budgetTokens,
    });
  }

  /**
   * Selects the appropriate retrieval mode based on configuration.
   */
  static selectRetrievalMode(
    twoPassEnabled: boolean = RETRIEVAL_TWO_PASS_ENABLED
  ): 'vector' | 'two-pass' {
    return selectRetrievalMode(twoPassEnabled);
  }

  /**
   * Extracts the last user text from messages for retrieval queries.
   */
  private static getLastUserText(messages: ExtendedUIMessage[]): string {
    const last = messages.at(-1);
    if (!last || last.role !== 'user') return '';

    // Handle different message content types
    if (typeof last.content === 'string') {
      return last.content;
    }

    if (Array.isArray(last.content)) {
      // Extract text from content array (for multi-modal messages)
      const textParts = (last.content as any[]).filter(
        (part: any) => part.type === 'text'
      );
      return textParts.map((part: any) => part.text).join(' ');
    }

    return '';
  }

  /**
   * Logs retrieval operations for debugging and monitoring.
   */
  static logRetrievalOperation(
    operation: string,
    userQuery: string,
    retrievedCount: number,
    mode: 'vector' | 'two-pass'
  ) {
    try {
      logger.info(
        {
          at: 'retrieval.operation',
          operation,
          queryLength: userQuery.length,
          retrievedCount,
          mode,
        },
        'retrieval operation completed'
      );
    } catch {
      // Never throw from logging.
    }
  }
}
