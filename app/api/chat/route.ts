// FileUIPart import removed as it's not used
import type { UIMessage as MessageAISDK, ToolSet } from 'ai';
import type { Attachment } from '@/app/types/api.types';
import { streamText } from 'ai';
import { FILE_SEARCH_SYSTEM_PROMPT } from '@/lib/config';
import {
  createRun,
  extractRunId,
  isLangSmithEnabled,
  logMetrics,
  updateRun,
} from '@/lib/langsmith/client';
import { getAllModels } from '@/lib/models';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import type { ProviderWithoutOllama } from '@/lib/user-keys';
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from './api';
import { createErrorResponse } from './utils';

// Helper functions for AI SDK v5 UIMessage structure
function getMessageContent(message: MessageAISDK): string {
  if (!message.parts) return '';
  const textParts = message.parts.filter(
    (part) => part.type === 'text'
  ) as Array<{ type: 'text'; text: string }>;
  return textParts.map((part) => part.text).join('');
}

function getMessageAttachments(message: MessageAISDK): Attachment[] {
  if (!message.parts) return [];
  const fileParts = message.parts.filter(
    (part) => part.type === 'file'
  ) as unknown as Array<{ type: 'file'; file: { name?: string; type?: string; size?: number; url?: string } }>;
  return fileParts.map((part) => ({
    name: part.file?.name || 'unknown',
    contentType: part.file?.type || 'application/octet-stream',
    url: part.file?.url || '',
    size: part.file?.size,
  }));
}

export const maxDuration = 60;

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
};

export async function POST(req: Request) {
  try {
    // Parse JSON with error handling
    let requestData: ChatRequest;
    try {
      requestData = await req.json();
    } catch (jsonError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400 }
      );
    }

    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      reasoningEffort = 'low',
    } = requestData;

    console.log('Chat API received:', { messages, chatId, userId, model });
    
    if (!(messages && chatId && userId)) {
      return new Response(
        JSON.stringify({ error: 'Error, missing information' }),
        { status: 400 }
      );
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    });

    // Ensure chat exists before processing messages
    // Only check database for authenticated users
    if (supabase && isAuthenticated) {
      const { data: existingChat, error: chatError } = await supabase
        .from("chats")
        .select("id")
        .eq("id", chatId)
        .eq("user_id", userId)
        .maybeSingle();

      if (chatError) {
        console.error("Error checking chat existence:", chatError);
        return new Response(
          JSON.stringify({ error: "Database error while checking chat" }),
          { status: 500 }
        );
      }

      if (!existingChat) {
        console.error("Chat not found:", { chatId, userId });
        return new Response(
          JSON.stringify({ error: "Chat not found. Please refresh and try again." }),
          { status: 404 }
        );
      }
    }
    // For guest users, we don't validate against database
    // The chat ID is just a client-side identifier

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId });
    }

    const userMessage = messages[messages.length - 1];

    if (supabase && userMessage?.role === 'user') {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: getMessageContent(userMessage),
        attachments: getMessageAttachments(userMessage),
        model,
        isAuthenticated,
        message_group_id,
      });
    }

    const allModels = await getAllModels();
    const modelConfig = allModels.find((m) => m.id === model);

    if (!(modelConfig && modelConfig.apiSdk)) {
      throw new Error(`Model ${model} not found`);
    }

    // Always enable file search for this app
    const isGPT5Model = model.startsWith('gpt-5');
    const effectiveSystemPrompt = systemPrompt || FILE_SEARCH_SYSTEM_PROMPT;

    // Resolve API key for provider. For guests, fall back to environment keys.
    let apiKey: string | undefined;
    const provider = getProviderForModel(model);
    if (provider !== 'ollama') {
      const { getEffectiveApiKey } = await import('@/lib/user-keys');
      const effectiveKey = await getEffectiveApiKey(
        isAuthenticated && userId ? userId : null,
        provider as ProviderWithoutOllama
      );
      apiKey = effectiveKey || undefined;
    }

    // Create LangSmith run if enabled
    let langsmithRunId: string | null = null;
    if (isLangSmithEnabled()) {
      const run = await createRun({
        name: 'chat-completion',
        inputs: {
          model,
          messages: messages.map((m) => ({
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
          model,
          reasoningEffort,
          enableSearch,
        },
      });
      langsmithRunId = (run as { id?: string })?.id || null;
    }

    // Temporarily disable file search tool to fix schema issue
    // const tools: ToolSet = { fileSearch: fileSearchTool };
    const tools: ToolSet = {};

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch,
      reasoningEffort,
      headers: isGPT5Model
        ? {
            'X-Reasoning-Effort': reasoningEffort,
          }
        : undefined,
    };

    console.log('Before streamText - messages:', messages);
    console.log('Messages type:', typeof messages, 'Array?', Array.isArray(messages));
    
    // Convert simple messages to AI SDK v5 format with parts array
    const uiMessages = messages.map(msg => ({
      id: `msg-${Date.now()}-${Math.random()}`,
      role: msg.role,
      content: getMessageContent(msg),
      parts: [
        {
          type: 'text' as const,
          text: getMessageContent(msg)
        }
      ],
      createdAt: new Date()
    }));
    
    console.log('UI Messages:', uiMessages);
    
    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings) as Parameters<typeof streamText>[0]['model'],
      system: effectiveSystemPrompt,
      messages: uiMessages,
      tools,
      onError: (err: unknown) => {
        console.error('Streaming error occurred:', err);
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
          type Usage =
            | {
                totalTokens?: number;
                promptTokens?: number;
                completionTokens?: number;
              }
            | undefined;
          const usage = (response as unknown as { usage?: Usage }).usage;
          await updateRun({
            runId: actualRunId,
            outputs: {
              messages: response.messages,
              usage,
            },
          });

          // Log metrics
          if (usage) {
            await logMetrics({
              runId: actualRunId,
              metrics: {
                totalTokens: usage.totalTokens,
                inputTokens: usage.promptTokens,
                outputTokens: usage.completionTokens,
                reasoningEffort,
                enableSearch,
              },
            });
          }
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (err: unknown) {
    console.error('Error in /api/chat:', err);
    const error = err as {
      code?: string;
      message?: string;
      statusCode?: number;
    };

    return createErrorResponse(error);
  }
}
