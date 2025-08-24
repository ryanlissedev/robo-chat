/**
 * Type definitions for message handling and chat functionality
 */

export interface MessageAttachment {
  name: string;
  contentType: string;
  url: string;
  size?: number;
}

export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface UserMessage extends BaseMessage {
  role: 'user';
  experimental_attachments?: MessageAttachment[];
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  reasoning?: string;
  sources?: string[];
  toolInvocations?: ToolInvocation[];
}

export interface SystemMessage extends BaseMessage {
  role: 'system';
}

export type Message = UserMessage | AssistantMessage | SystemMessage;

export interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: 'pending' | 'complete' | 'error';
}

export interface MessageContext {
  chatId: string;
  userId: string;
  model: string;
  isAuthenticated: boolean;
  systemPrompt?: string;
  enableSearch?: boolean;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface MessageError extends Error {
  code?: string;
  type?: string;
  details?: Record<string, unknown>;
}

export interface MessageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface OptimisticMessage {
  id: string;
  content: string;
  role: 'user';
  createdAt: Date;
  experimental_attachments?: MessageAttachment[];
}