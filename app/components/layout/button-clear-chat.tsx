'use client';

import { TrashIcon } from '@phosphor-icons/react/dist/ssr';
import { useState } from 'react';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { DialogClearChat } from './dialog-clear-chat';

export function ButtonClearChat() {
  const { chatId } = useChatSession();
  const { messages } = useMessages();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't show the button if there's no chat or no messages
  if (!chatId || messages.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="clear-chat-button"
            aria-label="Clear Chat"
            className="rounded-full bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setIsDialogOpen(true)}
            type="button"
          >
            <TrashIcon size={24} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Clear Chat</TooltipContent>
      </Tooltip>

      <DialogClearChat
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
      />
    </>
  );
}