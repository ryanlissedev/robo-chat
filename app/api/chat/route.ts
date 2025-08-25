import type { LanguageModelUsage, ToolSet, UIMessagePart, UITools, UIDataTypes, LanguageModel, ModelMessage } from 'ai';
import type { Attachment } from '@ai-sdk/ui-utils';
import { convertToModelMessages, streamText } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { getMessageContent } from '@/app/types/ai-extended';
import type { SupabaseClientType } from '@/app/types/api.types';
import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import {
  createRun,
  extractRunId,
  isLangSmithEnabled,
  logMetrics,
  updateRun,
} from '@/lib/langsmith/client';
import logger from '@/lib/utils/logger';
import { getAllModels } from '@/lib/models';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { fileSearchTool } from '@/lib/tools/file-search';
import type { ProviderWithoutOllama } from '@/lib/user-keys';
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from './api';
import { createErrorResponse } from './utils';

export const maxDuration = 60;

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
  context?: 'chat' | 'voice';  // Add context to differentiate chat vs voice
  personalityMode?: 'safety-focused' | 'technical-expert' | 'friendly-assistant';  // For voice contexts
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
function getEffectiveSystemPrompt(
  systemPrompt: string,
  enableSearch: boolean,
  isGPT5Model: boolean,
  context?: 'chat' | 'voice',
  personalityMode?: 'safety-focused' | 'technical-expert' | 'friendly-assistant'
): string {
  // For voice context with personality mode, use personality-specific prompts
  if (context === 'voice' && personalityMode) {
    // Import personality configs dynamically to get voice-specific prompts
    const { PERSONALITY_CONFIGS } = require('@/app/components/voice/config/personality-configs');
    if (PERSONALITY_CONFIGS[personalityMode]) {
      return PERSONALITY_CONFIGS[personalityMode].systemPrompt;
    }
  }
  
  // For chat context or when no personality mode, use standard prompt selection
  const useSearchPrompt = enableSearch && isGPT5Model;
  
  return useSearchPrompt
    ? FILE_SEARCH_SYSTEM_PROMPT
    : systemPrompt || SYSTEM_PROMPT_DEFAULT;
}

// Model configuration
function configureModelSettings(
  enableSearch: boolean,
  reasoningEffort: string,
  verbosity?: string,
  isGPT5Model?: boolean
) {
  return {
    enableSearch,
    reasoningEffort,
    verbosity,
    headers: isGPT5Model
      ? {
          'X-Reasoning-Effort': reasoningEffort,
          ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
        }
      : undefined,
  };
}

// Tools configuration
function configureTools(enableSearch: boolean, isGPT5Model: boolean): ToolSet {
  const useTools = enableSearch && isGPT5Model;
  
  if (useTools) {
    logger.info({
      at: 'api.chat.configureTools',
      enableSearch,
      isGPT5Model,
      toolsEnabled: true,
      toolNames: ['fileSearch']
    }, 'Configuring file search tool');
  }
  
  return useTools
    ? { fileSearch: fileSearchTool }
    : ({} as ToolSet);
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
  return { modelConfig, isGPT5Model };
}

// Request logging
function logRequestContext(options: {
  resolvedModel: string;
  enableSearch: boolean;
  reasoningEffort: string;
  verbosity?: string;
  isGPT5Model?: boolean;
}) {
  try {
    const {
      resolvedModel,
      enableSearch,
      reasoningEffort,
      verbosity,
      isGPT5Model,
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
      },
      'chat request'
    );
  } catch {
    // Silently handle error in logging operation
  }
}

// API key retrieval
async function getApiKey(
  isAuthenticated: boolean,
  userId: string,
  resolvedModel: string
): Promise<string | undefined> {
  if (!(isAuthenticated && userId)) {
    return;
  }

  try {
    const { getEffectiveApiKey } = await import('@/lib/user-keys');
    const provider = getProviderForModel(resolvedModel);
    return (
      (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
      undefined
    );
  } catch {
    return;
  }
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
  try {
    const request = (await req.json()) as ChatRequest;
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
      verbosity,
      context = 'chat',  // Default to chat context
      personalityMode,
    } = request;

    // Validate request
    const validationError = validateChatRequest(request);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }

    const resolvedModel = resolveModelId(model);

    const supabase = await validateAndTrackUsage({
      userId,
      model: resolvedModel,
      isAuthenticated,
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
    const { modelConfig, isGPT5Model } = await getModelConfiguration(
      resolvedModel,
      model
    );


    // Log request context
    logRequestContext({
      resolvedModel,
      enableSearch,
      reasoningEffort,
      verbosity,
      isGPT5Model,
    });

    // Get effective system prompt and API key
    const effectiveSystemPrompt = getEffectiveSystemPrompt(
      systemPrompt,
      enableSearch,
      isGPT5Model,
      context,
      personalityMode
    );
    const apiKey = await getApiKey(isAuthenticated, userId, resolvedModel);

    // Create LangSmith run if enabled
    const langsmithRunId = await createLangSmithRun({
      resolvedModel,
      messages,
      reasoningEffort,
      enableSearch,
      userId,
      chatId,
    });

    // Configure tools and model settings
    const tools = configureTools(enableSearch, isGPT5Model);
    const modelSettings = configureModelSettings(
      enableSearch,
      reasoningEffort,
      verbosity,
      isGPT5Model
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
        id: msg.id || Math.random().toString(36),
        role: msg.role,
        parts: msg.parts as UIMessagePart<UIDataTypes, UITools>[], // Type assertion needed due to MessagePart vs custom part types
        createdAt: new Date(),
        content: (() => {
          const textPart = msg.parts.find(p => (p as Record<string, unknown>).type === 'text');
          return textPart ? String((textPart as Record<string, unknown>).text) || '' : '';
        })(), // v4 compatibility
      })
    );

    let modelMessages: ModelMessage[];
    try {
      // Remove undefined parts before conversion and ensure compatibility
      const compatibleMessages = uiMessages.map(msg => ({
        ...msg,
        parts: msg.parts?.filter(Boolean) || []
      }));
      modelMessages = convertToModelMessages(compatibleMessages as ExtendedUIMessage[]);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to convert messages to model format' }),
        { status: 500 }
      );
    }

    const result = streamText({
      model: modelConfig?.apiSdk ? modelConfig.apiSdk(apiKey, modelSettings) as LanguageModel : undefined!,
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
          const lastMessage = response.messages[response.messages.length - 1];
          
          // Check for tool invocations in the response
          if (lastMessage && typeof lastMessage === 'object' && 'toolInvocations' in lastMessage) {
            const toolInvocations = (lastMessage as any).toolInvocations;
            if (toolInvocations && Array.isArray(toolInvocations)) {
              for (const invocation of toolInvocations) {
                logger.info({
                  at: 'api.chat.toolInvocation',
                  toolName: invocation.toolName,
                  state: invocation.state,
                  args: invocation.args,
                  result: invocation.result,
                  timestamp: new Date().toISOString()
                }, 'Tool invocation result');
                
                // Log file search specific results
                if (invocation.toolName === 'fileSearch' && invocation.result) {
                  logger.info({
                    at: 'api.chat.fileSearchResult',
                    success: invocation.result.success,
                    query: invocation.result.query,
                    enhancedQuery: invocation.result.enhanced_query,
                    totalResults: invocation.result.total_results,
                    summary: invocation.result.summary,
                    searchConfig: invocation.result.search_config,
                    results: invocation.result.results?.map((r: any) => ({
                      rank: r.rank,
                      fileId: r.file_id,
                      fileName: r.file_name,
                      score: r.score,
                      contentPreview: r.content?.substring(0, 100)
                    }))
                  }, 'File search tool results');
                }
              }
            }
          }
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
            reasoningEffort,
          });
        }

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
          const usage = (response as ResponseWithUsage).usage;
          if (usage) {
            await logMetrics({
              runId: actualRunId,
              metrics: {
                totalTokens: usage.totalTokens,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                reasoningEffort,
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

    return createErrorResponse(error);
  }
}
