import type { UIMessage as Message } from '@ai-sdk/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { toast } from '@/components/ui/toast';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import type { UserProfile } from '@/lib/user/types';
import {
  type ChatOperationDependencies,
  handleChatError,
  type MessageSubmissionContext,
  prepareReloadScenario,
  submitMessageScenario,
  submitSuggestionScenario,
} from './chat-business-logic';

type UseChatCoreProps = {
  initialMessages: Message[];
  draftValue: string;
  cacheAndAddMessage: (message: Message) => void;
  chatId: string | null;
  user: UserProfile | null;
  files: File[];
  createOptimisticAttachments: (
    files: File[]
  ) => Array<{ name: string; contentType: string; url: string }>;
  setFiles: (files: File[]) => void;
  checkLimitsAndNotify: (uid: string) => Promise<boolean>;
  cleanupOptimisticAttachments: (attachments?: Array<{ url?: string }>) => void;
  ensureChatExists: (uid: string, input: string) => Promise<string | null>;
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Array<{
    name: string;
    contentType: string;
    url: string;
  }> | null>;
  selectedModel: string;
  clearDraft: () => void;
  bumpChat: (chatId: string) => void;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDialogAuth, setHasDialogAuth] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [reasoningEffort, setReasoningEffort] = useState<
    'low' | 'medium' | 'high'
  >('medium');
  const [verbosity, setVerbosity] = useState<'low' | 'medium' | 'high'>(
    'low' // Default to short verbosity
  );
  const [reasoningSummary, setReasoningSummary] = useState<'auto' | 'detailed'>(
    'auto'
  ); // Default to auto summaries

  // Warn once per session if search is enabled but no vector stores are configured
  const warnedNoVectorStoresRef = useRef(false);
  useEffect(() => {
    const maybeWarnNoStores = async () => {
      if (!enableSearch || warnedNoVectorStoresRef.current) return;
      try {
        const res = await fetch('/api/config/vector-stores', {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: { hasVectorStores: boolean; count: number } =
          await res.json();
        if (!data.hasVectorStores) {
          warnedNoVectorStoresRef.current = true;
          toast({
            title: 'File Search is enabled but no vector stores configured',
            description:
              'Set OPENAI_VECTOR_STORE_IDS or OPENAI_VECTORSTORE to use native file search. Using fallback retrieval only.',
            status: 'warning',
          });
        }
      } catch {
        // silent failure
      }
    };
    void maybeWarnNoStores();
  }, [enableSearch]);

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false);
  const prevChatIdRef = useRef<string | null>(chatId);
  const isAuthenticated = useMemo(
    () => !!user?.id && !user?.anonymous,
    [user?.id, user?.anonymous]
  );
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  );

  // Search params handling
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');

  // Handle errors using extracted error handler
  const handleError = useCallback((error: Error) => {
    handleChatError(error);
  }, []);

  // Initialize useChat
  // Manage input state separately for v5
  const [inputValue, setInputValue] = useState(draftValue);

  const { messages, status, error, stop, setMessages, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat', // Back to real API
    }),
    // biome-ignore lint/style/useNamingConvention: external AI SDK API name
    experimental_throttle: 60,
    onFinish: ({ message }) => {
      cacheAndAddMessage(message);
      // Keep isSubmitting true until streaming is complete
      setTimeout(() => setIsSubmitting(false), 100);
    },
    onError: (error) => {
      handleError(error);
      setIsSubmitting(false);
    },
  });

  // Set initial messages after useChat initialization
  useEffect(() => {
    if (initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, messages.length, setMessages]);

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== 'undefined') {
      requestAnimationFrame(() => setInputValue(prompt));
    }
  }, [prompt]);

  // Reset messages when navigating from a chat to home
  if (
    prevChatIdRef.current !== null &&
    chatId === null &&
    messages.length > 0
  ) {
    setMessages([]);
  }
  prevChatIdRef.current = chatId;

  // Prepare operation dependencies for BDD scenarios
  const operationDependencies: ChatOperationDependencies = useMemo(
    () => ({
      checkLimitsAndNotify,
      ensureChatExists,
      handleFileUploads,
      createOptimisticAttachments,
      cleanupOptimisticAttachments,
    }),
    [
      checkLimitsAndNotify,
      ensureChatExists,
      handleFileUploads,
      createOptimisticAttachments,
      cleanupOptimisticAttachments,
    ]
  );

  // Submit action using BDD-style operations
  const submit = useCallback(async () => {
    setIsSubmitting(true);

    const currentInput = inputValue;
    const submittedFiles = [...files];

    // Clear input immediately for better UX
    setInputValue('');
    setFiles([]);

    try {
      // Use BDD scenario for message submission
      const context: MessageSubmissionContext = {
        input: currentInput,
        files: submittedFiles,
        user,
        selectedModel,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        reasoningEffort,
        verbosity,
        reasoningSummary,
        chatId,
        currentMessages: messages,
      };

      const result = await submitMessageScenario(
        context,
        operationDependencies
      );

      if (!result.success) {
        // Handle operation failure - restore input
        setInputValue(currentInput);
        setFiles(submittedFiles);
        setIsSubmitting(false);

        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Operation succeeded - proceed with submission
      if (!result.data) return;
      const { chatId: currentChatId, requestOptions } = result.data;

      // In v5, use sendMessage which handles everything including optimistic updates
      // v5 expects an object with text property. Optionally attach guest BYOK headers (session scope).
      try {
        const { headersForModel } = await import(
          '@/lib/security/guest-headers'
        );
        const extraHeaders = await headersForModel(selectedModel);
        const merged = extraHeaders
          ? { ...requestOptions, headers: extraHeaders }
          : requestOptions;
        await sendMessage({ text: currentInput }, merged);
      } catch {
        await sendMessage({ text: currentInput }, requestOptions);
      }

      clearDraft();

      // Bump chat if there were previous messages
      if (messages.length > 0) {
        bumpChat(currentChatId);
      }

      // Don't set isSubmitting to false here - let onFinish handle it
    } catch (error) {
      // Handle unexpected errors - restore input
      setInputValue(currentInput);
      setFiles(submittedFiles);
      handleChatError(error as Error);
      setIsSubmitting(false);
    }
  }, [
    inputValue,
    files,
    user,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    enableSearch,
    reasoningEffort,
    chatId,
    operationDependencies,
    setFiles,
    sendMessage,
    clearDraft,
    messages.length,
    bumpChat,
  ]);

  // Handle suggestion using BDD-style operations
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true);

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
          verbosity,
          reasoningSummary,
          currentMessages: messages,
        };

        const dependencies = {
          checkLimitsAndNotify,
          ensureChatExists,
        };

        const result = await submitSuggestionScenario(
          suggestion,
          context,
          dependencies
        );

        if (!result.success) {
          if (result.error) {
            toast({ title: result.error, status: 'error' });
          }
          return;
        }

        // Operation succeeded - proceed with sendMessage
        if (!result.data) return;
        const { requestOptions } = result.data;

        // v5 sendMessage expects an object with text property for proper formatting
        await sendMessage({ text: suggestion }, requestOptions);
      } catch (error) {
        handleChatError(error as Error);
      } finally {
        setIsSubmitting(false);
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
      sendMessage,
    ]
  );

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
        // include UI-controlled verbosity for reload consistency
        // not strictly required but keeps defaults aligned
        // with the last used settings
        verbosity,
      };

      const result = await prepareReloadScenario(context);

      if (!result.success) {
        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Proceed with reload using prepared options - using setMessages for AI SDK v5
      setMessages(messages.slice(0, -1));
    } catch (error) {
      handleChatError(error as Error);
    }
  }, [
    user,
    chatId,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    reasoningEffort,
    messages,
    setMessages,
  ]);

  // Handle input change - manage input state locally for v5
  const { setDraftValue } = useChatDraft(chatId);
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      setDraftValue(value);
    },
    [setDraftValue]
  );

  return {
    // Chat state
    messages,
    input: inputValue,
    status,
    error,
    stop,
    setMessages,
    setInput: setInputValue,
    sendMessage,
    isAuthenticated,
    systemPrompt,
    hasSentFirstMessageRef,

    // Component state
    isSubmitting,
    setIsSubmitting,
    hasDialogAuth,
    setHasDialogAuth,
    enableSearch,
    setEnableSearch,
    reasoningEffort,
    setReasoningEffort,
    verbosity,
    setVerbosity,
    reasoningSummary,
    setReasoningSummary,

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  };
}
