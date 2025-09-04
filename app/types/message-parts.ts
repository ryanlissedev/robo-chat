/**
 * Type-safe message parts for AI SDK v5
 * Eliminates the need for 'any' types in components
 */

/**
 * Base message part interface
 */
export interface BaseMessagePart {
  type: string;
}

/**
 * Text content part
 */
export interface TextMessagePart extends BaseMessagePart {
  type: 'text';
  text: string;
}

/**
 * Text delta part (streaming)
 */
export interface TextDeltaMessagePart extends BaseMessagePart {
  type: 'text-delta';
  delta: string;
}

/**
 * Reasoning content part
 */
export interface ReasoningMessagePart extends BaseMessagePart {
  type: 'reasoning';
  text: string;
}

/**
 * Reasoning delta part (streaming)
 */
export interface ReasoningDeltaMessagePart extends BaseMessagePart {
  type: 'reasoning-delta';
  delta: string;
}

/**
 * Tool invocation part
 */
export interface ToolInvocationMessagePart extends BaseMessagePart {
  type: 'tool-invocation';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: 'partial-call' | 'call' | 'result';
  result?: unknown;
}

/**
 * Union type of all possible message parts
 */
export type MessagePart =
  | TextMessagePart
  | TextDeltaMessagePart
  | ReasoningMessagePart
  | ReasoningDeltaMessagePart
  | ToolInvocationMessagePart;

/**
 * Extended message interface with typed parts
 */
export interface TypedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  parts?: MessagePart[];
}

/**
 * Type guards for message parts
 */
export const isTextPart = (part: MessagePart): part is TextMessagePart =>
  part.type === 'text';

export const isTextDeltaPart = (
  part: MessagePart
): part is TextDeltaMessagePart => part.type === 'text-delta';

export const isReasoningPart = (
  part: MessagePart
): part is ReasoningMessagePart => part.type === 'reasoning';

export const isReasoningDeltaPart = (
  part: MessagePart
): part is ReasoningDeltaMessagePart => part.type === 'reasoning-delta';

export const isToolInvocationPart = (
  part: MessagePart
): part is ToolInvocationMessagePart => part.type === 'tool-invocation';

/**
 * Utility functions for extracting content
 */
export const extractTextContent = (parts: MessagePart[]): string => {
  return parts
    .filter(
      (part): part is TextMessagePart | TextDeltaMessagePart =>
        isTextPart(part) || isTextDeltaPart(part)
    )
    .map((part) => (isTextPart(part) ? part.text : part.delta))
    .join('');
};

export const extractReasoningContent = (parts: MessagePart[]): string => {
  return parts
    .filter(
      (part): part is ReasoningMessagePart | ReasoningDeltaMessagePart =>
        isReasoningPart(part) || isReasoningDeltaPart(part)
    )
    .map((part) => (isReasoningPart(part) ? part.text : part.delta))
    .join('');
};

/**
 * Generate stable keys for React rendering
 */
export const generatePartKey = (part: MessagePart, index: number): string => {
  if (isToolInvocationPart(part)) {
    return `${part.type}-${part.toolCallId}`;
  }
  return `${part.type}-${index}`;
};
