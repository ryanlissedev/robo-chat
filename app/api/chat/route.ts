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
import { getGatewayConfig } from '@/lib/openproviders/env';
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from './api';
import { createErrorResponse } from './utils';

export const maxDuration = 60;
// Lint constants
const ID_RADIX = 36;
const PREVIEW_SNIPPET_LENGTH = 100;

// Helper to safely obtain apiSdk without non-null assertion
function requireApiSdk(modelConfig: unknown) {
  const apiSdk = (modelConfig as { apiSdk?: unknown })?.apiSdk;
  if (typeof apiSdk !== 'function') {
    throw new Error('Model is missing apiSdk configuration');
  }
  return apiSdk as (
    key: string | undefined,
    settings: unknown
  ) => LanguageModel;
}

// Helper to infer provider from model id for metrics
function inferProviderFromModel(modelId: string): Provider {
  if (modelId.includes('gpt')) return 'openai' as Provider;
  if (modelId.includes('claude')) return 'anthropic' as Provider;
  return getProviderForModel(modelId) as Provider;
}

type ResponseWithUsage = {
  usage?: LanguageModelUsage;
  messages: unknown[];
};

// UI Message types for content handling
type UIMessageContent = {
  content?: string;
  attachments?: unknown[];
  text?: string;
};

type MessagePart = UIMessagePart<UIDataTypes, UITools>;

type TransformedMessage = {
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  id?: string;
};

type ChatRequest = {
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
  context?: 'chat' | 'voice'; // Add context to differentiate chat vs voice
  personalityMode?:
    | 'safety-focused'
    | 'technical-expert'
    | 'friendly-assistant'; // For voice contexts
};

// Helper functions for message transformation
function createTextPart(text: string): MessagePart {
  return { type: 'text', text };
}

function handleStringContent(content: string): MessagePart[] {
  return [createTextPart(content)];
}

function handleArrayContent(content: unknown[]): MessagePart[] {
  return content.map((part) => {
    if (typeof part === 'string') {
      return createTextPart(part);
    }
    if (part && typeof part === 'object') {
      return part as MessagePart;
    }
    return createTextPart(String(part || ''));
  });
}

function handleObjectContent(content: UIMessageContent): MessagePart[] {
  const textContent = content.text || content.content || '';
  return [createTextPart(String(textContent))];
}

function createFallbackContent(msg: unknown, role?: string): MessagePart[] {
  const messageContent = msg as { content?: unknown };
  const fallbackText = String(
    messageContent.content ||
      (role === 'assistant' ? '[Assistant response]' : '[User message]')
  );
  return [createTextPart(fallbackText)];
}

// Utility to create a safe preview for logs
function getPreview(text: string | undefined | null, max = 500): string {
  if (!text) {
    return '';
  }
  const trimmed = String(text).trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function transformMessageToV5Format(msg: unknown): TransformedMessage {
  // Ensure msg has proper structure
  if (!msg || typeof msg !== 'object') {
    return {
      role: 'user',
      parts: [createTextPart(String(msg || '[Invalid message]'))],
    };
  }

  const message = msg as {
    role?: string;
    content?: unknown;
    parts?: MessagePart[];
    id?: string;
  };

  // If message already has parts array, use it as-is
  if (message.parts && Array.isArray(message.parts)) {
    return message as TransformedMessage;
  }

  // Convert content to parts array format for v5
  let parts: MessagePart[] = [];

  if (typeof message.content === 'string') {
    parts = handleStringContent(message.content);
  } else if (Array.isArray(message.content)) {
    parts = handleArrayContent(message.content);
  } else if (typeof message.content === 'object' && message.content !== null) {
    parts = handleObjectContent(message.content as UIMessageContent);
  } else {
    parts = createFallbackContent(message, message.role);
  }

  // Return message in v5 format with parts array
  return {
    role: (message.role || 'user') as 'system' | 'user' | 'assistant',
    parts,
    ...(message.id && { id: message.id }),
  };
}

// Validation helpers
function validateChatRequest(request: ChatRequest): string | null {
  const { messages, chatId, userId } = request;

  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Error, missing or invalid messages';
  }

  if (!(chatId && userId)) {
    return 'Error, missing chatId or userId';
  }

  return null;
}

function resolveModelId(model: string): string {
  return model === 'gpt-4o-mini' ? 'gpt-5-mini' : model;
}

// System prompt configuration
async function getEffectiveSystemPrompt(
  systemPrompt: string,
  enableSearch: boolean,
  modelSupportsFileSearchTools: boolean,
  options?: {
    context?: 'chat' | 'voice';
    personalityMode?:
      | 'safety-focused'
      | 'technical-expert'
      | 'friendly-assistant';
  }
): Promise<string> {
  const context = options?.context;
  const personalityMode = options?.personalityMode;
  // For voice context with personality mode, use personality-specific prompts
  if (context === 'voice' && personalityMode) {
    // Import personality configs dynamically to get voice-specific prompts
    const { PERSONALITY_CONFIGS } = await import(
      '@/components/app/voice/config/personality-configs'
    );
    if (PERSONALITY_CONFIGS[personalityMode]) {
      return PERSONALITY_CONFIGS[personalityMode].instructions.systemPrompt;
    }
  }

  // For chat context or when no personality mode, use standard prompt selection
  const useSearchPrompt = shouldEnableFileSearchTools(
    enableSearch,
    modelSupportsFileSearchTools
  );

  return useSearchPrompt
    ? FILE_SEARCH_SYSTEM_PROMPT
    : systemPrompt || SYSTEM_PROMPT_DEFAULT;
}

// Model configuration
function configureModelSettings(
  reasoningEffort: string,
  verbosity?: string,
  isReasoningCapable?: boolean
) {
  return {
    // Vector-store only: do not enable provider-level web search.
    // We still enable the fileSearch tool separately via configureTools().
    enableSearch: false,
    reasoningEffort,
    verbosity,
    headers: isReasoningCapable
      ? {
          'X-Reasoning-Effort': reasoningEffort,
          ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
        }
      : undefined,
  };
}

// Tools configuration
function configureTools(
  enableSearch: boolean,
  modelSupportsFileSearchTools: boolean
): ToolSet {
  const useTools = shouldEnableFileSearchTools(
    enableSearch,
    modelSupportsFileSearchTools
  );

  if (useTools) {
    logger.info(
      {
        at: 'api.chat.configureTools',
        enableSearch,
        fileSearchToolsCapable: modelSupportsFileSearchTools,
        toolsEnabled: true,
        toolNames: ['fileSearch'],
      },
      'Configuring file search tool'
    );
  }

  return useTools ? { fileSearch: fileSearchTool } : ({} as ToolSet);
}

// User message logging
async function handleUserMessageLogging({
  supabase,
  userId,
  chatId,
  messages,
  message_group_id,
}: {
  supabase: SupabaseClientType | null;
  userId: string;
  chatId: string;
  messages: ExtendedUIMessage[];
  message_group_id?: string;
}) {
  if (!supabase) {
    return;
  }

  // Increment message count for successful validation
  await incrementMessageCount({ supabase, userId });

  const userMessage = messages.at(-1);
  if (userMessage?.role === 'user') {
    const textContent = getMessageContent(userMessage);
    const attachments = userMessage.experimental_attachments || [];

    await logUserMessage({
      supabase,
      userId,
      chatId,
      content: textContent,
      attachments: attachments as Attachment[],
      message_group_id,
    });
  }
}

// Model configuration
async function getModelConfiguration(
  resolvedModel: string,
  originalModel: string
) {
  const allModels = await getAllModels();
  const modelConfig = allModels.find((m) => m.id === resolvedModel);

  if (!modelConfig?.apiSdk) {
    throw new Error(`Model ${originalModel} not found`);
  }

  const isGPT5Model = resolvedModel.startsWith('gpt-5');
  const isReasoningCapable = Boolean(modelConfig?.reasoningText);
  const modelSupportsFileSearchTools = Boolean(
    (modelConfig as { fileSearchTools?: boolean })?.fileSearchTools
  );
  return {
    modelConfig,
    isGPT5Model,
    isReasoningCapable,
    modelSupportsFileSearchTools,
  };
}

// Request logging
function logRequestContext(options: {
  resolvedModel: string;
  enableSearch: boolean;
  reasoningEffort: string;
  verbosity?: string;
  isGPT5Model?: boolean;
  modelSupportsFileSearchTools?: boolean;
}) {
  try {
    const {
      resolvedModel,
      enableSearch,
      reasoningEffort,
      verbosity,
      isGPT5Model,
      modelSupportsFileSearchTools,
    } = options;
    const provider = getProviderForModel(resolvedModel);
    logger.info(
      {
        at: 'api.chat.POST',
        model: resolvedModel,
        provider,
        enableSearch,
        reasoningEffort,
        verbosity,
        temperature: isGPT5Model ? 1 : undefined,
        fileSearchToolsCapable: modelSupportsFileSearchTools,
      },
      'chat request'
    );
  } catch {
    // Silently handle error in logging operation
  }
}

// Types for credential resolution
type GuestCredentials = {
  provider?: string;
  apiKey?: string;
  source?: string;
};

type CredentialResult = {
  apiKey?: string;
  source: CredentialSource;
  error?: string;
};

/**
 * Extract guest credentials from request headers
 * SECURITY: Never log the actual API key value
 */
function extractGuestCredentials(headers: Headers): GuestCredentials {
  try {
    const provider =
      headers.get('x-model-provider') || headers.get('X-Model-Provider');
    const apiKey =
      headers.get('x-provider-api-key') || headers.get('X-Provider-Api-Key');
    const source =
      headers.get('x-credential-source') || headers.get('X-Credential-Source');

    return {
      provider: provider?.toLowerCase() || undefined,
      apiKey: apiKey || undefined,
      source: source || undefined,
    };
  } catch {
    return {};
  }
}

// Note: redactSensitiveHeaders is now imported from @/lib/utils/redaction

/**
 * Resolve credentials with precedence logic
 * 1. Vercel AI Gateway (if configured) — default path
 * 2. Authenticated user BYOK
 * 3. Guest header override (if no user key)
 * 4. Environment variable fallback (handled downstream)
 *
 * SECURITY: Never log actual API key values
 */
async function resolveCredentials(
  user: { isAuthenticated: boolean; userId: string } | null,
  model: string,
  headers: Headers
): Promise<CredentialResult> {
  const provider = getProviderForModel(model);

  // Log request context without sensitive data
  const logContext = sanitizeLogEntry({
    at: 'api.chat.resolveCredentials',
    provider,
    model,
    isAuthenticated: Boolean(user?.isAuthenticated),
    hasUserId: Boolean(user?.userId),
    headers: redactSensitiveHeaders(headers),
  });
  logger.info(logContext, 'Resolving credentials');

  // 1. Gateway first (default)
  try {
    const gateway = getGatewayConfig();
    if (gateway.enabled) {
      logger.info(
        sanitizeLogEntry({
          at: 'api.chat.resolveCredentials',
          source: 'gateway',
          provider,
          model,
        }),
        'Using Vercel AI Gateway credentials'
      );
      // Track gateway usage (success recorded on finish)
      trackCredentialUsage('gateway', provider as Provider, model, {
        success: true,
      });
      return { source: 'gateway' };
    }
  } catch {
    // silently ignore gateway config errors
  }

  // 2. Authenticated user BYOK
  if (user?.isAuthenticated && user.userId) {
    try {
      const { getEffectiveApiKey } = await import('@/lib/user-keys');
      const userKey = await getEffectiveApiKey(
        user.userId,
        provider as ProviderWithoutOllama
      );

      if (userKey) {
        logger.info(
          sanitizeLogEntry({
            at: 'api.chat.resolveCredentials',
            source: 'user-byok',
            provider,
            hasKey: true,
          }),
          'Using user BYOK credentials'
        );

        // Track successful credential usage
        trackCredentialUsage('user-byok', provider as Provider, model, {
          userId: user.userId,
          success: true,
        });

        return {
          apiKey: userKey,
          source: 'user-byok',
        };
      }
    } catch (error) {
      logger.info(
        sanitizeLogEntry({
          at: 'api.chat.resolveCredentials',
          error: error instanceof Error ? error.message : String(error),
          provider,
        }),
        'Failed to retrieve user BYOK credentials'
      );

      // Track credential error
      trackCredentialError(error, provider as Provider, {
        source: 'user-byok',
        userId: user.userId,
        model,
      });
    }
  }

  // 3. Guest header override (if no user key)
  const guestCredentials = extractGuestCredentials(headers);
  if (guestCredentials.apiKey && guestCredentials.provider === provider) {
    logger.info(
      sanitizeLogEntry({
        at: 'api.chat.resolveCredentials',
        source: 'guest-header',
        provider,
        hasKey: true,
        credentialSource: guestCredentials.source,
      }),
      'Using guest header credentials'
    );

    // Track successful guest credential usage
    trackCredentialUsage('guest-header', provider as Provider, model, {
      success: true,
    });

    return {
      apiKey: guestCredentials.apiKey,
      source: 'guest-header',
    };
  }

  // 4. No credentials found - will fallback to environment downstream
  logger.info(
    sanitizeLogEntry({
      at: 'api.chat.resolveCredentials',
      source: 'environment',
      provider,
      hasKey: false,
    }),
    'No user or guest credentials found, falling back to environment'
  );

  // Track environment fallback usage
  trackCredentialUsage('environment', provider as Provider, model, {
    success: true, // Assuming environment credentials work - actual success tracked in onFinish
  });

  return {
    source: 'environment',
  };
}

// Legacy function for backward compatibility - now uses new credential resolution
async function getApiKey(
  req: Request,
  isAuthenticated: boolean,
  userId: string,
  resolvedModel: string
): Promise<string | undefined> {
  const result = await resolveCredentials(
    { isAuthenticated, userId },
    resolvedModel,
    req.headers
  );

  return result.apiKey;
}

// LangSmith run creation
async function createLangSmithRun({
  resolvedModel,
  messages,
  reasoningEffort,
  enableSearch,
  userId,
  chatId,
}: {
  resolvedModel: string;
  messages: ExtendedUIMessage[];
  reasoningEffort: string;
  enableSearch: boolean;
  userId: string;
  chatId: string;
}): Promise<string | null> {
  if (!isLangSmithEnabled()) {
    return null;
  }

  try {
    const run = (await createRun({
      name: 'chat-completion',
      inputs: {
        model: resolvedModel,
        messages: messages.map((m: ExtendedUIMessage) => ({
          role: m.role,
          content: getMessageContent(m),
        })),
        reasoningEffort,
        enableSearch,
      },
      runType: 'chain',
      metadata: {
        userId,
        chatId,
        model: resolvedModel,
        reasoningEffort,
        enableSearch,
      },
    })) as { id?: string } | null;

    return run?.id || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Debug LangSmith configuration
  console.log('[LangSmith Config]:', {
    enabled: isLangSmithEnabled(),
    apiKey: !!process.env.LANGSMITH_API_KEY,
    project: process.env.LANGSMITH_PROJECT,
    endpoint: process.env.LANGSMITH_ENDPOINT,
    tracing: process.env.LANGSMITH_TRACING,
    tracingV2: process.env.LANGSMITH_TRACING_V2,
  });

  let requestData: ChatRequest | null = null;
  try {
    requestData = (await req.json()) as ChatRequest;
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      reasoningEffort = 'medium',
      verbosity = 'medium',
      context = 'chat', // Default to chat context
      personalityMode,
    } = requestData;

    // Validate request
    const validationError = validateChatRequest(requestData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }

    const resolvedModel = resolveModelId(model);

    // Check if guest has provided BYOK credentials
    const guestApiKey =
      req.headers.get('x-provider-api-key') ||
      req.headers.get('X-Provider-Api-Key');
    const hasGuestCredentials = !isAuthenticated && Boolean(guestApiKey);

    const supabase = await validateAndTrackUsage({
      userId,
      model: resolvedModel,
      isAuthenticated,
      hasGuestCredentials,
    });

    // Handle user message logging
    await handleUserMessageLogging({
      supabase,
      userId,
      chatId,
      messages,
      message_group_id,
    });

    // Get and validate model configuration
    const {
      modelConfig,
      isGPT5Model,
      isReasoningCapable,
      modelSupportsFileSearchTools,
    } = await getModelConfiguration(resolvedModel, model);

    // Set GPT-5 defaults: low verbosity, low reasoning
    let effectiveReasoningEffort = reasoningEffort;
    let effectiveVerbosity = verbosity;

    if (isGPT5Model) {
      // Default to low reasoning effort for GPT-5 models
      effectiveReasoningEffort =
        reasoningEffort === 'medium' ? 'low' : reasoningEffort;
      // Default to low verbosity for GPT-5 models
      effectiveVerbosity = verbosity === 'medium' ? 'low' : verbosity;
    }

    // Log request context
    logRequestContext({
      resolvedModel,
      enableSearch,
      reasoningEffort: effectiveReasoningEffort,
      verbosity: effectiveVerbosity,
      isGPT5Model,
      modelSupportsFileSearchTools,
    });

    // Log user query preview
    try {
      const lastUserMessage = messages.at(-1);
      const userText = lastUserMessage
        ? getMessageContent(lastUserMessage)
        : '';
      logger.info(
        {
          at: 'api.chat.userQuery',
          chatId,
          userId,
          model: resolvedModel,
          preview: getPreview(userText),
        },
        'User query preview'
      );
    } catch {
      // ignore logging errors
    }

    // Get effective system prompt and API key
    const effectiveSystemPrompt = await getEffectiveSystemPrompt(
      systemPrompt,
      enableSearch,
      modelSupportsFileSearchTools,
      { context, personalityMode }
    );
    const credentialResolution = await resolveCredentials(
      { isAuthenticated, userId },
      resolvedModel,
      req.headers
    );
    const apiKey = credentialResolution.apiKey;

    // Create LangSmith run if enabled
    const langsmithRunId = await createLangSmithRun({
      resolvedModel,
      messages,
      reasoningEffort: effectiveReasoningEffort,
      enableSearch,
      userId,
      chatId,
    });

    // Configure tools and model settings
    const tools = configureTools(enableSearch, modelSupportsFileSearchTools);
    const modelSettings = configureModelSettings(
      effectiveReasoningEffort,
      effectiveVerbosity,
      isReasoningCapable
    );

    // Convert UIMessages to ModelMessages for v5
    const messagesArray = Array.isArray(messages) ? messages : [];
    const transformedMessages = messagesArray.map(transformMessageToV5Format);

    // Add null check for transformedMessages
    if (!(transformedMessages && Array.isArray(transformedMessages))) {
      return new Response(
        JSON.stringify({ error: 'Failed to transform messages' }),
        { status: 500 }
      );
    }

    // Ensure all messages have valid parts before conversion
    const validatedMessages = transformedMessages.filter(
      (msg: TransformedMessage) =>
        msg?.role &&
        msg.parts &&
        Array.isArray(msg.parts) &&
        msg.parts.length > 0
    );

    if (validatedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid messages to process' }),
        { status: 400 }
      );
    }

    // Convert TransformedMessage[] to ExtendedUIMessage[] for convertToModelMessages
    const uiMessages: ExtendedUIMessage[] = validatedMessages.map(
      (msg: TransformedMessage) => ({
        id: msg.id || Math.random().toString(ID_RADIX),
        role: msg.role,
        parts: msg.parts as UIMessagePart<UIDataTypes, UITools>[], // Type assertion needed due to MessagePart vs custom part types
        createdAt: new Date(),
        content: (() => {
          const textPart = msg.parts.find(
            (p) => (p as Record<string, unknown>).type === 'text'
          );
          return textPart
            ? String((textPart as Record<string, unknown>).text) || ''
            : '';
        })(), // v4 compatibility
      })
    );

    let modelMessages: ModelMessage[];
    try {
      // Remove undefined parts before conversion and ensure compatibility
      const compatibleMessages = uiMessages.map((msg) => ({
        ...msg,
        parts: msg.parts?.filter(Boolean) || [],
      }));
      // If enableSearch is true but tools are disabled for this model, inject server-retrieved context
      if (
        shouldUseFallbackRetrieval(enableSearch, modelSupportsFileSearchTools)
      ) {
        const lastUserMessage = messages.at(-1);
        const userQuery = lastUserMessage
          ? getMessageContent(lastUserMessage)
          : '';
        let retrieved = [] as {
          fileId: string;
          fileName: string;
          score: number;
          content: string;
          url?: string;
        }[];
        try {
          const mode = selectRetrievalMode(RETRIEVAL_TWO_PASS_ENABLED);
          retrieved =
            mode === 'two-pass'
              ? await retrieveWithGpt41(userQuery, messages, {
                  topK: RETRIEVAL_TOP_K,
                })
              : await performVectorRetrieval(userQuery, {
                  topK: RETRIEVAL_TOP_K,
                });
        } catch {
          retrieved = await performVectorRetrieval(userQuery, {
            topK: RETRIEVAL_TOP_K,
          });
        }

        const augmentedSystem = buildAugmentedSystemPrompt(
          effectiveSystemPrompt,
          retrieved,
          { budgetTokens: RETRIEVAL_MAX_TOKENS }
        );
        // Update effectiveSystemPrompt for injection path
        // Note: we cannot reassign const; redefine for local use
        const systemForInjection = augmentedSystem;

        modelMessages = convertToModelMessages(
          compatibleMessages as ExtendedUIMessage[]
        );

        const result = streamText({
          model: requireApiSdk(modelConfig)(
            apiKey,
            modelSettings
          ) as LanguageModel,
          system: systemForInjection,
          messages: modelMessages,
          tools: {},
          temperature: isGPT5Model ? 1 : undefined,
          onError: () => {
            logger.warn(
              { at: 'api.chat.streamText', phase: 'injection', event: 'error' },
              'Stream encountered an error'
            );
          },
          onFinish: async ({ response }) => {
            // Same onFinish as below for logging and storage
            if (response.messages && response.messages.length > 0) {
              const lastMessage = response.messages.at(-1);
              if (
                lastMessage &&
                typeof lastMessage === 'object' &&
                'toolInvocations' in lastMessage
              ) {
                const messageWithTools = lastMessage as {
                  toolInvocations?: Record<string, unknown>[];
                };
                const toolInvocations = messageWithTools.toolInvocations;
                if (toolInvocations && Array.isArray(toolInvocations)) {
                  for (const invocation of toolInvocations) {
                    logger.info(
                      { at: 'api.chat.toolInvocation', invocation },
                      'Tool invocation result'
                    );
                  }
                }
              }
            }

            try {
              let assistantText = '';
              const msgs = (response.messages || []) as unknown[];
              const last = msgs.at(-1) as
                | {
                    role?: string;
                    content?: unknown;
                    parts?: { type?: string; text?: string }[];
                  }
                | undefined;

              if (last && last.role === 'assistant') {
                if (typeof last.content === 'string') {
                  assistantText = last.content;
                } else if (Array.isArray(last.content)) {
                  assistantText = (
                    last.content as { type?: string; text?: string }[]
                  )
                    .map((p) =>
                      p && typeof p === 'object' && 'text' in p
                        ? (p as { text?: string }).text || ''
                        : ''
                    )
                    .join('');
                } else if (Array.isArray(last.parts)) {
                  assistantText = last.parts
                    .map((p) =>
                      p && typeof p === 'object' && p.type === 'text'
                        ? p.text || ''
                        : ''
                    )
                    .join('');
                }
              }

              // Extract reasoning traces for GPT-5 models
              let reasoningContext: ReasoningContext | null = null;
              if (isGPT5Model && assistantText) {
                const usage = (response as ResponseWithUsage).usage;
                reasoningContext = extractReasoningFromResponse(
                  assistantText,
                  undefined, // processingTime
                  usage?.totalTokens
                );

                // Enhanced logging for reasoning - show actual content and summaries
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
                      // Include actual reasoning content for debugging
                      reasoningTraces: reasoningContext.traces.map(
                        (trace, index) => ({
                          index,
                          type: trace.type,
                          contentPreview: getPreview(trace.content, 200), // Show first 200 chars of reasoning
                          fullContentLength: trace.content?.length || 0,
                        })
                      ),
                      // Separate log for the full summary to make it easily searchable
                      reasoningSummaryFull: reasoningContext.summary,
                    },
                    'Reasoning traces extracted from GPT-5 response - ENHANCED LOGGING'
                  );

                  // Log each reasoning trace separately for better visibility
                  reasoningContext.traces.forEach((trace, index) => {
                    logger.info(
                      {
                        at: 'api.chat.reasoningTrace',
                        chatId,
                        userId,
                        model: resolvedModel,
                        traceIndex: index,
                        traceType: trace.type,
                        reasoningContent: trace.content, // Full reasoning content for this trace
                      },
                      `Reasoning Trace ${index + 1}/${reasoningContext?.traces.length}: ${trace.type}`
                    );
                  });
                } else {
                  // Log when NO reasoning is found for debugging
                  logger.info(
                    {
                      at: 'api.chat.noReasoningFound',
                      chatId,
                      userId,
                      model: resolvedModel,
                      assistantTextLength: assistantText.length,
                      assistantTextPreview: getPreview(assistantText, 300),
                      isGPT5Model,
                      reasoningEffort: effectiveReasoningEffort,
                    },
                    'NO reasoning traces found in GPT-5 response - DEBUG INFO'
                  );
                }
              } else if (isGPT5Model) {
                // Log when GPT-5 model but no assistant text for debugging
                logger.info(
                  {
                    at: 'api.chat.noAssistantText',
                    chatId,
                    userId,
                    model: resolvedModel,
                    isGPT5Model,
                    reasoningEffort: effectiveReasoningEffort,
                  },
                  'GPT-5 model detected but no assistant text found for reasoning extraction'
                );
              }

              logger.info(
                {
                  at: 'api.chat.assistantResponse',
                  chatId,
                  userId,
                  model: resolvedModel,
                  preview: getPreview(assistantText),
                  reasoningSummary: reasoningContext?.summary,
                },
                'Assistant response preview'
              );
            } catch {
              // ignore logging errors
            }

            const actualRunId = extractRunId(response) || langsmithRunId;
            if (supabase) {
              await storeAssistantMessage({
                supabase,
                chatId,
                messages:
                  response.messages as unknown as import('@/app/types/api.types').Message[],
                userId,
                message_group_id,
                model,
                langsmithRunId: actualRunId,
                reasoningEffort,
              });
            }

            const usage = (response as ResponseWithUsage).usage;
            const responseTime = usage?.totalTokens
              ? usage.totalTokens * 10
              : undefined;
            const providerUsed = inferProviderFromModel(resolvedModel);
            let gatewayEnabled = false;
            try {
              gatewayEnabled = getGatewayConfig().enabled;
            } catch {}
            trackCredentialUsage(
              gatewayEnabled ? 'gateway' : credentialResolution.source,
              providerUsed,
              resolvedModel,
              { userId, success: true, responseTime }
            );

            if (actualRunId && isLangSmithEnabled()) {
              await updateRun({
                runId: actualRunId,
                outputs: {
                  messages: response.messages,
                  usage: (response as ResponseWithUsage).usage,
                },
              });
              const usage2Metrics = (response as ResponseWithUsage).usage;
              if (usage2Metrics) {
                await logMetrics({
                  runId: actualRunId,
                  metrics: {
                    totalTokens: usage2Metrics.totalTokens,
                    inputTokens: usage2Metrics.inputTokens,
                    outputTokens: usage2Metrics.outputTokens,
                    reasoningEffort,
                    enableSearch,
                  },
                });
              }
            }
          },
        });

        return result.toUIMessageStreamResponse();
      }

      modelMessages = convertToModelMessages(
        compatibleMessages as ExtendedUIMessage[]
      );
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to convert messages to model format' }),
        { status: 500 }
      );
    }

    const result = streamText({
      model: requireApiSdk(modelConfig)(apiKey, modelSettings) as LanguageModel,
      system: effectiveSystemPrompt,
      messages: modelMessages,
      tools,
      // GPT-5 models only support default temperature = 1
      temperature: isGPT5Model ? 1 : undefined,
      onError: () => {
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },
      // experimental_toolCallStreaming: true, // Removed - not supported in current AI SDK version
      // onToolCall not supported in current AI SDK version - tool calls are logged in onFinish

      onFinish: async ({ response }) => {
        // Log tool results if any
        if (response.messages && response.messages.length > 0) {
          const lastMessage = response.messages.at(-1);

          // Check for tool invocations in the response
          if (
            lastMessage &&
            typeof lastMessage === 'object' &&
            'toolInvocations' in lastMessage
          ) {
            const messageWithTools = lastMessage as {
              toolInvocations?: {
                toolName?: string;
                state?: string;
                args?: unknown;
                result?: {
                  success?: boolean;
                  query?: string;
                  enhanced_query?: string;
                  total_results?: number;
                  summary?: string;
                  search_config?: unknown;
                  results?: {
                    rank?: unknown;
                    file_id?: unknown;
                    fileName?: string;
                    file_name?: string;
                    score?: unknown;
                    content?: string;
                  }[];
                  [key: string]: unknown;
                };
                [key: string]: unknown;
              }[];
            };
            const toolInvocations = messageWithTools.toolInvocations;
            if (toolInvocations && Array.isArray(toolInvocations)) {
              for (const invocation of toolInvocations) {
                logger.info(
                  {
                    at: 'api.chat.toolInvocation',
                    toolName: invocation.toolName,
                    state: invocation.state,
                    args: invocation.args,
                    result: invocation.result,
                    timestamp: new Date().toISOString(),
                  },
                  'Tool invocation result'
                );

                // Log file search specific results
                if (invocation.toolName === 'fileSearch' && invocation.result) {
                  logger.info(
                    {
                      at: 'api.chat.fileSearchResult',
                      success: invocation.result.success,
                      query: invocation.result.query,
                      enhancedQuery: invocation.result.enhanced_query,
                      totalResults: invocation.result.total_results,
                      summary: invocation.result.summary,
                      searchConfig: invocation.result.search_config,
                      results: invocation.result.results?.map((r) => ({
                        rank: r.rank,
                        fileId: r.file_id,
                        fileName: r.file_name,
                        score: r.score,
                        contentPreview:
                          r.content?.substring(0, PREVIEW_SNIPPET_LENGTH) || '',
                      })),
                    },
                    'File search tool results'
                  );
                }
              }
            }
          }
        }

        // Log assistant response preview
        try {
          let assistantText = '';
          const msgs = (response.messages || []) as unknown[];
          const last = msgs.at(-1) as
            | {
                role?: string;
                content?: unknown;
                parts?: { type?: string; text?: string }[];
              }
            | undefined;

          if (last && last.role === 'assistant') {
            if (typeof last.content === 'string') {
              assistantText = last.content;
            } else if (Array.isArray(last.content)) {
              assistantText = (
                last.content as { type?: string; text?: string }[]
              )
                .map((p) =>
                  p && typeof p === 'object' && 'text' in p
                    ? (p as { text?: string }).text || ''
                    : ''
                )
                .join('');
            } else if (Array.isArray(last.parts)) {
              assistantText = last.parts
                .map((p) =>
                  p && typeof p === 'object' && p.type === 'text'
                    ? p.text || ''
                    : ''
                )
                .join('');
            }
          }

          // Extract reasoning traces for GPT-5 models (main streaming path)
          let reasoningContext: ReasoningContext | null = null;
          if (isGPT5Model && assistantText) {
            const usage = (response as ResponseWithUsage).usage;
            reasoningContext = extractReasoningFromResponse(
              assistantText,
              undefined, // processingTime
              usage?.totalTokens
            );

            // Enhanced logging for reasoning - show actual content and summaries
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
                  // Include actual reasoning content for debugging
                  reasoningTraces: reasoningContext.traces.map(
                    (trace, index) => ({
                      index,
                      type: trace.type,
                      contentPreview: getPreview(trace.content, 200), // Show first 200 chars of reasoning
                      fullContentLength: trace.content?.length || 0,
                    })
                  ),
                  // Separate log for the full summary to make it easily searchable
                  reasoningSummaryFull: reasoningContext.summary,
                },
                'Reasoning traces extracted from GPT-5 response - ENHANCED LOGGING (Main Stream)'
              );

              // Log each reasoning trace separately for better visibility
              reasoningContext.traces.forEach((trace, index) => {
                logger.info(
                  {
                    at: 'api.chat.reasoningTrace',
                    chatId,
                    userId,
                    model: resolvedModel,
                    traceIndex: index,
                    traceType: trace.type,
                    reasoningContent: trace.content, // Full reasoning content for this trace
                  },
                  `Reasoning Trace ${index + 1}/${reasoningContext?.traces.length}: ${trace.type} (Main Stream)`
                );
              });
            } else {
              // Log when NO reasoning is found for debugging
              logger.info(
                {
                  at: 'api.chat.noReasoningFound',
                  chatId,
                  userId,
                  model: resolvedModel,
                  assistantTextLength: assistantText.length,
                  assistantTextPreview: getPreview(assistantText, 300),
                  isGPT5Model,
                  reasoningEffort: effectiveReasoningEffort,
                },
                'NO reasoning traces found in GPT-5 response - DEBUG INFO (Main Stream)'
              );
            }
          } else if (isGPT5Model) {
            // Log when GPT-5 model but no assistant text for debugging
            logger.info(
              {
                at: 'api.chat.noAssistantText',
                chatId,
                userId,
                model: resolvedModel,
                isGPT5Model,
                reasoningEffort: effectiveReasoningEffort,
              },
              'GPT-5 model detected but no assistant text found for reasoning extraction (Main Stream)'
            );
          }

          logger.info(
            {
              at: 'api.chat.assistantResponse',
              chatId,
              userId,
              model: resolvedModel,
              preview: getPreview(assistantText),
              reasoningSummary: reasoningContext?.summary,
            },
            'Assistant response preview'
          );
        } catch {
          // ignore logging errors
        }

        // Resolve final run ID from response (if available)
        const actualRunId = extractRunId(response) || langsmithRunId;

        // Store assistant message with LangSmith run ID
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import('@/app/types/api.types').Message[],
            userId,
            message_group_id,
            model,
            langsmithRunId: actualRunId,
            reasoningEffort: effectiveReasoningEffort,
          });
        }

        // Track successful completion
        const usage = (response as ResponseWithUsage).usage;
        const responseTime = usage?.totalTokens
          ? usage.totalTokens * 10
          : undefined; // Rough estimate

        trackCredentialUsage(
          'environment',
          inferProviderFromModel(resolvedModel),
          resolvedModel,
          {
            userId,
            success: true,
            responseTime,
          }
        );

        // Update LangSmith run if enabled
        if (actualRunId && isLangSmithEnabled()) {
          await updateRun({
            runId: actualRunId,
            outputs: {
              messages: response.messages,
              usage: (response as ResponseWithUsage).usage,
            },
          });

          // Log metrics
          const usageMetrics = (response as ResponseWithUsage).usage;
          if (usageMetrics) {
            await logMetrics({
              runId: actualRunId,
              metrics: {
                totalTokens: usageMetrics.totalTokens,
                inputTokens: usageMetrics.inputTokens,
                outputTokens: usageMetrics.outputTokens,
                reasoningEffort: effectiveReasoningEffort,
                enableSearch,
              },
            });
          }
        }
      },
    });

    // v5 uses toUIMessageStreamResponse for useChat hook compatibility
    return result.toUIMessageStreamResponse();
  } catch (err: unknown) {
    const error = err as {
      code?: string;
      message?: string;
      statusCode?: number;
    };

    // Track error for metrics - use model from request data if available
    let modelToUse = 'unknown-model';
    let userIdToUse = 'unknown-user';

    if (requestData) {
      modelToUse = requestData.model || 'unknown-model';
      userIdToUse = requestData.userId || 'unknown-user';

      try {
        // Try to resolve the model if possible
        const resolvedModelValue = resolveModelId(requestData.model);
        modelToUse = resolvedModelValue;
      } catch {
        // If model resolution fails, use original model
        modelToUse = requestData.model || 'unknown-model';
      }
    }

    try {
      const provider = getProviderForModel(modelToUse) as Provider;
      trackCredentialError(err, provider, {
        model: modelToUse,
        userId: userIdToUse,
      });
    } catch {
      // Silently handle provider resolution errors to prevent error loops
    }

    // Log error with redaction
    logger.error(
      sanitizeLogEntry({ error: err, at: 'api.chat.POST' }),
      'Chat API error'
    );

    return createErrorResponse(error);
  }
}

// Diagnostics for method checks and env visibility (no secrets)
const PROVIDER_ENV_MAPPING = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  mistral: 'MISTRAL_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
} as const;

function checkEnvAvailable(providerId: string): boolean {
  const envKeys =
    PROVIDER_ENV_MAPPING[providerId as keyof typeof PROVIDER_ENV_MAPPING];
  if (!envKeys) return false;
  if (Array.isArray(envKeys)) {
    return envKeys.some((key) => Boolean(process.env[key]));
  }
  return Boolean(process.env[envKeys as string]);
}

export async function GET() {
  let gatewayEnabled = false;
  let gatewayBaseURL: string | null = null;
  try {
    const gw = getGatewayConfig();
    gatewayEnabled = gw.enabled;
    gatewayBaseURL = gw.baseURL;
  } catch {}

  const providers = Object.keys(PROVIDER_ENV_MAPPING);
  const envStatus = providers.reduce<Record<string, boolean>>((acc, p) => {
    acc[p] = checkEnvAvailable(p);
    return acc;
  }, {});

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Use POST to send chat messages',
      gateway: { enabled: gatewayEnabled, baseURL: gatewayBaseURL },
      envAvailable: envStatus,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        Allow: 'GET, POST, OPTIONS',
      },
    }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
}

// Test-only exports (conditional to avoid Next.js type issues)
if (process.env.NODE_ENV === 'test') {
  // These exports are only available during testing
  module.exports.getEffectiveSystemPrompt = getEffectiveSystemPrompt;
  module.exports.configureModelSettings = configureModelSettings;
  module.exports.configureTools = configureTools;
  module.exports.getModelConfiguration = getModelConfiguration;
}
