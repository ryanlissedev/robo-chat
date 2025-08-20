// AI SDK v5 - correct import
import { useChat } from '@ai-sdk/react';
import type { UIMessage as Message } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { toast } from '@/components/ui/toast';
import { getOrCreateGuestUserId } from '@/lib/api';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import type { Attachment } from '@/lib/file-handling';
import { API_ROUTE_CHAT } from '@/lib/routes';
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
  ) => Promise<Attachment[] | null>;
  selectedModel: string;
  clearDraft: () => void;
  bumpChat: (chatId: string) => void;
};

export function useChatCore(props: UseChatCoreProps) {
  const {
    // initialMessages is intentionally unused
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
  } = props;
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDialogAuth, setHasDialogAuth] = useState(false);
  const [enableSearch, setEnableSearch] = useState(true); // Default to true per file-search-first-query spec
  const [reasoningEffort, setReasoningEffort] = useState<
    'low' | 'medium' | 'high'
  >('medium');

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false);
  const prevChatIdRef = useRef<string | null>(chatId);
  const isAuthenticated = useMemo(() => !!user?.id && !user?.anonymous, [user?.id, user?.anonymous]);
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  );

  // Get effective user ID (for authenticated users or guest users)
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(
    user?.id || null
  );

  useEffect(() => {
    const initializeUserId = async () => {
      if (user?.id) {
        setEffectiveUserId(user.id);
      } else {
        // For guest users, get or create a guest user ID
        try {
          const guestId = await getOrCreateGuestUserId(user);
          setEffectiveUserId(guestId);
        } catch (error) {
          console.warn('Failed to create guest user:', error);
          // Fallback to a temporary ID
          setEffectiveUserId(`temp-guest-${Date.now()}`);
        }
      }
    };

    initializeUserId();
  }, [user]);

  // Draft management
  const { setDraftValue } = useChatDraft(chatId);

  // Search params handling
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');

  // Handle errors using extracted error handler
  const onError = useCallback((error: Error) => {
    handleChatError(error, 'Chat');
  }, []);

  // AI SDK v5 useChat implementation with proper transport
  const {
    messages = [],
    sendMessage,
    status = 'ready',
    error,
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: API_ROUTE_CHAT,
      headers: () => ({
        'Content-Type': 'application/json',
      }),
      body: () => ({
        chatId,
        userId: effectiveUserId,
        model: selectedModel,
        isAuthenticated,
        systemPrompt,
        enableSearch,
        reasoningEffort,
      }),
    }),
    onError,
  });

  // Enhanced handleSubmit that integrates with file uploads and other features
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      const text = (draftValue || '').trim();
      if (!text) {
        return;
      }

      try {
        await sendMessage(
          { text },
          {
            body: {
              chatId,
              userId: effectiveUserId,
              model: selectedModel,
              isAuthenticated,
              systemPrompt,
              enableSearch,
              reasoningEffort,
            },
          }
        );
        clearDraft();
      } catch (err) {
        onError(err as Error);
      }
    },
    [
      draftValue,
      sendMessage,
      chatId,
      effectiveUserId,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      reasoningEffort,
      clearDraft,
      onError,
    ]
  );

  // Create append function that uses sendMessage
  const append = useCallback(
    (message: Message) => {
      if (message.role === 'user') {
        const textPart = message.parts?.find(
          (p): p is { type: 'text'; text: string } => p.type === 'text'
        );
        sendMessage({ text: textPart?.text || '' });
      } else {
        // For assistant messages, just add to the messages array
        setMessages((prev) => [...prev, message]);
      }
    },
    [sendMessage, setMessages]
  );

  // Throttle UI updates for better performance (removed unused throttles)
  // const THROTTLE_MS = 100;
  // const throttledMessages = useThrottle(messages, THROTTLE_MS);
  // const throttledStatus = useThrottle(status, THROTTLE_MS);

  // Handle search params on mount – write into draft store rather than hook input
  useEffect(() => {
    if (prompt && typeof window !== 'undefined') {
      // Defer to avoid interfering with initial render
      const handle = requestAnimationFrame(() => setDraftValue(prompt));
      return () => cancelAnimationFrame(handle);
    }
  }, [prompt, setDraftValue]);

  // Track chatId changes without mutating state during render
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

  // Helpers to reduce complexity in submit
  const createOptimisticMessage = useCallback(
    (text: string, filesToAttach: File[]) => {
      const optimisticId = `optimistic-${Date.now().toString()}`;
      const optimisticAttachments =
        filesToAttach.length > 0
          ? createOptimisticAttachments(filesToAttach)
          : [];
      const optimisticMessage = {
        id: optimisticId,
        role: 'user' as const,
        createdAt: new Date(),
        parts: [
          { type: 'text' as const, text },
          ...(optimisticAttachments.length > 0
            ? optimisticAttachments.map((att) => ({
                type: 'file' as const,
                file: att,
              }))
            : []),
        ],
      };
      return { optimisticId, optimisticMessage };
    },
    [createOptimisticAttachments]
  );

  const addOptimisticToUi = useCallback(
    (message: Message) => {
      setMessages((prev) => [...prev, message]);
    },
    [setMessages]
  );

  const removeOptimisticFromUi = useCallback(
    (id: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    },
    [setMessages]
  );

  const buildSubmissionContext = useCallback(
    (text: string, submittedFiles: File[]): MessageSubmissionContext => ({
      input: text,
      files: submittedFiles,
      user,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      reasoningEffort,
      chatId,
    }),
    [
      user,
      selectedModel,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      reasoningEffort,
      chatId,
    ]
  );

  // Submit action using BDD-style operations
  const submit = useCallback(async () => {
    setIsSubmitting(true);

    const text = (draftValue || '').trim();
    if (!text) {
      setIsSubmitting(false);
      return;
    }

    // Create & add optimistic message immediately
    const { optimisticId, optimisticMessage } = createOptimisticMessage(
      text,
      files
    );
    addOptimisticToUi(optimisticMessage as unknown as Message);
    clearDraft();

    const submittedFiles = [...files];
    setFiles([]);

    try {
      // Use BDD scenario for message submission
      const context = buildSubmissionContext(text, submittedFiles);

      const result = await submitMessageScenario(
        context,
        operationDependencies
      );

      if (!(result.success && result.data)) {
        // Handle operation failure
        removeOptimisticFromUi(optimisticId);
        const attachmentsToCleanup = optimisticMessage.parts
          .filter(
            (part): part is { type: 'file'; file: Attachment } =>
              part.type === 'file'
          )
          .map((part) => part.file);
        cleanupOptimisticAttachments(attachmentsToCleanup);

        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Operation succeeded - proceed with submission
      const { chatId: currentChatId, requestOptions } = result.data;
      await sendMessage({ text }, requestOptions);

      // Clean up optimistic message and cache the real one
      removeOptimisticFromUi(optimisticId);
      const attachmentsToCleanup = optimisticMessage.parts
        .filter(
          (part): part is { type: 'file'; file: Attachment } =>
            part.type === 'file'
        )
        .map((part) => part.file);
      cleanupOptimisticAttachments(attachmentsToCleanup);
      cacheAndAddMessage(optimisticMessage as unknown as Message);

      // Bump chat if there were previous messages
      if (messages.length > 0) {
        bumpChat(currentChatId);
      }
    } catch (err) {
      // Handle unexpected errors
      removeOptimisticFromUi(optimisticId);
      const attachmentsToCleanup = optimisticMessage.parts
        .filter(
          (part): part is { type: 'file'; file: Attachment } =>
            part.type === 'file'
        )
        .map((part) => part.file);
      cleanupOptimisticAttachments(attachmentsToCleanup);
      handleChatError(err as Error, 'Message submission');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draftValue,
    files,
    buildSubmissionContext,
    operationDependencies,
    createOptimisticMessage,
    addOptimisticToUi,
    removeOptimisticFromUi,
    setFiles,
    cleanupOptimisticAttachments,
    sendMessage,
    cacheAndAddMessage,
    messages.length,
    bumpChat,
    clearDraft,
  ]);

  // Handle suggestion using BDD-style operations
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true);

      // Create optimistic message for suggestion
      const optimisticId = `optimistic-${Date.now().toString()}`;
      const optimisticMessage = {
        id: optimisticId,
        role: 'user' as const,
        createdAt: new Date(),
        parts: [{ type: 'text' as const, text: suggestion }],
      };

      setMessages((prev) => [...prev, optimisticMessage]);

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
          // Handle operation failure
          setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));

          if (result.error) {
            toast({ title: result.error, status: 'error' });
          }
          return;
        }

        // Operation succeeded - proceed with sending the suggestion
        const data = result.data;
        if (data) {
          await sendMessage({ text: suggestion }, data.requestOptions);
        }

        // Clean up optimistic message
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      } catch (err) {
        // Handle unexpected errors
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
        handleChatError(err as Error, 'Suggestion submission');
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
      setMessages,
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
      };

      const result = await prepareReloadScenario(context);

      if (!(result.success && result.data)) {
        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Re-send last user message using prepared options (v5 does not expose reload)
      const lastUserTextPart = messages
        .slice()
        .reverse()
        .find((m) => m.role === 'user')
        ?.parts?.find(
          (p): p is { type: 'text'; text: string } => p.type === 'text'
        );
      const text = lastUserTextPart?.text || '';
      if (text) {
        await sendMessage({ text }, result.data.requestOptions);
      }
    } catch (err) {
      handleChatError(err as Error, 'Chat reload');
    }
  }, [
    user,
    chatId,
    selectedModel,
    isAuthenticated,
    systemPrompt,
    reasoningEffort,
    messages,
    sendMessage,
  ]);

  // Handle input change – write only to the draft store (v5 has no setInput)
  const handleInputChange = useCallback(
    (value: string) => {
      setDraftValue(value);
    },
    [setDraftValue]
  );

  return {
    // Chat state
    messages,
    rawMessages: messages,
    // No hook-provided input in v5; we use the parent-provided draftValue
    input: draftValue,
    handleSubmit,
    status,
    rawStatus: status,
    error,
    stop,
    setMessages,
    append,
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

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  };
}
