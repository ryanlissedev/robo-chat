import type {
  LanguageModelUsage,
  UIMessage as MessageAISDK,
  ToolSet,
} from 'ai';
import { convertToModelMessages, streamText } from 'ai';
import { FILE_SEARCH_SYSTEM_PROMPT, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import {
  createRun,
  extractRunId,
  isLangSmithEnabled,
  logMetrics,
  updateRun,
} from '@/lib/langsmith/client';
import { logger } from '@/lib/logger';
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

// Narrow AI SDK response metadata to include optional usage for logging

type ResponseWithUsage = {
  usage?: LanguageModelUsage;
  messages: unknown[];
};

type ChatRequest = {
  messages: MessageAISDK[];
  chatId: string;
  userId: string;
  model: string;
  isAuthenticated: boolean;
  systemPrompt: string;
  enableSearch: boolean;
  message_group_id?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
};

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();

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
    } = requestBody as ChatRequest;

    // Normalize legacy/alias model IDs
    const resolvedModel = model === 'gpt-4o-mini' ? 'gpt-5-mini' : model;

    if (!(messages && chatId && userId)) {
      return new Response(
        JSON.stringify({ error: 'Error, missing information' }),
        { status: 400 }
      );
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model: resolvedModel,
      isAuthenticated,
    });

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId });
    }

    const userMessage = messages.at(-1) as MessageAISDK;

    if (supabase && userMessage?.role === 'user') {
      // Handle both AI SDK v5 parts format and legacy content format
      let textContent = '';
      let attachments: Array<{ url: string; mediaType: string; name: string }> =
        [];

      if ('parts' in userMessage && Array.isArray(userMessage.parts)) {
        // AI SDK v5 parts format
        textContent =
          userMessage.parts
            ?.filter(
              (part: unknown) => (part as { type: string }).type === 'text'
            )
            ?.map((part: unknown) => (part as { text: string }).text)
            ?.join(' ') || '';

        // Extract file attachments from parts format
        attachments =
          userMessage.parts
            ?.filter(
              (part: unknown) => (part as { type: string }).type === 'file'
            )
            ?.map((part: unknown) => {
              const filePart = part as {
                url: string;
                mediaType: string;
                name?: string;
              };
              return {
                url: filePart.url,
                mediaType: filePart.mediaType,
                name: filePart.name || 'attachment',
              };
            }) || [];
      } else if (userMessage.content) {
        // Legacy content format
        textContent =
          typeof userMessage.content === 'string'
            ? userMessage.content
            : JSON.stringify(userMessage.content);
        attachments = [];
      }

      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: textContent,
        attachments,
        model: resolvedModel,
        isAuthenticated,
        message_group_id,
      });
    }

    const allModels = await getAllModels();
    const modelConfig = allModels.find((m) => m.id === resolvedModel);

    if (!modelConfig?.apiSdk) {
      throw new Error(`Model ${model} not found`);
    }

    // Use file search system prompt for GPT-5 models with file search enabled
    const isGPT5Model = resolvedModel.startsWith('gpt-5');

    // Enable file search by default for all models per file-search-first-query spec
    const effectiveEnableSearch = enableSearch !== false; // Default to true

    // Log request context
    try {
      const provider = getProviderForModel(resolvedModel);
      logger.info(
        {
          at: 'api.chat.POST',
          model: resolvedModel,
          provider,
          enableSearch: effectiveEnableSearch,
          reasoningEffort,
          verbosity,
          temperature: isGPT5Model ? 1 : undefined,
        },
        'chat request'
      );
    } catch {}
    const effectiveSystemPrompt = effectiveEnableSearch
      ? FILE_SEARCH_SYSTEM_PROMPT
      : systemPrompt || SYSTEM_PROMPT_DEFAULT;

    let apiKey: string | undefined;
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import('@/lib/user-keys');
      const provider = getProviderForModel(resolvedModel);
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined;
    }

    // Helper function to extract text content from v5 message format
    const extractMessageContent = (msg: MessageAISDK): string => {
      // Handle v4 compatibility
      if (typeof msg.content === 'string') {
        return msg.content;
      }

      // Handle v5 parts array
      if ('parts' in msg && Array.isArray(msg.parts)) {
        return (
          msg.parts
            ?.filter(
              (part: unknown) => (part as { type: string }).type === 'text'
            )
            ?.map((part: unknown) => (part as { text: string }).text)
            ?.join(' ') || ''
        );
      }

      return '';
    };

    // Create LangSmith run if enabled
    let langsmithRunId: string | null = null;
    if (isLangSmithEnabled()) {
      const run = (await createRun({
        name: 'chat-completion',
        inputs: {
          model: resolvedModel,
          messages: messages.map((m: MessageAISDK) => ({
            role: m.role,
            content: extractMessageContent(m),
          })),
          reasoningEffort,
          enableSearch: effectiveEnableSearch,
        },
        runType: 'chain',
        metadata: {
          userId,
          chatId,
          model: resolvedModel,
          reasoningEffort,
          enableSearch: effectiveEnableSearch,
        },
      })) as { id?: string } | null;
      langsmithRunId = run?.id || null;
    }

    // Configure tools - always include file search tool when enabled (not just for GPT-5)
    const tools: ToolSet = effectiveEnableSearch
      ? { fileSearch: fileSearchTool }
      : ({} as ToolSet);

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch: effectiveEnableSearch,
      reasoningEffort,
      verbosity,
      headers: isGPT5Model
        ? {
            'X-Reasoning-Effort': reasoningEffort,
            ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
          }
        : undefined,
    };

    // Convert messages to AI SDK v5 format with robust handling
    const convertedMessages = messages.map((msg: MessageAISDK) => {
      // Handle different message formats
      if (typeof msg.content === 'string') {
        // Legacy string content format
        return {
          ...msg,
          parts: [{ type: 'text', text: msg.content }],
        };
      }
      if (Array.isArray(msg.content)) {
        // Already in parts format (v5) - check if it needs conversion
        const hasTextParts = msg.content.some(
          (part: { type?: string }) => part.type === 'text'
        );
        if (hasTextParts) {
          return {
            ...msg,
            parts: msg.content,
          };
        }
        // Convert array content to parts format
        return {
          ...msg,
          parts: msg.content.map((item: string | { type?: string; text?: string }) =>
            typeof item === 'string' ? { type: 'text', text: item } : item
          ),
        };
      }
      if (msg.parts && Array.isArray(msg.parts)) {
        // Already has parts array
        return msg;
      }
      // Fallback for unknown formats
      return {
        ...msg,
        parts: [{ type: 'text', text: String(msg.content || '') }],
      };
    });

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings),
      system: effectiveSystemPrompt,
      messages: convertToModelMessages(convertedMessages),
      tools,
      // GPT-5 models only support default temperature = 1
      temperature: isGPT5Model ? 1 : undefined,
      // Removed maxSteps: not supported by current AI SDK types
      onError: () => {
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        // Resolve final run ID from response (if available)
        const actualRunId = extractRunId(response) || langsmithRunId;

        // Store assistant message with LangSmith run ID
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import('@/app/types/api.types').Message[],
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
                enableSearch: effectiveEnableSearch,
              },
            });
          }
        }
      },
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
    });
  } catch (err: unknown) {
    const error = err as {
      code?: string;
      message?: string;
      statusCode?: number;
    };

    return createErrorResponse(error);
  }
}
