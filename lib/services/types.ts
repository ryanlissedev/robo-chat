import type { Attachment } from '@ai-sdk/ui-utils';
import type {
  LanguageModel,
  LanguageModelUsage,
  ModelMessage,
  ToolSet,
  UIDataTypes,
  UIMessagePart,
  UITools,
} from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { getMessageContent } from '@/app/types/ai-extended';
import type { SupabaseClientType } from '@/app/types/api.types';
import {
  FILE_SEARCH_SYSTEM_PROMPT,
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
  SYSTEM_PROMPT_DEFAULT,
} from '@/lib/config';
import {
  createRun,
  extractRunId,
  isLangSmithEnabled,
  logMetrics,
  updateRun,
} from '@/lib/langsmith/client';
import {
  extractReasoningFromResponse,
  type ReasoningContext,
} from '@/lib/middleware/extract-reasoning-middleware';
import { getAllModels } from '@/lib/models';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';
import {
  selectRetrievalMode,
  shouldEnableFileSearchTools,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';
import { fileSearchTool } from '@/lib/tools/file-search';
import type { ProviderWithoutOllama } from '@/lib/user-keys';
import logger from '@/lib/utils/logger';
import {
  type CredentialSource,
  type Provider,
  trackCredentialError,
  trackCredentialUsage,
} from '@/lib/utils/metrics';
import {
  redactSensitiveHeaders,
  sanitizeLogEntry,
} from '@/lib/utils/redaction';
// Export types that are imported by other modules
export type { ExtendedUIMessage } from '@/app/types/ai-extended';
export type { SupabaseClientType } from '@/app/types/api.types';

export const maxDuration = 60;
// Lint constants
const ID_RADIX = 36;
const PREVIEW_SNIPPET_LENGTH = 100;

export type ChatRequest = {
  messages: ExtendedUIMessage[];
  chatId: string;
  userId: string;
  model: string;
  isAuthenticated: boolean;
  systemPrompt: string;
  enableSearch: boolean;
  message_group_id?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  context?: 'chat' | 'voice';
  personalityMode?:
    | 'safety-focused'
    | 'technical-expert'
    | 'friendly-assistant';
};

export type TransformedMessage = {
  role: 'user' | 'assistant' | 'system';
  parts: UIMessagePart<UIDataTypes, UITools>[];
  id?: string;
};

export type ResponseWithUsage = {
  usage?: LanguageModelUsage;
  messages: unknown[];
};

export type ModelConfiguration = {
  modelConfig: any;
  isGPT5Model: boolean;
  isReasoningCapable: boolean;
  modelSupportsFileSearchTools: boolean;
};

export type GuestCredentials = {
  provider?: string;
  apiKey?: string;
  source?: string;
};

export type CredentialResult = {
  apiKey?: string;
  source: CredentialSource;
  error?: string;
};
