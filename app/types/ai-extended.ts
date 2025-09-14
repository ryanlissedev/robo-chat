/**
 * Extended AI SDK types for v5 compatibility
 * Provides type-safe access to UIMessage properties and tool invocation types
 */

import type { UIMessage } from '@ai-sdk/react';
import type { Attachment } from '@/lib/file-handling';
import { extractTextContent, type MessagePart } from './message-parts';

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
interface ContentPart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface ExtendedUIMessage extends UIMessage {
  // v4 compatibility - content string
  content?: string | Array<ContentPart>;

  // Edge case - direct text property
  text?: string;

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
  context?: 'chat';
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
 * Extracts text content from AI SDK v5 messages
 */
export function getMessageContent(message: ExtendedUIMessage): string {
  // AI SDK v5 content array format (new)
  if (message.content && Array.isArray(message.content)) {
    return message.content
      .filter((part: ContentPart) => part.type === 'text')
      .map((part: ContentPart) => part.text)
      .join('');
  }

  // AI SDK v4 string content format
  if (typeof message.content === 'string') {
    return message.content;
  }

  // AI SDK v5 parts array format
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = extractTextContent(message.parts as MessagePart[]);
    if (textParts) {
      return textParts;
    }
  }

  // Handle direct text property (edge case)
  if (message.text) {
    return message.text as string;
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
