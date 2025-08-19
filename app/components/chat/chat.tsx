'use client';

const SINGLE_MESSAGE_LAYOUT_DURATION = 0.3;

import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Conversation } from '@/app/components/chat/conversation';
import { useModel } from '@/app/components/chat/use-model';
import { ChatInput } from '@/app/components/chat-input/chat-input';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { toast } from '@/components/ui/toast';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { useUser } from '@/lib/user-store/provider';
import { cn } from '@/lib/utils';
import { useVoiceConnection } from '../voice/use-voice-connection';
import { useChatCore } from './use-chat-core';
import { useChatOperations } from './use-chat-operations';
import { useFileUpload } from './use-file-upload';

const FeedbackWidget = dynamic(
  () => import('./feedback-widget').then((mod) => mod.FeedbackWidget),
  { ssr: false }
);

const DialogAuth = dynamic(
  () => import('./dialog-auth').then((mod) => mod.DialogAuth),
  { ssr: false }
);

export function Chat() {
  const router = useRouter();
  const { chatId } = useChatSession();
  const {
    createNewChat,
    getChatById,
    updateChatModel,
    bumpChat,
    isLoading: isChatsLoading,
  } = useChats();

  const currentChat = useMemo(
    () => (chatId ? getChatById(chatId) : null),
    [chatId, getChatById]
  );

  const { messages: allMessages, cacheAndAddMessage } = useMessages();
  const { user } = useUser();
  const { preferences } = useUserPreferences();
  const { draftValue, clearDraft } = useChatDraft(chatId);

  // Filter out 'data' role messages for AI SDK v2 compatibility
  const initialMessages = useMemo(
    () =>
      allMessages.filter((msg) => (msg as { role?: string }).role !== 'data'),
    [allMessages]
  );

  // File upload functionality
  const {
    files,
    setFiles,
    handleFileUploads,
    createOptimisticAttachments,
    cleanupOptimisticAttachments,
    handleFileUpload,
    handleFileRemove,
  } = useFileUpload();

  // Model selection
  const { selectedModel, handleModelChange } = useModel({
    currentChat: currentChat || null,
    user,
    updateChatModel,
    chatId,
  });

  // State to pass between hooks
  const [hasDialogAuth, setHasDialogAuth] = useState(false);
  const isAuthenticated = useMemo(() => !!user?.id, [user?.id]);
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  );

  // New state for quoted text
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

  // Chat operations (utils + handlers) - created first
  const { checkLimitsAndNotify, ensureChatExists, handleDelete, handleEdit } =
    useChatOperations({
      isAuthenticated,
      chatId,
      messages: initialMessages,
      selectedModel,
      systemPrompt,
      createNewChat,
      setHasDialogAuth,
      setMessages: () => {
        /* noop */
      },
      setInput: () => {
        /* noop */
      },
    });

  // Core chat functionality (initialization + state + actions)
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
    submit,
    handleSuggestion,
    handleReload,
    handleInputChange,
  } = useChatCore({
    messages: initialMessages,
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
  });

  // Voice connection - must come after useChatCore so handleInputChange is defined
  const {
    state: voiceState,
    initializeSession,
    startRecording,
    stopRecording,
  } = useVoiceConnection({
    userId: user?.id,
    isAuthenticated,
    onTranscript: (transcript) => {
      handleInputChange(transcript);
    },
    onError: () => {
      toast({ title: 'Voice error', status: 'error' });
    },
  });

  // Memoize the conversation props to prevent unnecessary rerenders
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

  // Voice recording handlers
  const handleStartVoiceRecording = useCallback(async () => {
    if (!voiceState.isConnected) {
      await initializeSession();
    }
    startRecording();
  }, [voiceState.isConnected, initializeSession, startRecording]);

  const handleStopVoiceRecording = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // Memoize the chat input props
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
      isUserAuthenticated: isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      reasoningEffort,
      onReasoningEffortChange: setReasoningEffort,
      // Voice props
      isVoiceRecording: voiceState.isRecording,
      onStartVoiceRecording: handleStartVoiceRecording,
      onStopVoiceRecording: handleStopVoiceRecording,
      isVoiceSupported: voiceState.isSupported,
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
      isAuthenticated,
      stop,
      status,
      setEnableSearch,
      enableSearch,
      quotedText,
      reasoningEffort,
      setReasoningEffort,
      voiceState.isRecording,
      handleStartVoiceRecording,
      handleStopVoiceRecording,
      voiceState.isSupported,
    ]
  );

  // Handle redirect for invalid chatId - only redirect if we're certain the chat doesn't exist
  // and we're not in a transient state during chat creation
  const shouldRedirectHome =
    !!chatId &&
    !isChatsLoading &&
    !currentChat &&
    !isSubmitting &&
    status === 'ready' &&
    messages.length === 0 &&
    !hasSentFirstMessageRef.current; // Don't redirect if we've already sent a message in this session

  useEffect(() => {
    if (shouldRedirectHome) {
      router.replace('/');
    }
  }, [shouldRedirectHome, router]);

  if (shouldRedirectHome) {
    return null;
  }

  const showOnboarding = !chatId && messages.length === 0;

  return (
    <div
      className={cn(
        '@container/main relative flex h-full flex-col items-center justify-end md:justify-center'
      )}
      data-testid="chat-container"
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
            <h1 className="mb-6 text-center font-medium text-3xl tracking-tight">
              What&apos;s on the agenda today?
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
            duration:
              messages.length === 1 ? SINGLE_MESSAGE_LAYOUT_DURATION : 0,
          },
        }}
      >
        <ChatInput {...chatInputProps} />
      </motion.div>

      <FeedbackWidget authUserId={user?.id} />
    </div>
  );
}
