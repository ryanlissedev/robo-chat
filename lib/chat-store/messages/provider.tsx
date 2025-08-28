'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UIMessage as MessageAISDK } from 'ai';
import { createContext, useContext } from 'react';
import { toast } from '@/components/ui/toast';
import { useChatSession } from '@/lib/chat-store/session/provider';
import { writeToIndexedDB } from '../persist';
import {
  cacheMessages,
  clearMessagesForChat,
  getCachedMessages,
  getMessagesFromDb,
  type MessageFromDB,
  setMessages as saveMessages,
} from './api';

// Convert database message to AI SDK format
function convertDbMessageToAISDK(dbMessage: MessageFromDB): MessageAISDK {
  // Include optional LangSmith run id in the message object for downstream components
  return {
    id: dbMessage.id,
    role: dbMessage.role as 'user' | 'assistant' | 'system',
    parts: Array.isArray(dbMessage.parts)
      ? (dbMessage.parts as MessageAISDK['parts'])
      : [{ type: 'text', text: dbMessage.content || '' }],
    // Extra metadata that ExtendedUIMessage can read
    ...(dbMessage.langsmith_run_id
      ? { langsmithRunId: dbMessage.langsmith_run_id as unknown as string }
      : {}),
  } as unknown as MessageAISDK;
}

// Convert AI SDK message to database format
function convertAISDKMessageToDb(aiMessage: MessageAISDK): {
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
  parts: MessageAISDK['parts'];
} {
  // Extract text content from parts for legacy content field
  const textContent =
    aiMessage.parts
      ?.map((part: MessageAISDK['parts'][0]) => {
        if (part?.type === 'text' && typeof part.text === 'string') {
          return part.text as string;
        }
        // Handle text-delta type (currently not in UIMessagePart union)
        if (
          'type' in part &&
          (part as { type: string; textDelta?: string }).type ===
            'text-delta' &&
          'textDelta' in part &&
          typeof (part as { type: string; textDelta?: string }).textDelta ===
            'string'
        ) {
          return (part as { type: string; textDelta: string }).textDelta;
        }
        return '';
      })
      ?.join('') || '';

  return {
    role: aiMessage.role as 'system' | 'user' | 'assistant' | 'data',
    content: textContent,
    parts: aiMessage.parts,
  };
}

type MessagesContextType = {
  messages: MessageAISDK[];
  isLoading: boolean;
  setMessages: React.Dispatch<React.SetStateAction<MessageAISDK[]>>;
  refresh: () => Promise<void>;
  saveAllMessages: (messages: MessageAISDK[]) => Promise<void>;
  cacheAndAddMessage: (message: MessageAISDK) => Promise<void>;
  resetMessages: () => Promise<void>;
  deleteMessages: () => Promise<void>;
};

const MessagesContext = createContext<MessagesContextType | null>(null);

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
}

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { chatId } = useChatSession();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<MessageAISDK[]>({
    queryKey: ['messages', chatId],
    enabled: Boolean(chatId),
    queryFn: async () => {
      if (!chatId) {
        return [];
      }
      const cached = await getCachedMessages(chatId);
      try {
        const fresh = await getMessagesFromDb(chatId);
        await cacheMessages(chatId, fresh);
        return fresh.map(convertDbMessageToAISDK);
      } catch {
        return cached.map(convertDbMessageToAISDK);
      }
    },
    initialData: chatId ? undefined : [],
  });

  const refresh = async () => {
    if (!chatId) {
      return;
    }
    try {
      await queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    } catch {
      toast({ title: 'Failed to refresh messages', status: 'error' });
    }
  };

  const cacheAndAddMessage = async (message: MessageAISDK) => {
    if (!chatId) {
      return;
    }
    try {
      queryClient.setQueryData<MessageAISDK[]>(['messages', chatId], (prev) => {
        const updated = [...(prev || []), message];
        writeToIndexedDB('messages', { id: chatId, messages: updated });
        return updated;
      });
    } catch {
      toast({ title: 'Failed to save message', status: 'error' });
    }
  };

  const saveAllMessages = async (newMessages: MessageAISDK[]) => {
    if (!chatId) {
      return;
    }
    try {
      const dbMessages = newMessages.map(convertAISDKMessageToDb);
      await saveMessages(chatId, dbMessages);
      queryClient.setQueryData(['messages', chatId], newMessages);
    } catch {
      toast({ title: 'Failed to save messages', status: 'error' });
    }
  };

  const deleteMessages = async () => {
    if (!chatId) {
      return;
    }
    queryClient.setQueryData(['messages', chatId], []);
    await clearMessagesForChat(chatId);
  };

  const resetMessages = async () => {
    if (!chatId) {
      return;
    }
    queryClient.setQueryData(['messages', chatId], []);
  };

  return (
    <MessagesContext.Provider
      value={{
        messages,
        isLoading,
        setMessages: (updater) => {
          if (!chatId) {
            return;
          }
          const key = ['messages', chatId];
          const current = queryClient.getQueryData<MessageAISDK[]>(key) || [];
          const next =
            typeof updater === 'function'
              ? (updater as (prev: MessageAISDK[]) => MessageAISDK[])(current)
              : updater;
          queryClient.setQueryData(key, next);
        },
        refresh,
        saveAllMessages,
        cacheAndAddMessage,
        resetMessages,
        deleteMessages,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}
