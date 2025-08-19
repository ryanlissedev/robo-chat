import { toast } from "@/components/ui/toast"
import { getOrCreateGuestUserId } from "@/lib/api"
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { Attachment, attachmentsToFileUIParts } from "@/lib/file-handling"
import type { UserProfile } from "@/lib/user/types"
import type { FileUIPart } from 'ai'
// UIMessage type not needed in this file

/**
 * BDD-style chat operations extracted from use-chat-core.ts
 * Following behavior-driven development patterns for testability
 */

// Types for request options
export type RequestOptions = {
  body: {
    chatId: string
    userId: string
    model: string
    isAuthenticated: boolean
    systemPrompt: string
    enableSearch?: boolean
    reasoningEffort: 'low' | 'medium' | 'high'
  }
  experimental_attachments?: FileUIPart[]
}

// Types for operation results
export type OperationResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

export type MessageSubmissionContext = {
  input: string
  files: File[]
  user: UserProfile | null
  selectedModel: string
  isAuthenticated: boolean
  systemPrompt?: string
  enableSearch: boolean
  reasoningEffort: 'low' | 'medium' | 'high'
  chatId: string | null
}

export type OptimisticMessageData = {
  id: string
  content: string
  role: "user"
  createdAt: Date
  experimental_attachments?: FileUIPart[]
}

export type ChatOperationDependencies = {
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (uid: string, chatId: string) => Promise<Attachment[] | null>
  createOptimisticAttachments: (files: File[]) => FileUIPart[]
  cleanupOptimisticAttachments: (attachments?: FileUIPart[]) => void
}

/**
 * BDD Scenario: "Given user input, When submitting message, Then validate and send"
 * 
 * This encapsulates the core message submission business logic:
 * - User authentication validation
 * - Rate limiting checks  
 * - Input validation
 * - File upload processing
 * - Message preparation
 */
export async function submitMessageScenario(
  context: MessageSubmissionContext,
  dependencies: ChatOperationDependencies
): Promise<OperationResult<{
  chatId: string
  requestOptions: RequestOptions
  optimisticMessage: OptimisticMessageData
}>> {
  const { input, files, user, selectedModel, isAuthenticated, systemPrompt, enableSearch, reasoningEffort } = context
  const { checkLimitsAndNotify, ensureChatExists, handleFileUploads, createOptimisticAttachments } = dependencies

  try {
    // Given: User wants to submit a message
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(uid, checkLimitsAndNotify)
    if (!limitResult.success) {
      return { success: false, error: limitResult.error }
    }

    // When: Validating input
    const inputValidation = validateMessageInput(input)
    if (!inputValidation.success) {
      return { success: false, error: inputValidation.error }
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, input)
    if (!currentChatId) {
      return { success: false, error: "Failed to create or access chat" }
    }

    // When: Processing file uploads
    const fileResult = await handleFileUploadScenario(files, uid, currentChatId, handleFileUploads)
    if (!fileResult.success) {
      return { success: false, error: fileResult.error }
    }

    // When: Creating optimistic message
    const optimisticAttachments = files.length > 0 ? createOptimisticAttachments(files) : []
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      content: input,
      role: "user",
      createdAt: new Date(),
      experimental_attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    }

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        enableSearch,
        reasoningEffort,
      },
      experimental_attachments: fileResult.data ? attachmentsToFileUIParts(fileResult.data) : undefined,
    }

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      }
    }

  } catch (error) {
    console.error("Message submission error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }
  }
}

/**
 * BDD Scenario: "Given files selected, When uploading, Then validate and process"
 * 
 * Handles file upload validation and processing
 */
export async function handleFileUploadScenario(
  files: File[],
  uid: string,
  chatId: string,
  handleFileUploads: (uid: string, chatId: string) => Promise<Attachment[] | null>
): Promise<OperationResult<Attachment[] | null>> {
  
  if (files.length === 0) {
    return { success: true, data: [] }
  }

  try {
    // Given: Files are selected for upload
    // When: Processing file uploads
    const attachments = await handleFileUploads(uid, chatId)
    
    if (attachments === null) {
      // Then: Upload failed
      return { success: false, error: "File upload failed" }
    }

    // Then: Upload succeeded
    return { success: true, data: attachments }
  } catch (error) {
    console.error("File upload error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "File upload failed" 
    }
  }
}

/**
 * BDD Scenario: "Given user action, When checking limits, Then enforce rate limits"
 * 
 * Validates user rate limits and permissions
 */
export async function validateUserLimitsScenario(
  uid: string,
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
): Promise<OperationResult> {
  try {
    // Given: User wants to perform an action
    // When: Checking rate limits
    const allowed = await checkLimitsAndNotify(uid)
    
    if (!allowed) {
      // Then: User has exceeded limits
      return { success: false, error: "Rate limit exceeded" }
    }

    // Then: User is within limits
    return { success: true }
  } catch (error) {
    console.error("Limit validation error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Limit validation failed" 
    }
  }
}

/**
 * BDD Scenario: "Given message input, When validating, Then check constraints"
 * 
 * Validates message input against business rules
 */
export function validateMessageInput(input: string): OperationResult {
  // Given: User has provided message input
  // When: Validating input length
  if (input.length > MESSAGE_MAX_LENGTH) {
    // Then: Input exceeds maximum length
    return { 
      success: false, 
      error: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)` 
    }
  }

  if (input.trim().length === 0) {
    // Then: Input is empty
    return { 
      success: false, 
      error: "Message cannot be empty" 
    }
  }

  // Then: Input is valid
  return { success: true }
}

/**
 * BDD Scenario: "Given suggestion text, When submitting, Then validate and send"
 * 
 * Handles suggestion submission with simpler validation
 */
export async function submitSuggestionScenario(
  suggestion: string,
  context: Omit<MessageSubmissionContext, 'input' | 'files'>,
  dependencies: Pick<ChatOperationDependencies, 'checkLimitsAndNotify' | 'ensureChatExists'>
): Promise<OperationResult<{
  chatId: string
  requestOptions: RequestOptions
  optimisticMessage: OptimisticMessageData
}>> {
  const { user, selectedModel, isAuthenticated, reasoningEffort } = context
  const { checkLimitsAndNotify, ensureChatExists } = dependencies

  try {
    // Given: User wants to submit a suggestion
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Checking user limits
    const limitResult = await validateUserLimitsScenario(uid, checkLimitsAndNotify)
    if (!limitResult.success) {
      return { success: false, error: limitResult.error }
    }

    // When: Ensuring chat exists
    const currentChatId = await ensureChatExists(uid, suggestion)
    if (!currentChatId) {
      return { success: false, error: "Failed to create or access chat" }
    }

    // When: Creating optimistic message for suggestion
    const optimisticMessage: OptimisticMessageData = {
      id: `optimistic-${Date.now().toString()}`,
      content: suggestion,
      role: "user",
      createdAt: new Date(),
    }

    // Then: Prepare request options
    const requestOptions = {
      body: {
        chatId: currentChatId,
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    }

    return {
      success: true,
      data: {
        chatId: currentChatId,
        requestOptions,
        optimisticMessage,
      }
    }

  } catch (error) {
    console.error("Suggestion submission error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error occurred" 
    }
  }
}

/**
 * BDD Scenario: "Given chat reload request, When preparing, Then validate and setup"
 * 
 * Prepares chat reload with proper context
 */
export async function prepareReloadScenario(
  context: {
    user: UserProfile | null
    chatId: string | null
    selectedModel: string
    isAuthenticated: boolean
    systemPrompt?: string
    reasoningEffort: 'low' | 'medium' | 'high'
  }
): Promise<OperationResult<{ requestOptions: RequestOptions }>> {
  const { user, chatId, selectedModel, isAuthenticated, systemPrompt, reasoningEffort } = context

  try {
    // Given: User wants to reload chat
    const uid = await getOrCreateGuestUserId(user)
    if (!uid) {
      return { success: false, error: "Failed to get user ID" }
    }

    // When: Preparing reload options
    const requestOptions: RequestOptions = {
      body: {
        chatId: chatId || '', // Handle null chatId case
        userId: uid,
        model: selectedModel,
        isAuthenticated,
        systemPrompt: systemPrompt || SYSTEM_PROMPT_DEFAULT,
        reasoningEffort,
      },
    }

    // Then: Return prepared options
    return {
      success: true,
      data: { requestOptions }
    }

  } catch (error) {
    console.error("Reload preparation error:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Reload preparation failed" 
    }
  }
}

/**
 * Enhanced error handling for chat operations with provider-specific detection
 * Part of the swarm architecture - detects API key issues and guides users to settings
 */
export function handleChatError(error: Error, context: string = "Chat operation") {
  console.error(`${context} error:`, error)
  console.error("Error message:", error.message)
  
  let errorMsg = error.message || "Something went wrong."
  let actionable = false
  
  // Detect provider-specific API key errors
  const providerErrorPatterns = [
    // OpenRouter errors (for DeepSeek R1 and other models)
    {
      patterns: [
        /openrouter.*api.*key/i,
        /openrouter.*unauthorized/i,
        /openrouter.*authentication/i,
        /invalid.*openrouter/i,
      ],
      provider: 'OpenRouter',
      message: 'OpenRouter API key is missing or invalid. Add your OpenRouter API key in settings to access DeepSeek R1 and other models.',
      actionable: true
    },
    // OpenAI errors
    {
      patterns: [
        /openai.*api.*key/i,
        /openai.*unauthorized/i,
        /openai.*authentication/i,
        /invalid.*openai/i,
        /incorrect.*api.*key.*provided/i,
      ],
      provider: 'OpenAI',
      message: 'OpenAI API key is missing or invalid. Add your OpenAI API key in settings to access GPT models.',
      actionable: true
    },
    // Anthropic errors
    {
      patterns: [
        /anthropic.*api.*key/i,
        /anthropic.*unauthorized/i,
        /anthropic.*authentication/i,
        /invalid.*anthropic/i,
      ],
      provider: 'Anthropic',
      message: 'Anthropic API key is missing or invalid. Add your Anthropic API key in settings to access Claude models.',
      actionable: true
    },
    // Google errors
    {
      patterns: [
        /google.*api.*key/i,
        /google.*unauthorized/i,
        /google.*authentication/i,
        /invalid.*google/i,
        /gemini.*api.*key/i,
      ],
      provider: 'Google',
      message: 'Google API key is missing or invalid. Add your Google API key in settings to access Gemini models.',
      actionable: true
    },
    // xAI errors
    {
      patterns: [
        /xai.*api.*key/i,
        /xai.*unauthorized/i,
        /xai.*authentication/i,
        /invalid.*xai/i,
      ],
      provider: 'xAI',
      message: 'xAI API key is missing or invalid. Add your xAI API key in settings to access Grok models.',
      actionable: true
    },
    // Mistral errors
    {
      patterns: [
        /mistral.*api.*key/i,
        /mistral.*unauthorized/i,
        /mistral.*authentication/i,
        /invalid.*mistral/i,
      ],
      provider: 'Mistral',
      message: 'Mistral API key is missing or invalid. Add your Mistral API key in settings.',
      actionable: true
    },
    // Perplexity errors
    {
      patterns: [
        /perplexity.*api.*key/i,
        /perplexity.*unauthorized/i,
        /perplexity.*authentication/i,
        /invalid.*perplexity/i,
      ],
      provider: 'Perplexity',
      message: 'Perplexity API key is missing or invalid. Add your Perplexity API key in settings.',
      actionable: true
    },
    // Groq errors
    {
      patterns: [
        /groq.*api.*key/i,
        /groq.*unauthorized/i,
        /groq.*authentication/i,
        /invalid.*groq/i,
      ],
      provider: 'Groq',
      message: 'Groq API key is missing or invalid. Add your Groq API key in settings to access ultra-fast Llama and Mixtral models.',
      actionable: true
    }
  ]
  
  // Check for provider-specific errors
  for (const providerError of providerErrorPatterns) {
    if (providerError.patterns.some(pattern => pattern.test(errorMsg))) {
      errorMsg = providerError.message
      actionable = providerError.actionable
      break
    }
  }
  
  // Generic API key error patterns
  if (!actionable) {
    const genericApiKeyPatterns = [
      /api.*key.*missing/i,
      /api.*key.*invalid/i,
      /unauthorized.*api.*key/i,
      /authentication.*failed/i,
      /invalid.*credentials/i,
      /missing.*api.*key/i,
    ]
    
    if (genericApiKeyPatterns.some(pattern => pattern.test(errorMsg))) {
      errorMsg = "API key is missing or invalid. Please check your API keys in settings."
      actionable = true
    }
  }
  
  // Generic error message fallbacks
  if (errorMsg === "An error occurred" || errorMsg === "fetch failed") {
    errorMsg = "Something went wrong. Please try again."
  }
  
  // Show toast with appropriate styling for actionable errors
  toast({
    title: errorMsg,
    status: "error",
  })
}