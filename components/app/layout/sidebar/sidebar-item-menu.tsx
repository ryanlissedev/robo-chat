import { MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { useChatSession } from '@/lib/chat-store/session/provider';
import type { Chat } from '@/lib/chat-store/types';
import { DialogDeleteChat } from './dialog-delete-chat';

type SidebarItemMenuProps = {
  chat: Chat;
  onStartEditing: () => void;
  onMenuOpenChange?: (open: boolean) => void;
};

export function SidebarItemMenu({
  chat,
  onStartEditing,
  onMenuOpenChange,
}: SidebarItemMenuProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const { deleteMessages } = useMessages();
  const { deleteChat } = useChats();
  const { chatId } = useChatSession();
  const isMobile = useBreakpoint(768);

  const handleConfirmDelete = async () => {
    await deleteMessages();
    await deleteChat(chat.id, chatId || chat.id, () => router.push('/'));
  };

  return (
    <>
      <DropdownMenu
        // shadcn/ui / radix pointer-events-none issue
        modal={!!isMobile}
        onOpenChange={onMenuOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-md p-1 transition-colors duration-150 hover:bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="text-primary" size={18} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              onStartEditing();
            }}
          >
            <Pencil className="mr-2" size={16} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDeleteDialogOpen(true);
            }}
            variant="destructive"
          >
            <Trash className="mr-2" size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogDeleteChat
        chatTitle={chat.title || 'Untitled chat'}
        isOpen={isDeleteDialogOpen}
        onConfirmDelete={handleConfirmDelete}
        setIsOpen={setIsDeleteDialogOpen}
      />
    </>
  );
}
