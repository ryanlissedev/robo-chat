/**
 * Extended AI SDK types for v5 compatibility
 * Provides type-safe access to UIMessage properties and tool invocation types
 */

import type { UIMessage } from '@ai-sdk/react';
import type { Attachment } from '@/lib/file-handling';

/**
 * Reasoning UI part for AI SDK v5 compatibility
 */
export interface ReasoningUIPart {
  type: 'reasoning';
  text: string;
}

/**
 * Source URL UI part for AI SDK v5 compatibility
 */
export interface SourceUrlUIPart {
  type: 'source-url';
  url: string;
  source?: string;
}

/**
 * Extended UIMessage interface that safely handles both v4 and v5 message formats
 */
export interface ExtendedUIMessage extends UIMessage {
  // v4 compatibility - content string
  content?: string;

  // Experimental attachments for file handling
  experimental_attachments?: Attachment[];

  // Custom properties for chat functionality
  model?: string;
  provider?: string;
  reasoning?: Array<{
    type: 'text';
    text: string;
  }>;

  // LangSmith run id (if available) to allow submitting feedback
  langsmithRunId?: string | null;

  // v5 compatibility - add missing properties
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Chat request interface for API endpoints
 */
export interface ChatRequest {
  messages: ExtendedUIMessage[];
  chatId: string;
  userId: string;
  model: string;
  isAuthenticated: boolean;
  systemPrompt: string;
  enableSearch: boolean;
  message_group_id?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  reasoningSummary?: 'auto' | 'detailed';
  context?: 'chat' | 'voice';
  personalityMode?:
    | 'safety-focused'
    | 'technical-expert'
    | 'friendly-assistant';
}

/**
 * Tool invocation UI part interface for AI SDK v5 compatibility
 * Custom interface that extends the AI SDK's built-in tool parts
 * This allows our components to work with both custom and AI SDK tool data
 */
export interface ToolInvocationUIPart {
  type: 'tool-invocation';
  toolCallId: string;
  state: 'partial-call' | 'call' | 'result';
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

/**
 * Legacy tool invocation structure for backward compatibility
 * @deprecated Use ToolInvocationUIPart directly instead
 */
export interface LegacyToolInvocationUIPart {
  type: 'tool-invocation';
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    state: 'partial-call' | 'call' | 'result';
    result?: unknown;
  };
}

/**
 * Type guard to check if a message has content property
 */
export function hasContent(
  message: ExtendedUIMessage
): message is ExtendedUIMessage & { content: string } {
  return typeof message.content === 'string';
}

/**
 * Type guard to check if a message has parts property
 */
export function hasParts(
  message: ExtendedUIMessage
): message is ExtendedUIMessage & {
  parts: NonNullable<ExtendedUIMessage['parts']>;
} {
  return Array.isArray(message.parts) && message.parts.length > 0;
}

/**
 * Type guard to check if a message has experimental attachments
 */
export function hasAttachments(
  message: ExtendedUIMessage
): message is ExtendedUIMessage & { experimental_attachments: Attachment[] } {
  return (
    Array.isArray(message.experimental_attachments) &&
    message.experimental_attachments.length > 0
  );
}

/**
 * Safely extracts text content from a message, handling both v4 and v5 formats
 */
export function getMessageContent(message: ExtendedUIMessage): string {
  // First check if message has direct content property as string (v4 compatibility)
  if (hasContent(message)) {
    return message.content;
  }

  // AI SDK v5 format - content can be an array of content parts
  if ('content' in message && Array.isArray(message.content)) {
    const textContent = message.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || '')
      .join('');
    if (textContent) {
      return textContent;
    }
  }

  // Check if message has parts array (v5 format - primary way AI SDK v5 stores message content)
  if (hasParts(message)) {
    const textParts = message.parts.filter(
      (part) => part.type === 'text' && 'text' in part
    );
    const textContent = textParts
      .map((part) => {
        // Ensure we're correctly accessing the text property
        if ('text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('');
    if (textContent) {
      return textContent;
    }
  }

  // AI SDK v5 might store content directly in message.text
  if ('text' in message && typeof (message as any).text === 'string') {
    return (message as any).text;
  }

  // Debug: Log if we couldn't extract content from assistant messages
  if (typeof window !== 'undefined' && message.role === 'assistant' && message.parts?.length) {
    console.warn('Could not extract content from message:', {
      id: message.id,
      role: message.role,
      partsCount: message.parts?.length,
      firstPart: message.parts?.[0]
    });
  }

  return '';
}

/**
 * Safely extracts reasoning from a message
 */
export function getMessageReasoning(
  message: ExtendedUIMessage
): Array<{ type: 'text'; text: string }> | undefined {
  return message.reasoning;
}

/**
 * Extended UseChatOptions interface for v5 compatibility
 */
export interface ExtendedUseChatOptions {
  id?: string;
  api?: string;
  initialMessages?: ExtendedUIMessage[];
  onFinish?: (message: ExtendedUIMessage) => void;
  onError?: (error: Error) => void;
  body?: Record<string, unknown>;
  experimental_attachments?: Attachment[];
}
