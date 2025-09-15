'use client';

import React from 'react';

import type { UIMessage as MessageType } from '@ai-sdk/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useMemo, useState } from 'react';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { getMessageContent } from '@/app/types/ai-extended';
import { MultiModelConversation } from '@/components/app/multi-chat/multi-conversation';
import { toast } from '@/components/ui/toast';
import { getOrCreateGuestUserId } from '@/lib/api';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { useModel } from '@/lib/model-store/provider';
import { useUser } from '@/lib/user-store/provider';
import { cn } from '@/lib/utils';
import { MultiChatInput } from './multi-chat-input';
import { useMultiChat } from './use-multi-chat';

type GroupedMessage = {
  userMessage: ExtendedUIMessage;
  responses: {
    model: string;
    message: ExtendedUIMessage;
    isLoading?: boolean;
    provider: string;
  }[];
  onDelete: (model: string, id: string) => void;
  onEdit: (model: string, id: string, newText: string) => void;
  onReload: (model: string) => void;
};

export function MultiChat() {
  const [prompt, setPrompt] = useState('');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [multiChatId, setMultiChatId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useUser();
  const { models } = useModel();
  const { chatId } = useChatSession();
  const { messages: persistedMessages, isLoading: messagesLoading } =
    useMessages();
  const { createNewChat } = useChats();

  const availableModels = useMemo(() => {
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }));
  }, [models]);

  const modelsFromPersisted = useMemo(() => {
    return persistedMessages
      .filter((msg) => 'model' in msg && msg.model)
      .map((msg) => ('model' in msg ? msg.model : ''));
  }, [persistedMessages]);

  const modelsFromLastGroup = useMemo(() => {
    const userMessages = persistedMessages.filter((msg) => msg.role === 'user');
    if (userMessages.length === 0) {
      return [];
    }

    const lastUserMessage = userMessages.at(-1);
    const lastUserIndex = lastUserMessage
      ? persistedMessages.indexOf(lastUserMessage)
      : -1;

    const modelsInLastGroup: string[] = [];
    for (let i = lastUserIndex + 1; i < persistedMessages.length; i++) {
      const msg = persistedMessages[i];
      if (msg.role === 'user') {
        break;
      }
      if (msg.role === 'assistant' && 'model' in msg && msg.model) {
        modelsInLastGroup.push(msg.model as string);
      }
    }
    return modelsInLastGroup;
  }, [persistedMessages]);

  const allModelsToMaintain = useMemo(() => {
    const combined = [
      ...new Set([...selectedModelIds, ...modelsFromPersisted]),
    ];
    return availableModels.filter((model) => combined.includes(model.id));
  }, [availableModels, selectedModelIds, modelsFromPersisted]);

  if (selectedModelIds.length === 0 && modelsFromLastGroup.length > 0) {
    setSelectedModelIds(modelsFromLastGroup);
  }

  const modelChats = useMultiChat(allModelsToMaintain);
  const systemPrompt = useMemo(
    () => user?.system_prompt || SYSTEM_PROMPT_DEFAULT,
    [user?.system_prompt]
  );
  const isAuthenticated = useMemo(
    () => !!user?.id && !user?.anonymous,
    [user?.id, user?.anonymous]
  );

  const createPersistedGroups = useCallback(() => {
    const persistedGroups: { [key: string]: GroupedMessage } = {};

    if (persistedMessages.length === 0) {
      return persistedGroups;
    }

    const groups: {
      [key: string]: {
        userMessage: MessageType;
        assistantMessages: MessageType[];
      };
    } = {};

    for (let i = 0; i < persistedMessages.length; i++) {
      const message = persistedMessages[i];

      if (message.role === 'user') {
        const groupKey = getMessageContent(message as ExtendedUIMessage);
        if (!groups[groupKey]) {
          groups[groupKey] = {
            userMessage: message,
            assistantMessages: [],
          };
        }
      } else if (message.role === 'assistant') {
        let associatedUserMessage = null;
        for (let j = i - 1; j >= 0; j--) {
          if (persistedMessages[j].role === 'user') {
            associatedUserMessage = persistedMessages[j];
            break;
          }
        }

        if (associatedUserMessage) {
          const groupKey = getMessageContent(
            associatedUserMessage as ExtendedUIMessage
          );
          if (!groups[groupKey]) {
            groups[groupKey] = {
              userMessage: associatedUserMessage,
              assistantMessages: [],
            };
          }
          groups[groupKey].assistantMessages.push(message);
        }
      }
    }

    Object.entries(groups).forEach(([groupKey, group]) => {
      if (group.userMessage) {
        persistedGroups[groupKey] = {
          userMessage: group.userMessage,
          responses: group.assistantMessages.map((msg, index) => {
            const model =
              'model' in msg && msg.model
                ? (msg.model as string)
                : selectedModelIds[index] || `model-${index}`;
            const provider =
              models.find((m) => m.id === model)?.provider || 'unknown';

            return {
              model,
              message: msg,
              isLoading: false,
              provider,
            };
          }),
          onDelete: () => {},
          onEdit: () => {},
          onReload: () => {},
        };
      }
    });

    return persistedGroups;
  }, [persistedMessages, selectedModelIds, models]);

  const messageGroups = useMemo(() => {
    const persistedGroups = createPersistedGroups();
    const liveGroups = { ...persistedGroups };

    modelChats.forEach((chat) => {
      for (let i = 0; i < chat.messages.length; i += 2) {
        const userMsg = chat.messages[i];
        const assistantMsg = chat.messages[i + 1];

        if (userMsg?.role === 'user') {
          const extendedUserMsg = userMsg as ExtendedUIMessage;
          const groupKey = getMessageContent(extendedUserMsg);

          if (!liveGroups[groupKey]) {
            liveGroups[groupKey] = {
              userMessage: extendedUserMsg,
              responses: [],
              onDelete: () => {},
              onEdit: () => {},
              onReload: () => {},
            };
          }

          if (assistantMsg?.role === 'assistant') {
            const extendedAssistantMsg = assistantMsg as ExtendedUIMessage;
            const existingResponse = liveGroups[groupKey].responses.find(
              (r) => r.model === chat.model.id
            );

            if (!existingResponse) {
              liveGroups[groupKey].responses.push({
                model: chat.model.id,
                message: extendedAssistantMsg,
                isLoading: false,
                provider: chat.model.provider,
              });
            }
          } else if (
            chat.isLoading &&
            getMessageContent(extendedUserMsg) === prompt &&
            selectedModelIds.includes(chat.model.id)
          ) {
            const placeholderMessage: ExtendedUIMessage = {
              id: `loading-${chat.model.id}`,
              role: 'assistant',
              content: '',
              parts: [],
            };
            liveGroups[groupKey].responses.push({
              model: chat.model.id,
              message: placeholderMessage,
              isLoading: true,
              provider: chat.model.provider,
            });
          }
        }
      }
    });

    return Object.values(liveGroups);
  }, [createPersistedGroups, modelChats, prompt, selectedModelIds]);

  const handleSubmit = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    if (selectedModelIds.length === 0) {
      toast({
        title: 'No models selected',
        description: 'Please select at least one model to chat with.',
        status: 'error',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const uid = await getOrCreateGuestUserId(user);
      if (!uid) {
        return;
      }

      const messageGroupId = crypto.randomUUID();

      let chatIdToUse = multiChatId || chatId;
      if (!chatIdToUse) {
        const createdChat = await createNewChat(
          uid,
          prompt,
          selectedModelIds[0],
          !!user?.id
        );
        if (!createdChat) {
          throw new Error('Failed to create chat');
        }
        chatIdToUse = createdChat.id;
        setMultiChatId(chatIdToUse);
        window.history.pushState(null, '', `/c/${chatIdToUse}`);
      }

      const selectedChats = modelChats.filter((chat) =>
        selectedModelIds.includes(chat.model.id)
      );

      await Promise.all(
        selectedChats.map(async (chat) => {
          const options = {
            body: {
              chatId: chatIdToUse,
              userId: uid,
              model: chat.model.id,
              isAuthenticated: !!user?.id && !user?.anonymous,
              systemPrompt,
              enableSearch: false,
              message_group_id: messageGroupId,
            },
          };

          // Send message using v5 API shape
          chat.sendMessage({ text: prompt }, options as any);
        })
      );

      setPrompt('');
      setFiles([]);
    } catch {
      toast({
        title: 'Failed to send message',
        description: 'Please try again.',
        status: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    prompt,
    selectedModelIds,
    user,
    modelChats,
    systemPrompt,
    multiChatId,
    chatId,
    createNewChat,
  ]);

  const handleFileUpload = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileRemove = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((file) => file !== fileToRemove));
  }, []);

  const handleStop = useCallback(() => {
    modelChats.forEach((chat) => {
      if (chat.isLoading && selectedModelIds.includes(chat.model.id)) {
        chat.stop();
      }
    });
  }, [modelChats, selectedModelIds]);

  const anyLoading = useMemo(
    () =>
      modelChats.some(
        (chat) => chat.isLoading && selectedModelIds.includes(chat.model.id)
      ),
    [modelChats, selectedModelIds]
  );

  const conversationProps = useMemo(() => ({ messageGroups }), [messageGroups]);

  const inputProps = useMemo(
    () => ({
      value: prompt,
      onValueChange: setPrompt,
      onSend: handleSubmit,
      isSubmitting,
      files,
      onFileUpload: handleFileUpload,
      onFileRemove: handleFileRemove,
      selectedModelIds,
      onSelectedModelIdsChange: setSelectedModelIds,
      isUserAuthenticated: isAuthenticated,
      stop: handleStop,
      status: anyLoading ? ('streaming' as const) : ('ready' as const),
      anyLoading,
    }),
    [
      prompt,
      handleSubmit,
      isSubmitting,
      files,
      handleFileUpload,
      handleFileRemove,
      selectedModelIds,
      isAuthenticated,
      handleStop,
      anyLoading,
    ]
  );

  const showOnboarding = messageGroups.length === 0 && !messagesLoading;

  return (
    <div
      className={cn(
        '@container/main relative flex h-full flex-col items-center',
        showOnboarding ? 'justify-end md:justify-center' : 'justify-end'
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
            transition={{ layout: { duration: 0 } }}
          >
            <h1 className="mb-6 font-medium text-3xl tracking-tight">
              What&apos;s on your mind?
            </h1>
          </motion.div>
        ) : (
          <motion.div
            className="w-full flex-1 overflow-hidden"
            key="conversation"
            layout="position"
            layoutId="conversation"
            transition={{
              layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
            }}
          >
            <MultiModelConversation {...conversationProps} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={cn(
          'z-50 mx-auto w-full max-w-3xl',
          showOnboarding ? 'relative' : 'absolute right-0 bottom-0 left-0'
        )}
        layout="position"
        layoutId="multi-chat-input-container"
        transition={{
          layout: { duration: messageGroups.length === 1 ? 0.3 : 0 },
        }}
      >
        <MultiChatInput {...inputProps} />
      </motion.div>
    </div>
  );
}
