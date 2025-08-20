// todo: fix this
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMemo } from 'react';
import { toast } from '@/components/ui/toast';
import { API_ROUTE_CHAT } from '@/lib/routes';

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
};

type ModelChat = {
  model: ModelConfig;
  messages: any[];
  isLoading: boolean;
  append: (message: any, options?: any) => void;
  stop: () => void;
};

// Maximum number of models we support
const MAX_MODELS = 10;

export function useMultiChat(models: ModelConfig[]): ModelChat[] {
  // Create a fixed number of useChat hooks to avoid conditional hook calls
  const chatHooks = Array.from({ length: MAX_MODELS }, (_, index) =>
    // todo: fix this
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
      transport: new DefaultChatTransport({
        api: API_ROUTE_CHAT,
      }),
      onError: (error) => {
        const model = models[index];
        if (model) {
          toast({
            title: `Error with ${model.name}`,
            description: error.message,
            status: 'error',
          });
        }
      },
    })
  );

  // Map only the provided models to their corresponding chat hooks
  const activeChatInstances = useMemo(() => {
    const instances = models.slice(0, MAX_MODELS).map((model, index) => {
      const chatHook = chatHooks[index];

      return {
        model,
        messages: chatHook.messages,
        isLoading: (chatHook as any).isLoading,
        append: (message: any, options?: any) => {
          // Use sendMessage for v5 compatibility
          if (message?.content) {
            return chatHook.sendMessage(message.content, options);
          }
          return;
        },
        stop: chatHook.stop,
      };
    });

    return instances;
  }, [models, chatHooks]);

  return activeChatInstances;
}
