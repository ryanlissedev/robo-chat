'use client';

import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { memo, useCallback, useMemo, useState } from 'react';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { Conversation } from '@/components/app/chat/conversation';
import { useChatCore } from '@/components/app/chat/use-chat-core';
import { useChatOperations } from '@/components/app/chat/use-chat-operations';
import { useFileUpload } from '@/components/app/chat/use-file-upload';
import { useModel } from '@/components/app/chat/use-model';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { useUser } from '@/lib/user-store/provider';
import { cn } from '@/lib/utils';

// Lazy load heavy components to improve initial render performance
const FeedbackWidget = dynamic(
  () =>
    import('@/components/app/chat/feedback-widget').then(
      (mod) => mod.FeedbackWidget
    ),
  {
    ssr: false,
    loading: () => null, // Don't show loading state
  }
);

const DialogAuth = dynamic(
  () =>
    import('@/components/app/chat/dialog-auth').then((mod) => mod.DialogAuth),
  {
    ssr: false,
    loading: () => null,
  }
);

function ChatComponent() {
  const { chatId } = useChatSession();
  const {
    createNewChat,
    getChatById,
    updateChatModel,
    bumpChat,
    isLoading: isChatsLoading,
  } = useChats();

  // Memoize expensive computations
  const currentChat = useMemo(
    () => (chatId ? getChatById(chatId) : null),
    [chatId, getChatById]
  );

  const { messages: initialMessages, cacheAndAddMessage } = useMessages();
  const { user } = useUser();
  const { preferences } = useUserPreferences();
  const { draftValue, clearDraft } = useChatDraft(chatId);

  // Memoize derived user state to prevent unnecessary re-renders
  const userState = useMemo(
    () => ({
      isAuthenticated: !!user?.id && !user?.anonymous,
      systemPrompt: user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    }),
    [user?.id, user?.anonymous, user?.system_prompt]
  );

  // File upload functionality with memoized handlers
  const fileUploadState = useFileUpload();
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = fileUploadState;

  // Model selection with stable reference
  const modelState = useModel({
    currentChat: currentChat || null,
    user,
    updateChatModel,
    chatId,
  });
  const { selectedModel, handleModelChange } = modelState;

  // Auth dialog state
  const [hasDialogAuth, setHasDialogAuth] = useState(false);

  // Quoted text state with memoized handler
  const [quotedText, setQuotedText] = useState<{
    text: string;
    messageId: string;
  }>();

  const handleQuotedSelected = useCallback(
    (text: string, messageId: string) => {
      setQuotedText({ text, messageId });
    },
    []
  );

  // Chat operations with memoized dependencies
  const chatOperationsConfig = useMemo(
    () => ({
      isAuthenticated: userState.isAuthenticated,
      chatId,
      messages: initialMessages,
      selectedModel,
      systemPrompt: userState.systemPrompt,
      createNewChat,
      setHasDialogAuth,
      setMessages: () => {},
      setInput: () => {},
    }),
    [
      userState.isAuthenticated,
      chatId,
      initialMessages,
      selectedModel,
      userState.systemPrompt,
      createNewChat,
    ]
  );

  const { checkLimitsAndNotify, ensureChatExists, handleDelete, handleEdit } =
    useChatOperations(chatOperationsConfig);

  // Core chat functionality with memoized configuration
  const chatCoreConfig = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  const chatCore = useChatCore(chatCoreConfig);
  const {
    messages,
    input,
    status,
    stop,
    hasSentFirstMessageRef,
    isSubmitting,
    enableSearch,
    setEnableSearch,
    reasoningEffort,
    setReasoningEffort,
    verbosity,
    setVerbosity,
    reasoningSummary,
    setReasoningSummary,
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  } = chatCore;

  // Memoize conversation props with stable references
  const conversationProps = useMemo(
    () => ({
      messages,
      status,
      onDelete: handleDelete,
      onEdit: handleEdit,
      onReload: handleReload,
      onQuote: handleQuotedSelected,
    }),
    [
      messages,
      status,
      handleDelete,
      handleEdit,
      handleReload,
      handleQuotedSelected,
    ]
  );

  // Memoize chat input props with stable references
  const chatInputProps = useMemo(
    () => ({
      value: input,
      onSuggestion: handleSuggestion,
      onValueChange: handleInputChange,
      onSend: submit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      hasSuggestions:
        preferences.promptSuggestions && !chatId && messages.length === 0,
      onSelectModel: handleModelChange,
      selectedModel,
      isUserAuthenticated: userState.isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      reasoningEffort,
      onReasoningEffortChange: setReasoningEffort,
      verbosity,
      onVerbosityChange: setVerbosity,
      reasoningSummary,
      onReasoningSummaryChange: setReasoningSummary,
    }),
    [
      input,
      handleSuggestion,
      handleInputChange,
      submit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      preferences.promptSuggestions,
      chatId,
      messages.length,
      handleModelChange,
      selectedModel,
      userState.isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      reasoningEffort,
      setReasoningEffort,
      verbosity,
      setVerbosity,
      reasoningSummary,
      setReasoningSummary,
    ]
  );

  // Early return for invalid chat redirect
  const shouldRedirect = useMemo(
    () =>
      chatId &&
      !isChatsLoading &&
      !currentChat &&
      !isSubmitting &&
      status === 'ready' &&
      messages.length === 0 &&
      !hasSentFirstMessageRef.current,
    [
      chatId,
      isChatsLoading,
      currentChat,
      isSubmitting,
      status,
      messages.length,
      hasSentFirstMessageRef,
    ]
  );

  if (shouldRedirect) {
    return redirect('/');
  }

  const showOnboarding = !chatId && messages.length === 0;

  return (
    <div
      className={cn(
        '@container/main relative flex h-full flex-col items-center justify-end md:justify-center'
      )}
    >
      <DialogAuth open={hasDialogAuth} setOpen={setHasDialogAuth} />

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
            <h1 className="mb-6 font-semibold text-5xl text-blue-600 tracking-tight">
              How can we help you today?
            </h1>
          </motion.div>
        ) : (
          <Conversation key="conversation" {...conversationProps} />
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          'relative inset-x-0 bottom-0 z-50 mx-auto w-full max-w-3xl'
        )}
        layout="position"
        layoutId="chat-input-container"
        transition={{
          layout: {
            duration: messages.length === 1 ? 0.3 : 0,
          },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      <FeedbackWidget authUserId={user?.id} />
    </div>
  );
}

// Memoize the entire Chat component to prevent unnecessary re-renders
// Use custom comparison function for better performance
export const Chat = memo(ChatComponent, (_prevProps, _nextProps) => {
  // Since ChatComponent has no props, we can always return true
  // This prevents re-renders unless the component's internal state changes
  return true;
});
