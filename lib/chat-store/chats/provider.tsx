'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { toast } from '@/components/ui/toast';
import { MODEL_DEFAULT } from '../../config';
import type { Chats } from '../types';
import {
  createNewChat as createNewChatFromDb,
  deleteChat as deleteChatFromDb,
  fetchAndCacheChats,
  getCachedChats,
  updateChatModel as updateChatModelFromDb,
  updateChatTitle,
} from './api';

type ChatsContextType = {
  chats: Chats[];
  refresh: () => Promise<void>;
  isLoading: boolean;
  hasFetched: boolean;
  updateTitle: (id: string, title: string) => Promise<void>;
  deleteChat: (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => Promise<void>;
  setChats: React.Dispatch<React.SetStateAction<Chats[]>>;
  createNewChat: (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    systemPrompt?: string,
    projectId?: string
  ) => Promise<Chats | undefined>;
  resetChats: () => Promise<void>;
  getChatById: (id: string) => Chats | undefined;
  updateChatModel: (id: string, model: string) => Promise<void>;
  bumpChat: (id: string) => Promise<void>;
};
const ChatsContext = createContext<ChatsContextType | null>(null);

export function useChats() {
  const context = useContext(ChatsContext);
  if (!context) {
    throw new Error('useChats must be used within ChatsProvider');
  }
  return context;
}

export function ChatsProvider({
  userId,
  children,
}: {
  userId?: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const {
    data: chats = [],
    isLoading,
    isFetched,
  } = useQuery<Chats[]>({
    queryKey: ['chats', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      // seed from cache first to avoid UI jank
      const cached = await getCachedChats();
      // Kick off remote fetch; if it fails, fall back to cache
      try {
        const fresh = await fetchAndCacheChats(userId ?? '');
        return fresh;
      } catch {
        return cached;
      }
    },
    // Show something immediately if client has cache
    initialData: undefined,
  });

  const refresh = async () => {
    if (!userId) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['chats', userId] });
  };

  const updateTitleMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await updateChatTitle(id, title);
      return { id, title };
    },
    onMutate: async ({ id, title }) => {
      const queryKey = ['chats', userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Chats[]>(queryKey);
      const optimistic = (previous || []).map((c) =>
        c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c
      );
      optimistic.sort(
        (a, b) => +new Date(b.updated_at || '') - +new Date(a.updated_at || '')
      );
      queryClient.setQueryData(queryKey, optimistic);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['chats', userId], ctx.previous);
      }
      toast({ title: 'Failed to update title', status: 'error' });
    },
  });

  const updateTitle = async (id: string, title: string) => {
    await updateTitleMutation.mutateAsync({ id, title });
  };

  const deleteChat = async (
    id: string,
    currentChatId?: string,
    redirect?: () => void
  ) => {
    const queryKey = ['chats', userId];
    const previous = queryClient.getQueryData<Chats[]>(queryKey);
    queryClient.setQueryData<Chats[]>(queryKey, (prev) =>
      (prev || []).filter((c) => c.id !== id)
    );
    try {
      await deleteChatFromDb(id);
      if (id === currentChatId && redirect) {
        redirect();
      }
    } catch {
      if (previous) {
        queryClient.setQueryData(queryKey, previous);
      }
      toast({ title: 'Failed to delete chat', status: 'error' });
    }
  };

  const createNewChat = async (
    userId: string,
    title?: string,
    model?: string,
    isAuthenticated?: boolean,
    _systemPrompt?: string,
    projectId?: string
  ) => {
    if (!userId) {
      return;
    }
    const optimisticId = `optimistic-${Date.now().toString()}`;
    const optimisticChat: Chats = {
      id: optimisticId,
      title: title || 'New Chat',
      created_at: new Date().toISOString(),
      model: model || MODEL_DEFAULT,
      user_id: userId,
      public: true,
      updated_at: new Date().toISOString(),
      project_id: null,
    };

    const queryKey = ['chats', userId];
    const previous = queryClient.getQueryData<Chats[]>(queryKey);
    queryClient.setQueryData<Chats[]>(queryKey, (prev) => [
      optimisticChat,
      ...((prev as Chats[] | undefined) || []),
    ]);

    try {
      const newChat = await createNewChatFromDb(
        userId,
        title,
        model,
        isAuthenticated,
        projectId
      );

      queryClient.setQueryData<Chats[]>(queryKey, (prev) => [
        newChat,
        ...(prev || []).filter((c) => c.id !== optimisticId),
      ]);

      return newChat;
    } catch {
      if (previous) {
        queryClient.setQueryData(queryKey, previous);
      }
      toast({ title: 'Failed to create chat', status: 'error' });
    }
  };

  const resetChats = async () => {
    if (!userId) {
      return;
    }
    queryClient.setQueryData(['chats', userId], []);
  };

  const getChatById = (id: string) => {
    return chats.find((c) => c.id === id);
  };

  const updateChatModel = async (id: string, model: string) => {
    const queryKey = ['chats', userId];
    const previous = queryClient.getQueryData<Chats[]>(queryKey);
    queryClient.setQueryData<Chats[]>(queryKey, (prev) =>
      (prev || []).map((c) => (c.id === id ? { ...c, model } : c))
    );
    try {
      await updateChatModelFromDb(id, model);
    } catch {
      if (previous) {
        queryClient.setQueryData(queryKey, previous);
      }
      toast({ title: 'Failed to update model', status: 'error' });
    }
  };

  const bumpChat = async (id: string) => {
    const queryKey = ['chats', userId];
    queryClient.setQueryData<Chats[]>(queryKey, (prev) => {
      const updated = (prev || []).map((c) =>
        c.id === id ? { ...c, updated_at: new Date().toISOString() } : c
      );
      updated.sort(
        (a, b) => +new Date(b.updated_at || '') - +new Date(a.updated_at || '')
      );
      return updated;
    });
  };

  return (
    <ChatsContext.Provider
      value={{
        chats,
        refresh,
        hasFetched: userId ? isFetched : false,
        updateTitle,
        deleteChat,
        setChats: (updater) => {
          if (!userId) {
            return;
          }
          const queryKey = ['chats', userId];
          const current = queryClient.getQueryData<Chats[]>(queryKey) || [];
          const next =
            typeof updater === 'function'
              ? (updater as (prev: Chats[]) => Chats[])(current)
              : updater;
          queryClient.setQueryData(queryKey, next);
        },
        createNewChat,
        resetChats,
        getChatById,
        updateChatModel,
        bumpChat,
        isLoading,
      }}
    >
      {children}
    </ChatsContext.Provider>
  );
}
