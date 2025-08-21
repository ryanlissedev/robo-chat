'use client';

import { AnimatePresence, motion } from 'motion/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { Conversation } from '@/app/components/chat/conversation';
import { useModel } from '@/app/components/chat/use-model';
import { ChatInput } from '@/app/components/chat-input/chat-input';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import { VoiceInputBar, useVoiceInputBar } from './voice-input-bar';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { useUser } from '@/lib/user-store/provider';
import { cn } from '@/lib/utils';
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
  const { chatId } = useChatSession();
  const {
    createNewChat,
    getChatById,
    updateChatModel,
    bumpChat,
    isLoading: isChatsLoading,
    hasFetched: hasFetchedChats,
  } = useChats();

  const currentChat = useMemo(
    () => (chatId ? getChatById(chatId) : null),
    [chatId, getChatById]
  );

  const { messages: initialMessages, cacheAndAddMessage } = useMessages();
  const { user } = useUser();
  const { preferences } = useUserPreferences();
  const { draftValue, clearDraft } = useChatDraft(chatId);
  const voiceInputBar = useVoiceInputBar();

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
  // Allow both authenticated users and guest users to use the chat
  // Guest users will be handled by getOrCreateGuestUserId in the backend
  const isAuthenticated = useMemo(
    () => !!user?.id && !user?.anonymous,
    [user?.id, user?.anonymous]
  );
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
        // This is handled by the chat store
      },
      setInput: () => {
        // This is handled by the chat store
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
      chatId,
      onToggleVoice: voiceInputBar.toggle,
      useModernVoiceInput: true,
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
      voiceInputBar.toggle,
    ]
  );

  // Handle redirect for invalid chatId - only redirect if we're certain the chat doesn't exist
  // and we're not in a transient state during chat creation
  if (
    chatId &&
    !isChatsLoading &&
    hasFetchedChats &&
    !currentChat &&
    !isSubmitting &&
    status === 'ready' &&
    messages.length === 0 &&
    !hasSentFirstMessageRef.current // Don't redirect if we've already sent a message in this session
  ) {
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
            <div className="text-center">
              {/* HGG Logo */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <Image
                    src="/hgg-logo.png"
                    alt="HGG Profiling Equipment"
                    width={120}
                    height={120}
                    className="rounded-lg shadow-lg hgg-logo-glow transition-all duration-300 hover:scale-105"
                    priority
                  />
                </div>
              </div>
              
              <h1 className="mb-2 font-medium text-3xl tracking-tight hgg-brand-blue">
                RoboRail Assistant
              </h1>
              <p className="mb-2 text-sm font-medium hgg-brand-blue">
                Powered by HGG Profiling Equipment b.v.
              </p>
              <p className="mb-6 text-lg text-muted-foreground">
                Expert support for RoboRail operation, maintenance, and safety
              </p>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                <p className="font-medium">⚠️ Safety First</p>
                <p>Always follow proper safety protocols when operating the RoboRail machine. Consult your safety manual for complete guidelines.</p>
              </div>
              
              {/* HGG Contact Information */}
              <div className="mt-4 text-xs text-muted-foreground">
                <p>For technical support: <span className="font-medium">+31 (0)573 408 408</span> | Emergency: <span className="font-medium">+31 (0)573 408 400</span></p>
                <p>HGG Profiling Equipment b.v. | <span className="font-medium">support@hgg-group.com</span></p>
              </div>
            </div>
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
      
      {/* Modern Voice Input Bar */}
      <VoiceInputBar
        chatId={chatId}
        isOpen={voiceInputBar.isOpen}
        onToggle={voiceInputBar.toggle}
        onTranscription={(text) => {
          handleInputChange(input ? `${input} ${text}` : text);
        }}
        onResponse={(text) => {
          // Handle voice response
          console.log('Voice response:', text);
        }}
      />
    </div>
  );
}
