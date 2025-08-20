'use client';

import { useChat } from '@ai-sdk/react';
import { ChatCircleIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import type { UIMessage as Message } from 'ai';
import { DefaultChatTransport } from 'ai';
import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Conversation } from '@/app/components/chat/conversation';
import { useChatOperations } from '@/app/components/chat/use-chat-operations';
import { useFileUpload } from '@/app/components/chat/use-file-upload';
import { useModel } from '@/app/components/chat/use-model';
import { ChatInput } from '@/app/components/chat-input/chat-input';
import { ProjectChatItem } from '@/app/components/layout/sidebar/project-chat-item';
import { toast } from '@/components/ui/toast';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { MESSAGE_MAX_LENGTH, SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import type { Attachment } from '@/lib/file-handling';
import { API_ROUTE_CHAT } from '@/lib/routes';
import { useUser } from '@/lib/user-store/provider';
import { cn } from '@/lib/utils';

// Layout/UI constants
const LAYOUT_ANIM_DURATION_SHORT = 0.3;
const ICON_SIZE_MD = 24;

// Narrow text parts from message parts
type TextPart = { type: 'text'; text: string };
function isTextPart(part: unknown): part is TextPart {
  return (
    typeof part === 'object' &&
    part !== null &&
    (part as { type?: unknown }).type === 'text' &&
    typeof (part as { text?: unknown }).text === 'string'
  );
}

type Project = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
};

type ProjectViewProps = {
  projectId: string;
};

export function ProjectView({ projectId }: ProjectViewProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableSearch, setEnableSearch] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const { user } = useUser();
  const { createNewChat, bumpChat } = useChats();
  const { cacheAndAddMessage } = useMessages();
  const pathname = usePathname();
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload();

  // Fetch project details
  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      return response.json();
    },
  });

  // Get chats from the chat store and filter for this project
  const { chats: allChats } = useChats();

  // Filter chats for this project
  const chats = allChats.filter((chat) => chat.project_id === projectId);

  // Allow both authenticated users and guest users to use the chat
  // Guest users will be handled by getOrCreateGuestUserId in the backend
  const isAuthenticated = useMemo(() => true, []);

  // Handle errors directly in onError callback
  const handleError = useCallback((error: Error) => {
    let errorMsg = 'Something went wrong.';
    try {
      const parsed = JSON.parse(error.message);
      errorMsg = parsed.error || errorMsg;
    } catch {
      errorMsg = error.message || errorMsg;
    }
    toast({
      title: errorMsg,
      status: 'error',
    });
  }, []);

  const { selectedModel, handleModelChange } = useModel({
    currentChat: null,
    user,
    updateChatModel: () => Promise.resolve(),
    chatId: null,
  });

  // Local input state (v5 has no setInput)
  const [inputValue, setInputValue] = useState('');

  const {
    messages = [],
    sendMessage,
    status = 'ready',
    stop,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({
      api: API_ROUTE_CHAT,
      headers: () => ({ 'Content-Type': 'application/json' }),
      body: () => ({
        chatId: currentChatId,
        userId: user?.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        enableSearch,
      }),
    }),
    onError: handleError,
  });

  // Simplified ensureChatExists for authenticated project context
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: migrated with guarded branches
  const ensureChatExists = useCallback(
    async (userId: string) => {
      // If we already have a current chat ID, return it
      if (currentChatId) {
        return currentChatId;
      }

      // Only create a new chat if we haven't started one yet
      if (messages.length === 0) {
        try {
          const newChat = await createNewChat(
            userId,
            inputValue,
            selectedModel,
            true, // Always authenticated in this context
            SYSTEM_PROMPT_DEFAULT,
            projectId
          );

          if (!newChat) {
            return null;
          }

          setCurrentChatId(newChat.id);
          // Redirect to the chat page as expected
          window.history.pushState(null, '', `/c/${newChat.id}`);
          return newChat.id;
        } catch (err: unknown) {
          let errorMessage = 'Something went wrong.';
          try {
            const errorObj = err as { message?: string };
            if (errorObj.message) {
              const parsed = JSON.parse(errorObj.message);
              errorMessage = parsed.error || errorMessage;
            }
          } catch {
            const errorObj = err as { message?: string };
            errorMessage = errorObj.message || errorMessage;
          }
          toast({
            title: errorMessage,
            status: 'error',
          });
          return null;
        }
      }

      return currentChatId;
    },
    [
      currentChatId,
      messages.length,
      createNewChat,
      inputValue,
      selectedModel,
      projectId,
    ]
  );

  const { handleDelete, handleEdit } = useChatOperations({
    isAuthenticated: true, // Always authenticated in project context
    chatId: null,
    messages,
    selectedModel,
    systemPrompt: SYSTEM_PROMPT_DEFAULT,
    createNewChat,
    setHasDialogAuth: () => {
      /* no-op */
    }, // Not used in project context
    setMessages,
    setInput: () => {
      /* no-op */
    },
  });

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: submission flow includes guarded branches (uploads, limits, optimistic)
  const submit = useCallback(async () => {
    setIsSubmitting(true);

    if (!user?.id) {
      setIsSubmitting(false);
      return;
    }

    const text = (inputValue || '').trim();
    if (!text) {
      setIsSubmitting(false);
      return;
    }

    const optimisticId = `optimistic-${Date.now().toString()}`;
    const optimisticAttachments =
      files.length > 0 ? createOptimisticAttachments(files) : [];

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

    setMessages((prev: Message[]) => [
      ...prev,
      optimisticMessage as unknown as Message,
    ]);
    setInputValue('');

    const submittedFiles = [...files];
    setFiles([]);

    try {
      const ensuredChatId = await ensureChatExists(user.id);
      if (!ensuredChatId) {
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
        cleanupOptimisticAttachments(optimisticAttachments);
        return;
      }

      if (text.length > MESSAGE_MAX_LENGTH) {
        toast({
          title: `The message you submitted was too long, please submit something shorter. (Max ${MESSAGE_MAX_LENGTH} characters)`,
          status: 'error',
        });
        setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
        cleanupOptimisticAttachments(optimisticAttachments);
        return;
      }

      let attachments: Attachment[] | null = [];
      if (submittedFiles.length > 0) {
        attachments = await handleFileUploads(user.id, ensuredChatId);
        if (attachments === null) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          cleanupOptimisticAttachments(optimisticAttachments);
          return;
        }
      }

      const options = {
        body: {
          chatId: ensuredChatId,
          userId: user.id,
          model: selectedModel,
          isAuthenticated: true,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
          enableSearch,
        },
        attachments: attachments || undefined,
      } as const;

      await sendMessage({ text }, options);
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      cleanupOptimisticAttachments(optimisticAttachments);
      cacheAndAddMessage(optimisticMessage as unknown as Message);

      // Bump existing chats to top (non-blocking, after submit)
      if (messages.length > 0) {
        bumpChat(ensuredChatId);
      }
    } catch {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      cleanupOptimisticAttachments(optimisticAttachments);
      toast({ title: 'Failed to send message', status: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    user,
    files,
    createOptimisticAttachments,
    inputValue,
    setMessages,
    setFiles,
    cleanupOptimisticAttachments,
    ensureChatExists,
    handleFileUploads,
    selectedModel,
    sendMessage,
    cacheAndAddMessage,
    messages.length,
    bumpChat,
    enableSearch,
  ]);

  const handleReload = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const lastUserTextPart = messages
      .slice()
      .reverse()
      .find((m) => m.role === 'user')
      ?.parts?.find(isTextPart);
    const text = lastUserTextPart?.text ?? '';
    if (!text) {
      return;
    }
    const options = {
      body: {
        chatId: currentChatId,
        userId: user.id,
        model: selectedModel,
        isAuthenticated: true,
        systemPrompt: SYSTEM_PROMPT_DEFAULT,
        enableSearch,
      },
    } as const;
    await sendMessage({ text }, options);
  }, [user, messages, sendMessage, currentChatId, selectedModel, enableSearch]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Memoize the conversation props to prevent unnecessary rerenders
  const conversationProps = useMemo(
    () => ({
      messages,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
    }),
    [messages, status, handleDelete, handleEdit, handleReload]
  );

  // Memoize the chat input props
  const chatInputProps = useMemo(
    () => ({
      value: inputValue,
      onSuggestion: () => {},
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions: false,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
    }),
    [
      inputValue,
      handleInputChange,
      submit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      handleModelChange,
      selectedModel,
      isAuthenticated,
      stop,
      status,
      enableSearch,
    ]
  );

  // Always show onboarding when on project page, regardless of messages
  const showOnboarding = pathname === `/p/${projectId}`;

  return (
    <div
      className={cn(
        // biome-ignore lint/style/useSortedClasses: maintains intended cascade
        'relative flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden',
        showOnboarding && chats.length === 0
          ? 'justify-center pt-0'
          : showOnboarding && chats.length > 0
            ? 'justify-start pt-32'
            : 'justify-end'
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {showOnboarding ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="absolute bottom-[60%] mx-auto max-w-[50rem] md:relative md:bottom-auto"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="onboarding"
            layout="position"
            layoutId="onboarding"
            transition={{
              layout: {
                duration: 0,
              },
            }}
          >
            <div className="mb-6 flex items-center justify-center gap-2">
              <ChatCircleIcon
                className="text-muted-foreground"
                size={ICON_SIZE_MD}
              />
              <h1 className="text-center font-medium text-3xl tracking-tight">
                {project?.name || ''}
              </h1>
            </div>
          </motion.div>
        ) : (
          <Conversation key="conversation" {...conversationProps} />
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          // biome-ignore lint/style/useSortedClasses: design-tuned order
          'relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl'
        )}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: {
            duration: messages.length === 1 ? LAYOUT_ANIM_DURATION_SHORT : 0,
          },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      {/* biome-ignore lint/complexity/noNestingTernary: UI conditional simplifies render */}
      {showOnboarding && chats.length > 0 ? (
        <div
          className={
            // biome-ignore lint/style/useSortedClasses: design-tuned order
            'mx-auto w-full max-w-3xl px-4 pt-6 pb-20'
          }
        >
          <h2 className="mb-3 font-medium text-muted-foreground text-sm">
            Recent chats
          </h2>
          <div className="space-y-2">
            {chats.map((chat) => (
              <ProjectChatItem
                chat={chat}
                formatDate={formatDate}
                key={chat.id}
              />
            ))}
          </div>
        </div>
      ) : showOnboarding && chats.length === 0 ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-20">
          <h2 className="mb-3 font-medium text-muted-foreground text-sm">
            No chats yet
          </h2>
        </div>
      ) : null}
    </div>
  );
}
