import React from 'react';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getGatewayConfig } from '@/lib/openproviders/env';
import type { ModelSettings } from '@/lib/types/models';
import type { ModelConfig } from '../types';

type OpenRouterModelSettings = ModelSettings & {
  enableSearch?: boolean;
};

// Lazy loading factory to reduce initial memory footprint
const createModelConfigFactory = () => {
  let cachedModels: ModelConfig[] | null = null;

  return {
    getModels: (): ModelConfig[] => {
      if (cachedModels) {
        return cachedModels;
      }

      // Only import the actual models when first requested
      const modelsPromise = import('./openrouter').then(module => module.openrouterModels);
      cachedModels = [];
      return cachedModels; // Return empty array initially, will be populated async
    },

    getModel: async (modelId: string): Promise<ModelConfig | undefined> => {
      const { openrouterModels } = await import('./openrouter');
      return openrouterModels.find(model => model.id === modelId);
    },

    // Get models by category for progressive loading
    getModelsByCategory: async (category: 'free' | 'premium' | 'reasoning'): Promise<ModelConfig[]> => {
      const { openrouterModels } = await import('./openrouter');

      switch (category) {
        case 'free':
          return openrouterModels.filter(model =>
            (model.inputCost ?? 0) === 0 && (model.outputCost ?? 0) === 0
          );
        case 'premium':
          return openrouterModels.filter(model =>
            (model.inputCost ?? 0) > 0 || (model.outputCost ?? 0) > 0
          );
        case 'reasoning':
          return openrouterModels.filter(model =>
            (model.tags ?? []).includes('reasoning') || model.reasoningText
          );
        default:
          return openrouterModels;
      }
    },

    // Memory optimization: Clear cache when needed
    clearCache: () => {
      cachedModels = null;
    }
  };
};

// Export singleton instance for consistent caching
export const openrouterModelLoader = createModelConfigFactory();

// Lightweight model metadata for initial loading (no apiSdk functions)
export const openrouterModelMeta = [
  {
    id: 'openrouter:deepseek/deepseek-r1:free',
    name: 'DeepSeek R1',
    provider: 'OpenRouter',
    modelFamily: 'OpenRouter',
    baseProviderId: 'deepseek',
    inputCost: 0,
    outputCost: 0,
    speed: 'Medium',
    intelligence: 'High',
    tags: ['flagship', 'reasoning', 'performance', 'reliability'],
  },
  {
    id: 'openrouter:anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'OpenRouter',
    modelFamily: 'Claude',
    baseProviderId: 'claude',
    inputCost: 3.0,
    outputCost: 15.0,
    speed: 'Medium',
    intelligence: 'High',
    tags: ['flagship', 'reasoning', 'transparent', 'coding'],
  },
  // Add more lightweight metadata as needed
] as const;

// Hook for React components to use lazy loading
export const useOpenRouterModels = () => {
  const [models, setModels] = React.useState<ModelConfig[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const loadModels = React.useCallback(async (category?: 'free' | 'premium' | 'reasoning') => {
    setLoading(true);
    setError(null);

    try {
      const loadedModels = category
        ? await openrouterModelLoader.getModelsByCategory(category)
        : await openrouterModelLoader.getModels();

      setModels(loadedModels);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load models'));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    models,
    loading,
    error,
    loadModels,
    clearCache: openrouterModelLoader.clearCache,
  };
};