/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type UIMessage as Message,
  type UseChatHelpers,
  useChat,
} from '@ai-sdk/react';
import { useMemo, useCallback, useRef } from 'react';

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
};

type ModelChat = {
  model: ModelConfig;
  messages: Message[];
  isLoading: boolean;
  sendMessage: UseChatHelpers<Message>['sendMessage'];
  stop: () => void;
};

// Maximum number of models we support
const MAX_MODELS = 10;

// Narrow type to read status without using `any`
type StatusCap = { status?: 'submitted' | 'streaming' | 'ready' | 'error' };

/**
 * Optimized multi-chat hook with performance improvements:
 * - Lazy initialization of chat instances
 * - Memoized model configurations
 * - Reduced dependency arrays
 * - Better memory management
 */
export function useMultiChatOptimized(models: ModelConfig[]): ModelChat[] {
  // Cache model IDs to prevent unnecessary re-initializations
  const modelIdsRef = useRef<string>('');
  const currentModelIds = models.map(m => m.id).sort().join(',');
  
  // Create chat hooks with lazy initialization pattern
  const chatHooks = useMemo(() => {
    // Only create new instances if model configuration changed
    if (modelIdsRef.current === currentModelIds) {
      return chatHooks;
    }
    
    modelIdsRef.current = currentModelIds;
    
    return Array.from({ length: MAX_MODELS }, () => ({
      instance: null as UseChatHelpers<Message> | null,
      initialized: false,
    }));
  }, [currentModelIds]);

  // Lazy initialization of useChat hooks
  const getChatInstance = useCallback((index: number): UseChatHelpers<Message> => {
    if (!chatHooks[index].instance && !chatHooks[index].initialized) {
      chatHooks[index].instance = useChat({
        // Optimized configuration
        keepLastMessageOnError: true,
        experimental_throttle: 100, // Reduced throttling for better performance
      });
      chatHooks[index].initialized = true;
    }
    return chatHooks[index].instance!;
  }, [chatHooks]);

  // Memoized active chat instances with performance optimizations
  const activeChatInstances = useMemo(() => {
    return models.slice(0, MAX_MODELS).map((model, index) => {
      const chatHook = getChatInstance(index) as UseChatHelpers<Message> & StatusCap;

      return {
        model,
        messages: chatHook.messages,
        // Optimized loading state check
        isLoading: ['submitted', 'streaming'].includes(chatHook.status || 'ready'),
        sendMessage: chatHook.sendMessage,
        stop: chatHook.stop,
      };
    });
  }, [models, getChatInstance]);

  return activeChatInstances;
}

/**
 * Performance metrics for multi-chat operations
 */
export function useMultiChatMetrics(modelChats: ModelChat[]) {
  return useMemo(() => {
    const activeStreams = modelChats.filter(chat => chat.isLoading).length;
    const totalMessages = modelChats.reduce((sum, chat) => sum + chat.messages.length, 0);
    const averageMessagesPerModel = Math.round(totalMessages / modelChats.length * 100) / 100;

    return {
      activeStreams,
      totalMessages,
      averageMessagesPerModel,
      modelCount: modelChats.length,
      performance: {
        concurrentStreams: activeStreams,
        memoryEstimate: totalMessages * 500, // Rough estimate: 500 bytes per message
        recommendedOptimization: activeStreams > 3 ? 'Consider limiting concurrent streams' : 'optimal',
      },
    };
  }, [modelChats]);
}