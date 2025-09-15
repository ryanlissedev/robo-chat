import React from 'react';
import type { UIMessage as MessageType } from '@ai-sdk/react';
import { memo, useCallback, useState } from 'react';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { MessageAssistant } from './message-assistant';
import { MessageUser } from './message-user';

type MessageProps = {
  variant: MessageType['role'];
  children: string;
  id: string;
  attachments?: ExtendedUIMessage['experimental_attachments'];
  isLast?: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onReload: () => void;
  hasScrollAnchor?: boolean;
  parts?: ExtendedUIMessage['parts'];
  status?: 'streaming' | 'ready' | 'submitted' | 'error';
  className?: string;
  onQuote?: (text: string, messageId: string) => void;
  langsmithRunId?: string | null;
};

function MessageComponent({
  variant,
  children,
  id,
  attachments,
  isLast,
  onDelete,
  onEdit,
  onReload,
  hasScrollAnchor,
  parts,
  status,
  className,
  onQuote,
  langsmithRunId,
}: MessageProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 500);
  }, [children]);

  if (variant === 'user') {
    return (
      <MessageUser
        attachments={attachments}
        className={className}
        copied={copied}
        copyToClipboard={copyToClipboard}
        hasScrollAnchor={hasScrollAnchor}
        id={id}
        onDelete={onDelete}
        onEdit={onEdit}
        onReload={onReload}
      >
        {children}
      </MessageUser>
    );
  }

  if (variant === 'assistant') {
    return (
      <MessageAssistant
        className={className}
        copied={copied}
        copyToClipboard={copyToClipboard}
        hasScrollAnchor={hasScrollAnchor}
        isLast={isLast}
        messageId={id}
        onQuote={onQuote}
        onReload={onReload}
        parts={parts}
        status={status}
        langsmithRunId={langsmithRunId || undefined}
      >
        {children}
      </MessageAssistant>
    );
  }

  return null;
}

// Memoize the Message component to prevent unnecessary re-renders
// Only re-render when props actually change
export const Message = memo(MessageComponent, (prevProps, nextProps) => {
  // Custom equality check for better performance
  return (
    prevProps.id === nextProps.id &&
    prevProps.children === nextProps.children &&
    prevProps.variant === nextProps.variant &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.status === nextProps.status &&
    prevProps.hasScrollAnchor === nextProps.hasScrollAnchor &&
    JSON.stringify(prevProps.attachments) ===
      JSON.stringify(nextProps.attachments) &&
    JSON.stringify(prevProps.parts) === JSON.stringify(nextProps.parts)
  );
});
