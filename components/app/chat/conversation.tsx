import type { UIMessage as MessageType } from '@ai-sdk/react';
import { memo, useRef, useMemo } from 'react';
import {
  type ExtendedUIMessage,
  getMessageContent,
  hasAttachments,
} from '@/app/types/ai-extended';
import {
  ChatContainerContent,
  ChatContainerRoot,
} from '@/components/prompt-kit/chat-container';
import { Loader } from '@/components/prompt-kit/loader';
import { ScrollButton } from '@/components/prompt-kit/scroll-button';
import { Message } from './message';

type ConversationProps = {
  messages: MessageType[];
  status?: 'streaming' | 'ready' | 'submitted' | 'error';
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onReload: () => void;
  onQuote?: (text: string, messageId: string) => void;
};

function ConversationComponent({
  messages,
  status = 'ready',
  onDelete,
  onEdit,
  onReload,
  onQuote,
}: ConversationProps) {
  const initialMessageCount = useRef(messages.length);

  // Memoize empty state check
  const isEmpty = useMemo(() => !messages || messages.length === 0, [messages]);
  
  if (isEmpty) {
    return <div className="h-full w-full" />;
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center overflow-y-auto overflow-x-hidden">
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-10 mx-auto flex w-full flex-col justify-center">
        <div className="flex h-app-header w-full bg-background lg:hidden lg:h-0" />
        <div className="mask-b-from-4% mask-b-to-100% flex h-app-header w-full bg-background lg:hidden" />
      </div>
      <ChatContainerRoot className="relative w-full">
        <ChatContainerContent
          className="flex w-full flex-col items-center pt-20 pb-4"
          style={{
            scrollbarGutter: 'stable both-edges',
            scrollbarWidth: 'none',
          }}
        >
          {messages?.map((message, index) => {
            const isLast =
              index === messages.length - 1 && status !== 'submitted';
            const hasScrollAnchor =
              isLast && messages.length > initialMessageCount.current;

            const extendedMessage = message as ExtendedUIMessage;

            return (
              <Message
                attachments={
                  hasAttachments(extendedMessage)
                    ? extendedMessage.experimental_attachments
                    : undefined
                }
                hasScrollAnchor={hasScrollAnchor}
                id={message.id}
                isLast={isLast}
                key={message.id}
                langsmithRunId={extendedMessage.langsmithRunId ?? null}
                onDelete={onDelete}
                onEdit={onEdit}
                onQuote={onQuote}
                onReload={onReload}
                parts={extendedMessage.parts}
                status={status}
                variant={message.role}
              >
                {getMessageContent(extendedMessage)}
              </Message>
            );
          })}
          {(() => {
            const isActive = status === 'submitted' || status === 'streaming';
            if (!isActive || messages.length === 0) return null;
            const last = messages.at(-1) as ExtendedUIMessage | undefined;
            const lastIsUser = last?.role === 'user';
            const lastAssistantEmpty =
              last?.role === 'assistant' &&
              (!getMessageContent(last) ||
                getMessageContent(last).trim().length === 0);
            if (!(lastIsUser || lastAssistantEmpty)) return null;
            return (
              <div className="group flex min-h-scroll-anchor w-full max-w-3xl flex-col items-start gap-2 px-6 pb-2">
                <Loader />
              </div>
            );
          })()}
          <div className="absolute bottom-0 flex w-full max-w-3xl flex-1 items-end justify-end gap-4 px-6 pb-2">
            <ScrollButton className="absolute top-[-50px] right-[30px]" />
          </div>
        </ChatContainerContent>
      </ChatContainerRoot>
    </div>
  );
}

// Memoize the Conversation component to prevent re-renders when messages haven't changed
export const Conversation = memo(ConversationComponent, (prevProps, nextProps) => {
  return (
    prevProps.status === nextProps.status &&
    prevProps.messages.length === nextProps.messages.length &&
    prevProps.messages.every((msg, idx) => {
      const nextMsg = nextProps.messages[idx];
      return msg && nextMsg && msg.id === nextMsg.id && msg.content === nextMsg.content;
    })
  );
});
