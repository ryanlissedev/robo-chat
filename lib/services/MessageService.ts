import type { UIDataTypes, UIMessagePart, UITools } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import type { ChatRequest, TransformedMessage } from './types';

// --- Minimal shapes & helpers ------------------------------------------------

type Role = 'system' | 'user' | 'assistant';

// UI Message types for content handling
type UIMessageContent = {
  content?: string;
  attachments?: unknown[]; // preserved for future use; not rendered here
  text?: string;
};

type MessagePart = UIMessagePart<UIDataTypes, UITools>;

type MinimalMessage = {
  id?: string;
  role?: string;
  content?: unknown;
  parts?: MessagePart[];
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object';

const isMessagePart = (v: unknown): v is MessagePart =>
  isObject(v) && typeof (v as Record<string, unknown>).type === 'string';

const toRole = (r?: string): Role => {
  if (r === 'system' || r === 'assistant' || r === 'user') return r;
  return 'user';
};

const createTextPart = (text: string): MessagePart => ({ type: 'text', text });

const fallbackTextForRole = (role?: string): string =>
  toRole(role) === 'assistant' ? '[Assistant response]' : '[User message]';

const firstTextFromParts = (parts: MessagePart[] = []): string => {
  const p = parts.find(
    (x) => isObject(x) && (x as Record<string, unknown>).type === 'text'
  );
  return p ? String((p as Record<string, unknown>).text ?? '') : '';
};

// Prefer crypto for better IDs; fallback to Math.random for legacy runtimes.
const genId = (radix = 36): string => {
  try {
    // 10 random bytes ≈ 16 chars in base36
    const cryptoObj: Crypto =
      globalThis.crypto ?? require('node:crypto').webcrypto;
    const arr = new Uint8Array(10);
    cryptoObj.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(radix).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  } catch {
    return Math.random().toString(radix).slice(2, 18);
  }
};

// --- Core content normalization ---------------------------------------------

/**
 * Convert any `content` shape into MessagePart[]:
 * - string -> single text part
 * - array  -> map each element: string => text part, MessagePart => keep, object => try to coerce, else stringify
 * - object -> UIMessageContent { text | content } => text part
 * - otherwise -> fallback text based on role
 */
const toMessageParts = (content: unknown, role?: string): MessagePart[] => {
  // string
  if (typeof content === 'string') return [createTextPart(content)];

  // array
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') return createTextPart(item);
      if (isMessagePart(item)) return item;
      if (isObject(item)) {
        // Best effort: treat as UIMessageContent-like
        const maybe = item as UIMessageContent;
        const text = maybe.text ?? maybe.content;
        if (typeof text === 'string') return createTextPart(text);
        return createTextPart(JSON.stringify(item));
      }
      return createTextPart(String(item ?? ''));
    });
  }

  // object (UIMessageContent-like)
  if (isObject(content)) {
    const maybe = content as UIMessageContent;
    const text = maybe.text ?? maybe.content ?? '';
    return [createTextPart(String(text))];
  }

  // null/undefined/other primitives -> role-aware fallback
  return [createTextPart(fallbackTextForRole(role))];
};

// --- Public service ---------------------------------------------------------

export class MessageService {
  /**
   * Validates a chat request
   */
  static validateChatRequest(request: ChatRequest): string | null {
    const { messages, chatId, userId } = request;
    if (!Array.isArray(messages) || messages.length === 0) {
      return 'Error, missing or invalid messages';
    }
    if (!chatId || !userId) {
      return 'Error, missing chatId or userId';
    }
    return null;
  }

  /**
   * Transforms a single message to v5 format
   */
  static transformMessageToV5Format(msg: unknown): TransformedMessage {
    // Handle invalid/non-object inputs
    if (!isObject(msg)) {
      return {
        role: 'user',
        parts: [createTextPart(String(msg ?? '[Invalid message]'))],
      };
    }

    const m = msg as MinimalMessage;

    // If message already has parts array, return with normalized role
    if (Array.isArray(m.parts)) {
      return {
        ...(m.id ? { id: m.id } : {}),
        role: toRole(m.role),
        parts: m.parts,
      };
    }

    // Convert any `content` to parts
    const parts = toMessageParts(m.content, m.role);

    return {
      ...(m.id ? { id: m.id } : {}),
      role: toRole(m.role),
      parts,
    };
  }

  /**
   * Transforms an array of messages to v5 format
   */
  static transformMessagesToV5Format(
    messages: ExtendedUIMessage[]
  ): TransformedMessage[] {
    // Accepts ExtendedUIMessage[], but robustly handles unknown shapes
    return (messages as unknown[]).map((msg) =>
      MessageService.transformMessageToV5Format(msg)
    );
  }

  /**
   * Filters out invalid messages (structural guard)
   */
  static filterValidMessages(
    messages: TransformedMessage[]
  ): TransformedMessage[] {
    return messages.filter(
      (msg): msg is TransformedMessage =>
        !!msg &&
        (msg.role === 'system' ||
          msg.role === 'user' ||
          msg.role === 'assistant') &&
        Array.isArray(msg.parts) &&
        msg.parts.length > 0
    );
  }

  /**
   * Converts TransformedMessage[] to ExtendedUIMessage[] for convertToModelMessages
   */
  static convertToExtendedUIMessages(
    messages: TransformedMessage[],
    radix: number = 36
  ): ExtendedUIMessage[] {
    const now = new Date();
    return messages.map((msg) => {
      const id = msg.id ?? genId(radix);
      const content = firstTextFromParts(msg.parts);
      return {
        id,
        role: msg.role,
        parts: (msg.parts ?? []) as UIMessagePart<UIDataTypes, UITools>[],
        createdAt: now, // same timestamp for a batch; stable and cheap
        content,
      };
    });
  }

  /**
   * Creates compatible messages for convertToModelMessages
   * - Ensures `parts` exists and is free of null/undefined.
   */
  static createCompatibleMessages(
    messages: ExtendedUIMessage[]
  ): ExtendedUIMessage[] {
    return messages.map((msg) => ({
      ...msg,
      parts: Array.isArray(msg.parts) ? msg.parts.filter(Boolean) : [],
    }));
  }
}
