import * as ai from 'ai';
import { Client } from 'langsmith';
import {
  createLangSmithProviderOptions,
  wrapAISDK,
} from 'langsmith/experimental/vercel';
import {
  langsmithClient as existingClient,
  isLangSmithEnabled,
} from '@/lib/langsmith/client';

// Create or reuse a LangSmith client when tracing is enabled
export const lsClient: Client | undefined = isLangSmithEnabled()
  ? (existingClient ?? new Client())
  : undefined;

// Wrap AI SDK methods for automatic LangSmith tracing
const wrapped = lsClient ? wrapAISDK(ai, { client: lsClient }) : wrapAISDK(ai);

export const { generateText, streamText, generateObject, streamObject } =
  wrapped;
export { createLangSmithProviderOptions };

// Helper to build standard LangSmith provider options metadata for chat flows
export function buildChatLangSmithOptions(meta: {
  name?: string;
  chatId?: string;
  userId?: string;
  model?: string;
  phase?: 'main' | 'fallback';
  enableSearch?: boolean;
  reasoningEffort?: string;
}): ReturnType<typeof createLangSmithProviderOptions> | undefined {
  if (!lsClient || !isLangSmithEnabled()) return undefined;
  return createLangSmithProviderOptions({
    name: meta.name ?? 'chat-run',
    metadata: {
      chatId: meta.chatId,
      userId: meta.userId,
      model: meta.model,
      phase: meta.phase,
      enableSearch: meta.enableSearch,
      reasoningEffort: meta.reasoningEffort,
    },
  });
}
