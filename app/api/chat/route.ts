import { SYSTEM_PROMPT_DEFAULT, FILE_SEARCH_SYSTEM_PROMPT } from "@/lib/config"
import { logger } from "@/lib/logger"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { streamText } from "ai"
import type { UIMessage as MessageAISDK, ToolSet, LanguageModelUsage } from "ai"
import { fileSearchTool } from "@/lib/tools/file-search"
import {
  isLangSmithEnabled,
  createRun,
  updateRun,
  extractRunId,
  logMetrics,
} from "@/lib/langsmith/client"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

// Narrow AI SDK response metadata to include optional usage for logging
type TokenUsage = {
  totalTokens: number
  promptTokens: number
  completionTokens: number
}

type ResponseWithUsage = {
  usage?: LanguageModelUsage
  messages: unknown[]
}

type ChatRequest = {
  messages: MessageAISDK[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  reasoningEffort?: 'low' | 'medium' | 'high'
  verbosity?: 'low' | 'medium' | 'high'
}

export async function POST(req: Request) {
  try {
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
    } = (await req.json()) as ChatRequest

    // Normalize legacy/alias model IDs
    const resolvedModel = model === 'gpt-4o-mini' ? 'gpt-5-mini' : model

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model: resolvedModel,
      isAuthenticated,
    })

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId })
    }

    const userMessage = messages[messages.length - 1]

    if (supabase && userMessage?.role === "user") {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: (userMessage as any).content as string,
        attachments: (userMessage as any).experimental_attachments || [],
        model: resolvedModel,
        isAuthenticated,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === resolvedModel)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    // Use file search system prompt for GPT-5 models with file search enabled
    const isGPT5Model = resolvedModel.startsWith('gpt-5')
    
    // Enable file search by default for all models per file-search-first-query spec
    const effectiveEnableSearch = enableSearch !== false // Default to true

    // Log request context
    try {
      const provider = getProviderForModel(resolvedModel)
      logger.info({
        at: "api.chat.POST",
        model: resolvedModel,
        provider,
        enableSearch: effectiveEnableSearch,
        reasoningEffort,
        verbosity,
        temperature: isGPT5Model ? 1 : undefined,
      }, "chat request")
    } catch {}
    const effectiveSystemPrompt = effectiveEnableSearch 
      ? FILE_SEARCH_SYSTEM_PROMPT 
      : (systemPrompt || SYSTEM_PROMPT_DEFAULT)

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(resolvedModel)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    // Create LangSmith run if enabled
    let langsmithRunId: string | null = null
    if (isLangSmithEnabled()) {
      const run = (await createRun({
        name: 'chat-completion',
        inputs: {
          model: resolvedModel,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
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
      })) as { id?: string } | null
      langsmithRunId = run?.id || null
    }

    // Configure tools - always include file search tool when enabled (not just for GPT-5)
    const tools: ToolSet = effectiveEnableSearch 
      ? { fileSearch: fileSearchTool } 
      : ({} as ToolSet)

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch: effectiveEnableSearch,
      reasoningEffort,
      verbosity,
      headers: isGPT5Model ? {
        'X-Reasoning-Effort': reasoningEffort,
        ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
      } : undefined,
    }

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings),
      system: effectiveSystemPrompt,
      messages: messages as any,
      tools,
      // GPT-5 models only support default temperature = 1
      temperature: isGPT5Model ? 1 : undefined,
      maxSteps: effectiveEnableSearch ? 10 : 1,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        // Resolve final run ID from response (if available)
        const actualRunId = extractRunId(response) || langsmithRunId

        // Store assistant message with LangSmith run ID
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
            langsmithRunId: actualRunId,
            reasoningEffort,
          })
        }

        // Update LangSmith run if enabled
        if (actualRunId && isLangSmithEnabled()) {
          await updateRun({
            runId: actualRunId,
            outputs: {
              messages: response.messages,
              usage: (response as ResponseWithUsage).usage,
            },
          })

          // Log metrics
          const usage = (response as ResponseWithUsage).usage
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
            })
          }
        }
      },
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
    } as any);
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
