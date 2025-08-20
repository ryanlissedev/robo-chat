import type { UIMessage as MessageType } from 'ai';
import { useState } from 'react';
import { MessageAssistant } from './message-assistant';
import { MessageUser } from './message-user';

type MessageProps = {
  variant: MessageType['role'];
  children: string;
  id: string;
  // attachments are represented as file parts in v5; keep prop for compatibility but unused
  attachments?: never;
  isLast?: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onReload: () => void;
  hasScrollAnchor?: boolean;
  parts?: MessageType['parts'];
  status?: 'streaming' | 'ready' | 'submitted' | 'error';
  className?: string;
  onQuote?: (text: string, messageId: string) => void;
};

export function Message({
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
}: MessageProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 500);
  };

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
        parts={parts}
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
      >
        {children}
      </MessageAssistant>
    );
  }

  return null;
}
