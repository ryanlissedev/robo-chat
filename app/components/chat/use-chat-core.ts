import { useChatDraft } from "@/app/hooks/use-chat-draft"
import { toast } from "@/components/ui/toast"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { API_ROUTE_CHAT } from "@/lib/routes"
import type { UserProfile } from "@/lib/user/types"
import type { UIMessage as Message } from "ai"
// AI SDK v5 - correct import
import { useChat } from "@ai-sdk/react"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useThrottle } from "@/lib/hooks/use-throttle"
import {
  submitMessageScenario,
  submitSuggestionScenario,
  prepareReloadScenario,
  handleChatError,
  type ChatOperationDependencies,
  type MessageSubmissionContext,
} from "./chat-business-logic"

type UseChatCoreProps = {
  initialMessages: Message[]
  draftValue: string
  cacheAndAddMessage: (message: Message) => void
  chatId: string | null
  user: UserProfile | null
  files: File[]
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>
  setFiles: (files: File[]) => void
  checkLimitsAndNotify: (uid: string) => Promise<boolean>
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void
  ensureChatExists: (uid: string, input: string) => Promise<string | null>
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>
  selectedModel: string
  clearDraft: () => void
  bumpChat: (chatId: string) => void
}

export function useChatCore({
  initialMessages,
  draftValue,
  cacheAndAddMessage,
  chatId,
  user,
  files,
  createOptimisticAttachments,
  setFiles,
  checkLimitsAndNotify,
  cleanupOptimisticAttachments,
  ensureChatExists,
  handleFileUploads,
  selectedModel,
  clearDraft,
  bumpChat,
}: UseChatCoreProps) {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasDialogAuth, setHasDialogAuth] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true) // Default to true per file-search-first-query spec
  const [reasoningEffort, setReasoningEffort] = useState<'low' | 'medium' | 'high'>('medium')

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(chatId)
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id])
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  )

  // Search params handling
  const searchParams = useSearchParams()
  const prompt = searchParams.get("prompt")

  // Handle errors using extracted error handler
  const handleError = useCallback((error: Error) => {
    handleChatError(error, "Chat")
  }, [])

  // Initialize useChat with AI SDK v5 optimizations
  const {
    messages,
    input,
    handleSubmit,
    status,
    error,
    reload,
    stop,
    setMessages,
    setInput,
    append,
    isLoading,
    data,
  } = useChat({
    api: API_ROUTE_CHAT,
    initialMessages,
    initialInput: draftValue,
    onFinish: cacheAndAddMessage,
    onError: handleError,
    // AI SDK v5 optimizations
    streamProtocol: 'data',
    sendExtraMessageFields: true,
    maxSteps: 10, // Support for multi-step tool calling
  })
  
  // Throttle UI updates for better performance
  const throttledMessages = useThrottle(messages, 100)
  const throttledStatus = useThrottle(status, 100)

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== "undefined") {
      requestAnimationFrame(() => setInput(prompt))
    }
  }, [prompt, setInput])

  // Track chatId changes without mutating state during render
  prevChatIdRef.current = chatId

  // Prepare operation dependencies for BDD scenarios
  const operationDependencies: ChatOperationDependencies = useMemo(() => ({
    checkLimitsAndNotify,
    ensureChatExists,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
  }), [checkLimitsAndNotify, ensureChatExists, handleFileUploads, createOptimisticAttachments, cleanupOptimisticAttachments])

  // Submit action using BDD-style operations
  const submit = useCallback(async () => {
    setIsSubmitting(true)

    // Create optimistic message immediately
    const optimisticId = `optimistic-${Date.now().toString()}`
    const optimisticAttachments = files.length > 0 ? createOptimisticAttachments(files) : []
    const optimisticMessage = {
      id: optimisticId,
      content: input,
      role: "user" as const,
      createdAt: new Date(),
      experimental_attachments: optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    }

    // Add optimistic message to UI
    setMessages((prev) => [...prev, optimisticMessage])
    setInput("")

    const submittedFiles = [...files]
    setFiles([])

    try {
      // Use BDD scenario for message submission
      const context: MessageSubmissionContext = {
        input,
        files: submittedFiles,
        user,
        selectedModel,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        reasoningEffort,
        chatId,
      }

      const result = await submitMessageScenario(context, operationDependencies)

      if (!result.success) {
        // Handle operation failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
        
        if (result.error) {
          toast({ title: result.error, status: "error" })
        }
        return
      }

      // Operation succeeded - proceed with submission
      const { chatId: currentChatId, requestOptions } = result.data!

      handleSubmit(undefined, requestOptions)
      
      // Clean up optimistic message and cache the real one
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
      cacheAndAddMessage(optimisticMessage)
      clearDraft()

      // Bump chat if there were previous messages
      if (messages.length > 0) {
        bumpChat(currentChatId)
      }

    } catch (error) {
      // Handle unexpected errors
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments)
      handleChatError(error as Error, "Message submission")
    } finally {
      setIsSubmitting(false)
    }
  }, [
    input,
    files,
    user,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    reasoningEffort,
    chatId,
    operationDependencies,
    createOptimisticAttachments,
    setMessages,
    setInput,
    setFiles,
    cleanupOptimisticAttachments,
    handleSubmit,
    cacheAndAddMessage,
    clearDraft,
    messages.length,
    bumpChat,
  ])

  // Handle suggestion using BDD-style operations
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true)

      // Create optimistic message for suggestion
      const optimisticId = `optimistic-${Date.now().toString()}`
      const optimisticMessage = {
        id: optimisticId,
        content: suggestion,
        role: "user" as const,
        createdAt: new Date(),
      }

      setMessages((prev) => [...prev, optimisticMessage])

      try {
        // Use BDD scenario for suggestion submission
        const context = {
          user,
          selectedModel,
          isAuthenticated,
          reasoningEffort,
          chatId,
          enableSearch,
          systemPrompt,
        }

        const dependencies = {
          checkLimitsAndNotify,
          ensureChatExists,
        }

        const result = await submitSuggestionScenario(suggestion, context, dependencies)

        if (!result.success) {
          // Handle operation failure
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
          
          if (result.error) {
            toast({ title: result.error, status: "error" })
          }
          return
        }

        // Operation succeeded - proceed with append
        const { requestOptions } = result.data!

        append(
          {
            role: "user",
            content: suggestion,
          },
          requestOptions
        )
        
        // Clean up optimistic message
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))

      } catch (error) {
        // Handle unexpected errors
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId))
        handleChatError(error as Error, "Suggestion submission")
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      user,
      selectedModel,
      isAuthenticated,
      reasoningEffort,
      chatId,
      enableSearch,
      systemPrompt,
      checkLimitsAndNotify,
      ensureChatExists,
      append,
      setMessages,
    ]
  )

  // Handle reload using BDD-style operations
  const handleReload = useCallback(async () => {
    try {
      // Use BDD scenario for reload preparation
      const context = {
        user,
        chatId,
        selectedModel,
        isAuthenticated,
        systemPrompt,
        reasoningEffort,
      }

      const result = await prepareReloadScenario(context)

      if (!result.success) {
        if (result.error) {
          toast({ title: result.error, status: "error" })
        }
        return
      }

      // Proceed with reload using prepared options
      reload(result.data!.requestOptions)

    } catch (error) {
      handleChatError(error as Error, "Chat reload")
    }
  }, [user, chatId, selectedModel, isAuthenticated, systemPrompt, reasoningEffort, reload])

  // Handle input change - now with access to the real setInput function!
  const { setDraftValue } = useChatDraft(chatId)
  const handleInputChange = useCallback(
    (value: string) => {
      if (setInput) {
        setInput(value)
      }
      setDraftValue(value)
    },
    [setInput, setDraftValue]
  )

  return {
    // Chat state (with throttled versions for UI performance)
    messages: throttledMessages,
    rawMessages: messages, // Unthrottled for critical operations
    input,
    handleSubmit,
    status: throttledStatus,
    rawStatus: status, // Unthrottled for critical checks
    error,
    reload,
    stop,
    setMessages,
    setInput,
    append,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,
    isLoading, // AI SDK v5 loading state
    data, // AI SDK v5 additional data

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,
    reasoningEffort,
    setReasoningEffort,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  }
}
