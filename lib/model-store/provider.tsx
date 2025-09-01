'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { fetchClient } from '@/lib/fetch';
import type { ModelConfig } from '@/lib/models/types';

type UserKeyStatus = {
  openrouter: boolean;
  openai: boolean;
  mistral: boolean;
  google: boolean;
  perplexity: boolean;
  xai: boolean;
  anthropic: boolean;
  [key: string]: boolean; // Allow for additional providers
};

type UserConfig = {
  layout: string | null;
  prompt_suggestions: boolean | null;
  show_tool_invocations: boolean | null;
  show_conversation_previews: boolean | null;
  multi_model_enabled: boolean | null;
  hidden_models: string[] | null;
};

type ModelContextType = {
  models: ModelConfig[];
  userKeyStatus: UserKeyStatus;
  favoriteModels: string[];
  userConfig: UserConfig;
  isLoading: boolean;
  refreshModels: () => Promise<void>;
  refreshUserKeyStatus: () => Promise<void>;
  refreshFavoriteModels: () => Promise<void>;
  refreshFavoriteModelsSilent: () => Promise<void>;
  refreshUserConfig: () => Promise<void>;
  refreshAll: () => Promise<void>;
};

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();

  const defaultUserKeyStatus: UserKeyStatus = {
    openrouter: false,
    openai: false,
    mistral: false,
    google: false,
    perplexity: false,
    xai: false,
    anthropic: false,
  };

  const defaultUserConfig: UserConfig = {
    layout: 'fullscreen',
    prompt_suggestions: true,
    show_tool_invocations: true,
    show_conversation_previews: true,
    multi_model_enabled: false,
    hidden_models: [],
  };

  const { data: models = [], isLoading: isLoadingModels } = useQuery<
    ModelConfig[]
  >({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await fetchClient('/api/models');
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return data.models || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime)
    refetchOnWindowFocus: false,
  });

  const {
    data: userKeyStatus = defaultUserKeyStatus,
    isLoading: isLoadingKeys,
  } = useQuery<UserKeyStatus>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      try {
        const response = await fetchClient('/api/user-key-status');
        if (!response.ok) {
          return defaultUserKeyStatus;
        }
        return await response.json();
      } catch {
        return defaultUserKeyStatus;
      }
    },
    initialData: defaultUserKeyStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const { data: favoriteModels = ['gpt-5-mini'], isLoading: isLoadingFavorites } = useQuery<
    string[]
  >({
    queryKey: ['favorite-models'],
    queryFn: async () => {
      try {
        const response = await fetchClient(
          '/api/user-preferences/favorite-models'
        );
        if (!response.ok) {
          return ['gpt-5-mini'];
        }
        const data = await response.json();
        return data.favorite_models || ['gpt-5-mini'];
      } catch {
        return ['gpt-5-mini'];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const {
    data: userConfig = defaultUserConfig,
    isLoading: isLoadingUserConfig,
  } = useQuery<UserConfig>({
    queryKey: ['user-config'],
    queryFn: async () => {
      try {
        const response = await fetchClient('/api/user-preferences');
        if (!response.ok) {
          return defaultUserConfig;
        }
        return await response.json();
      } catch {
        return defaultUserConfig;
      }
    },
    initialData: defaultUserConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const isLoading =
    isLoadingModels ||
    isLoadingKeys ||
    isLoadingFavorites ||
    isLoadingUserConfig;

  const refreshModels = async () => {
    await queryClient.invalidateQueries({ queryKey: ['models'] });
  };

  const refreshUserKeyStatus = async () => {
    await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
  };

  const refreshFavoriteModels = async () => {
    await queryClient.invalidateQueries({ queryKey: ['favorite-models'] });
  };

  const refreshFavoriteModelsSilent = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['favorite-models'] });
    } catch {
      // Silently ignore errors
    }
  };

  const refreshUserConfig = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-config'] });
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['models'] }),
      queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
      queryClient.invalidateQueries({ queryKey: ['favorite-models'] }),
      queryClient.invalidateQueries({ queryKey: ['user-config'] }),
    ]);
  };

  return (
    <ModelContext.Provider
      value={{
        models,
        userKeyStatus,
        favoriteModels,
        userConfig,
        isLoading,
        refreshModels,
        refreshUserKeyStatus,
        refreshFavoriteModels,
        refreshFavoriteModelsSilent,
        refreshUserConfig,
        refreshAll,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
}

// Custom hook to use the model context
export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider');
  }
  return context;
}
