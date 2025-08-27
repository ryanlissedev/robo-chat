/* eslint-disable @typescript-eslint/no-explicit-any */

import { useChat, type Message, type UseChatHelpers } from '@ai-sdk/react';
import { useMemo } from 'react';
import { toast } from '@/components/ui/toast';

type ModelConfig = {
  id: string;
  name: string;
  provider: string;
};

type ModelChat = {
  model: ModelConfig;
  messages: Message[];
  isLoading: boolean;
  sendMessage: (message: string | Message, options?: any) => void;
  stop: () => void;
};

// Maximum number of models we support
const MAX_MODELS = 10;

export function useMultiChat(models: ModelConfig[]): ModelChat[] {
  // Create a fixed number of useChat hooks to avoid conditional hook calls
  const chatHooks: UseChatHelpers[] = Array.from({ length: MAX_MODELS }, (_, index) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
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
        isLoading: chatHook.isLoading,
        sendMessage: (message: string | Message, options?: any) => {
          // v5 uses sendMessage instead of append
          return chatHook.sendMessage(message, options);
        },
        stop: chatHook.stop,
      };
    });

    return instances;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    models,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ...chatHooks.flatMap((chat) => [chat.messages, chat.isLoading]),
  ]);

  return activeChatInstances;
}
