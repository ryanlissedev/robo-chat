/**
 * Utility functions for processing and validating messages
 * Reduces duplicate message handling logic
 */

import type { ExtendedUIMessage } from '@/app/types/ai-extended';

export interface MessageValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedMessages?: ExtendedUIMessage[];
}

/**
 * Validate and sanitize messages array
 */
export function validateAndSanitizeMessages(
  messages: ExtendedUIMessage[]
): MessageValidationResult {
  if (!Array.isArray(messages)) {
    return {
      isValid: false,
      error: 'Messages must be an array',
    };
  }

  if (messages.length === 0) {
    return {
      isValid: false,
      error: 'Messages array cannot be empty',
    };
  }

  // Sanitize messages by filtering out invalid parts
  const sanitizedMessages = messages.map((msg) => ({
    ...msg,
    parts: msg.parts?.filter(Boolean) || [],
  }));

  // Validate that we have at least one valid message
  const validMessages = sanitizedMessages.filter(
    (msg) => msg.content || (msg.parts && msg.parts.length > 0)
  );

  if (validMessages.length === 0) {
    return {
      isValid: false,
      error: 'No valid messages found',
    };
  }

  return {
    isValid: true,
    sanitizedMessages: validMessages,
  };
}

/**
 * Get text content from a message
 * Handles multiple message formats:
 * - AI SDK v4: content is a string
 * - AI SDK v5: content is an array with text parts
 * - Parts format: message has parts array
 * - Direct text: message has text property
 */
export function getMessageContent(message: ExtendedUIMessage): string {
  // Handle string content (AI SDK v4)
  if (typeof message.content === 'string') {
    return message.content;
  }

  // Handle array content (AI SDK v5)
  if (Array.isArray(message.content)) {
    const textParts = (message.content as any[])
      .filter((part: any) => part.type === 'text' && part.text)
      .map((part: any) => part.text);
    return textParts.join('');
  }

  // Handle parts array format
  if (Array.isArray((message as any).parts)) {
    const parts = (message as any).parts;
    const textParts = parts
      .filter((part: any) => part && typeof part.text === 'string')
      .map((part: any) => part.text);
    return textParts.join('');
  }

  // Handle direct text property
  if (typeof (message as any).text === 'string') {
    return (message as any).text;
  }

  return '';
}

/**
 * Get the last user message from messages array
 */
export function getLastUserMessage(
  messages: ExtendedUIMessage[]
): ExtendedUIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i];
    }
  }
  return null;
}

/**
 * Get preview text from content (truncated)
 */
export function getPreview(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Count total tokens in messages (rough estimate)
 */
export function estimateTokenCount(messages: ExtendedUIMessage[]): number {
  let totalTokens = 0;

  for (const message of messages) {
    const content = getMessageContent(message);
    // Rough estimate: 1 token per 4 characters
    totalTokens += Math.ceil(content.length / 4);
  }

  return totalTokens;
}

/**
 * Filter messages by role
 */
export function filterMessagesByRole(
  messages: ExtendedUIMessage[],
  role: 'user' | 'assistant' | 'system'
): ExtendedUIMessage[] {
  return messages.filter((msg) => msg.role === role);
}

/**
 * Check if messages contain file attachments
 */
export function hasFileAttachments(messages: ExtendedUIMessage[]): boolean {
  return messages.some((msg) =>
    msg.parts?.some((part: any) => part.type === 'file')
  );
}

/**
 * Extract file attachments from messages
 */
export function extractFileAttachments(messages: ExtendedUIMessage[]): Array<{
  messageId: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
}> {
  const attachments: Array<{
    messageId: string;
    fileName: string;
    fileType: string;
    fileSize?: number;
  }> = [];

  for (const message of messages) {
    if (message.parts) {
      for (const part of message.parts) {
        if (part.type === 'file' && (part as any).file) {
          const filePart = part as any;
          attachments.push({
            messageId: message.id,
            fileName: filePart.file.name,
            fileType: filePart.file.type,
            fileSize: filePart.file.size,
          });
        }
      }
    }
  }

  return attachments;
}
