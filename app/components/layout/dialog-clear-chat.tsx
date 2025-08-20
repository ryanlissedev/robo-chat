'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMessages } from '@/lib/chat-store/messages/provider';

type DialogClearChatProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
};

export function DialogClearChat({
  isOpen,
  setIsOpen,
}: DialogClearChatProps) {
  const { resetMessages } = useMessages();

  const handleConfirmClear = async () => {
    setIsOpen(false);
    await resetMessages();
  };

  return (
    <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
      <AlertDialogContent data-testid="confirm-clear-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Clear chat?</AlertDialogTitle>
          <AlertDialogDescription>
            This will clear all messages from the current chat. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            data-testid="confirm-clear-button"
            onClick={handleConfirmClear}
          >
            Clear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}