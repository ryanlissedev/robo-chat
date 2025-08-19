import type { UIMessage, FileUIPart } from 'ai';
import type { Attachment } from '@/app/types/api.types';
import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { toast } from '@/components/ui/toast';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { API_ROUTE_CHAT } from '@/lib/routes';
import type { UserProfile } from '@/lib/user/types';
import { writeToIndexedDB } from '@/lib/chat-store/persist';
import {
  type ChatOperationDependencies,
  handleChatError,
  type MessageSubmissionContext,
  prepareReloadScenario,
  submitMessageScenario,
  submitSuggestionScenario,
} from './chat-business-logic';

type UseChatCoreProps = {
  messages: UIMessage[];
  draftValue: string;
  cacheAndAddMessage: (message: UIMessage) => void;
  chatId: string | null;
  user: UserProfile | null;
  files: File[];
  createOptimisticAttachments: (
    files: File[]
  ) => FileUIPart[];
  setFiles: (files: File[]) => void;
  checkLimitsAndNotify: (uid: string) => Promise<boolean>;
  cleanupOptimisticAttachments: (attachments?: FileUIPart[]) => void;
  ensureChatExists: (uid: string, input: string) => Promise<string | null>;
  handleFileUploads: (
    uid: string,
    chatId: string
  ) => Promise<Attachment[] | null>;
  selectedModel: string;
  clearDraft: () => void;
  bumpChat: (chatId: string) => void;
};

export function useChatCore({
  messages: initialMessagesProp,
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

  // Refs and derived state
  const hasSentFirstMessageRef = useRef(false);
  const prevChatIdRef = useRef<string | null>(chatId);
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id]);
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  );

  // Search params handling
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');

  // Handle errors using extracted error handler
  const handleError = useCallback((err: Error) => {
    handleChatError(err, 'Chat');
  }, []);

  // Initialize useChat with AI SDK v5 pattern
  const chatHookResult = useChat({
    id: chatId || undefined,
    api: API_ROUTE_CHAT,
    messages: initialMessagesProp,
    onError: handleError,
    onFinish: (options: { message: UIMessage }) => {
      if (options.message) {
        cacheAndAddMessage(options.message);
      }
    },
  });

  // Extract available properties and create missing ones
  const {
    messages: chatMessages,
    status,
    error,
    stop,
    setMessages,
    sendMessage,
    regenerate,
  } = chatHookResult;

  // Create missing properties that don't exist in AI SDK v2
  const [input, setInput] = useState(draftValue);
  
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    // Will be handled by our custom submit function
  }, []);

  const reload = useCallback(() => {
    regenerate();
  }, [regenerate]);

  // Use sendMessage from useChat hook directly

  // Handle search params on mount
  useEffect(() => {
    if (prompt && typeof window !== 'undefined') {
      requestAnimationFrame(() => setInput(prompt));
    }
  }, [prompt, setInput]);

  // Reset messages when navigating from a chat to home
  if (
    prevChatIdRef.current !== null &&
    chatId === null &&
    chatMessages.length > 0
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

    // Create optimistic message immediately
    const optimisticId = `optimistic-${Date.now().toString()}`;
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : [];
    const optimisticMessage = {
      id: optimisticId,
      parts: [
        {
          type: 'text' as const,
          text: input,
        },
      ],
      content: input,
      role: 'user' as const,
      createdAt: new Date(),
      experimental_attachments:
        optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
    };

    // Add optimistic message to UI
    setMessages((prev) => [...prev, optimisticMessage]);
    setInput('');

    const submittedFiles = [...files];
    setFiles([]);

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
      };

      const result = await submitMessageScenario(
        context,
        operationDependencies
      );

      if (!result.success) {
        // Handle operation failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        cleanupOptimisticAttachments(
          optimisticMessage.experimental_attachments
        );

        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Operation succeeded - proceed with submission
      const data = result.data;
      if (!data) {
        throw new Error('Missing response data for message submission');
      }
      const { chatId: currentChatId, requestOptions } = data;

      // Cache the message immediately with the new chat ID
      const messageToCache = {
        ...optimisticMessage,
        id: `user-${Date.now()}`,
      };
      
      // For guest users, cache the message before navigation
      if (!isAuthenticated && currentChatId) {
        await writeToIndexedDB("messages", { 
          id: currentChatId, 
          messages: [messageToCache] 
        });
      }
      
      // Use sendMessage to send the message with proper options
      await sendMessage({
        role: 'user',
        parts: [
          {
            type: 'text',
            text: input,
          },
        ],
        experimental_attachments: requestOptions.experimental_attachments,
      }, {
        body: requestOptions.body,
      });

      // Clean up optimistic message
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments);
      clearDraft();

      // Bump chat if there were previous messages
      if (chatMessages.length > 0) {
        bumpChat(currentChatId);
      }
    } catch (err) {
      // Handle unexpected errors
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      cleanupOptimisticAttachments(optimisticMessage.experimental_attachments);
      handleChatError(err as Error, 'Message submission');
    } finally {
      setIsSubmitting(false);
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
    cacheAndAddMessage,
    clearDraft,
    chatMessages.length,
    bumpChat,
    sendMessage,
  ]);

  // Handle suggestion using BDD-style operations
  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      setIsSubmitting(true);

      // Create optimistic message for suggestion
      const optimisticId = `optimistic-${Date.now().toString()}`;
      const optimisticMessage = {
        id: optimisticId,
        parts: [
          {
            type: 'text' as const,
            text: suggestion,
          },
        ],
        content: suggestion,
        role: 'user' as const,
        createdAt: new Date(),
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

        // Operation succeeded - proceed with sendMessage
        const data = result.data;
        if (!data) {
          return;
        }

        await sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: suggestion,
            },
          ],
        }, {
          body: data.requestOptions.body,
        });

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
      sendMessage,
      setMessages,
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

      if (!result.success) {
        if (result.error) {
          toast({ title: result.error, status: 'error' });
        }
        return;
      }

      // Proceed with reload using prepared options
      const data = result.data;
      if (!data) {
        return;
      }
      reload();
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
    reload,
  ]);

  // Handle input change - now with access to the real setInput function!
  const { setDraftValue } = useChatDraft(chatId);
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      setDraftValue(value);
    },
    [setInput, setDraftValue]
  );

  return {
    // Chat state
    messages: chatMessages,
    input,
    handleSubmit,
    status,
    error,
    reload,
    stop,
    setMessages,
    setInput,
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

    // Actions
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  };
}
