import { SYSTEM_PROMPT_DEFAULT, FILE_SEARCH_SYSTEM_PROMPT } from "@/lib/config"
import { logger } from "@/lib/logger"
import { getAllModels } from "@/lib/models"
import { getProviderForModel } from "@/lib/openproviders/provider-map"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import type { LanguageModelUsage } from 'ai'
import { streamText, convertToModelMessages } from "ai"
import type { ToolSet } from "ai"
import type { UIMessage } from "@ai-sdk/react"
import { fileSearchTool } from "@/lib/tools/file-search"
import { roborailKnowledgeTool } from "@/lib/tools/roborail-knowledge"
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
  messages: UIMessage[]
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

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing or invalid messages" }),
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
      // Extract text content from parts array in v5 UIMessage
      const textContent = userMessage.parts
        ?.filter(part => part.type === 'text')
        .map(part => (part as { text: string }).text)
        .join(' ') || ''
      const attachments = userMessage.parts
        ?.filter(part => part.type === 'file')
        .map(part => part as any) || []
      
      await logUserMessage({
        supabase,
        userId,
        chatId,
        content: textContent,
        attachments,
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

    // Log request context
    try {
      const provider = getProviderForModel(resolvedModel)
      logger.info({
        at: "api.chat.POST",
        model: resolvedModel,
        provider,
        enableSearch,
        reasoningEffort,
        verbosity,
        temperature: isGPT5Model ? 1 : undefined,
      }, "chat request")
    } catch {}
    const effectiveSystemPrompt = enableSearch && isGPT5Model 
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
          messages: messages.map((m: UIMessage) => ({
            role: m.role,
            content: m.parts?.filter(p => p.type === 'text').map(p => (p as { text: string }).text).join(' ') || ''
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
      })) as { id?: string } | null
      langsmithRunId = run?.id || null
    }

    // Configure tools based on file search enablement
    const tools: ToolSet = enableSearch && isGPT5Model 
      ? { 
          fileSearch: fileSearchTool,
          roborailKnowledge: roborailKnowledgeTool
        } 
      : ({} as ToolSet)

    // Configure model settings with reasoning effort
    const modelSettings = {
      enableSearch,
      reasoningEffort,
      verbosity,
      headers: isGPT5Model ? {
        'X-Reasoning-Effort': reasoningEffort,
        ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
      } : undefined,
    }

    // Convert UIMessages to ModelMessages for v5
    // UIMessage already has the correct content format
    let modelMessages: ReturnType<typeof convertToModelMessages>;
    try {
      modelMessages = convertToModelMessages(messages)
    } catch (conversionError) {
      console.error('Error in convertToModelMessages:', conversionError)
      console.error('messages that caused error:', messages)
      return new Response(
        JSON.stringify({ error: "Failed to convert messages to model format" }),
        { status: 500 }
      )
    }
    
    const result = streamText({
      model: modelConfig.apiSdk(apiKey, modelSettings),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      tools,
      // GPT-5 models only support default temperature = 1
      temperature: isGPT5Model ? 1 : undefined,
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
                enableSearch,
              },
            })
          }
        }
      },
    })

    // v5 uses toUIMessageStreamResponse for useChat hook compatibility
    return result.toUIMessageStreamResponse();
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
