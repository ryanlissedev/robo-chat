import { SYSTEM_PROMPT_DEFAULT, FILE_SEARCH_SYSTEM_PROMPT } from "@/lib/config"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { Attachment } from "@ai-sdk/ui-utils"
import { Message as MessageAISDK, streamText, ToolSet } from "ai"
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
    } = (await req.json()) as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const supabase = await validateAndTrackUsage({
      userId,
      model,
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
        content: userMessage.content,
        attachments: userMessage.experimental_attachments as Attachment[],
        model,
        isAuthenticated,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    const modelConfig = allModels.find((m) => m.id === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    // Use file search system prompt for GPT-5 models with file search enabled
    const isGPT5Model = model.startsWith('gpt-5')
    const effectiveSystemPrompt = enableSearch && isGPT5Model 
      ? FILE_SEARCH_SYSTEM_PROMPT 
      : (systemPrompt || SYSTEM_PROMPT_DEFAULT)

    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      const provider = getProviderForModel(model)
      apiKey =
        (await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)) ||
        undefined
    }

    // Create LangSmith run if enabled
    let langsmithRunId: string | null = null
    if (isLangSmithEnabled()) {
      const run = await createRun({
        name: 'chat-completion',
        inputs: {
          model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
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
      })
      langsmithRunId = run?.id || null
    }

    // Configure tools based on file search enablement
    const tools: ToolSet = enableSearch && isGPT5Model 
      ? { fileSearch: fileSearchTool } 
      : ({} as ToolSet)

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch,
      reasoningEffort,
      headers: isGPT5Model ? {
        'X-Reasoning-Effort': reasoningEffort,
      } : undefined,
    }

    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings),
      system: effectiveSystemPrompt,
      messages: messages,
      tools,
      maxSteps: enableSearch ? 10 : 1,
      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response }) => {
        // Store assistant message with LangSmith run ID
        if (supabase) {
          await storeAssistantMessage({
            supabase,
            chatId,
            messages:
              response.messages as unknown as import("@/app/types/api.types").Message[],
            message_group_id,
            model,
            langsmithRunId,
            reasoningEffort,
          })
        }

        // Update LangSmith run if enabled
        if (langsmithRunId && isLangSmithEnabled()) {
          const runId = extractRunId(response) || langsmithRunId
          await updateRun({
            runId,
            outputs: {
              messages: response.messages,
              usage: response.usage,
            },
          })

          // Log metrics
          if (response.usage) {
            await logMetrics({
              runId,
              metrics: {
                totalTokens: response.usage.totalTokens,
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                reasoningEffort,
                enableSearch,
              },
            })
          }
        }
      },
    })

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendSources: true,
      getErrorMessage: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    })
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
