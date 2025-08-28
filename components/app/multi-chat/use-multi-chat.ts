/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type UIMessage as Message,
  type UseChatHelpers,
  useChat,
} from '@ai-sdk/react';
import { useMemo } from 'react';

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

export function useMultiChat(models: ModelConfig[]): ModelChat[] {
  // Create a fixed number of useChat hooks without loops or nested callbacks
  // to satisfy the Rules of Hooks. Errors will be handled by callers.
  const chatHooks = [
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
    useChat(),
  ] as const satisfies ReadonlyArray<UseChatHelpers<Message>>;

  // Map only the provided models to their corresponding chat hooks
  const activeChatInstances = useMemo(() => {
    const instances = models.slice(0, MAX_MODELS).map((model, index) => {
      const chatHook = chatHooks[index] as UseChatHelpers<Message> & StatusCap;

      return {
        model,
        messages: chatHook.messages,
        // In AI SDK v5, use status to infer loading
        isLoading:
          chatHook.status === 'submitted' || chatHook.status === 'streaming',
        sendMessage: chatHook.sendMessage,
        stop: chatHook.stop,
      };
    });

    return instances;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    models,
    // Track messages and status changes for memo recalculation
    ...chatHooks.map((chat) => chat.messages),
    ...chatHooks.map((chat) => (chat as StatusCap).status),
    chatHooks,
  ]);

  return activeChatInstances;
}
