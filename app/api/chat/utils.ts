import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { getMessageContent } from '@/app/types/ai-extended';

// Constants
const DEFAULT_ERROR_STATUS_CODE = 500;


/**
 * Clean messages when switching between agents with different tool capabilities.
 * This removes tool invocations and tool-related content from messages when tools are not available
 * to prevent OpenAI API errors.
 */
export function cleanMessagesForTools(
  messages: ExtendedUIMessage[],
  hasTools: boolean
): ExtendedUIMessage[] {
  if (hasTools) {
    return messages;
  }

  // If no tools available, clean all tool-related content
  const cleanedMessages = messages
    .map((message) => {
      // Skip tool messages entirely when no tools are available
      if ((message as unknown as Record<string, unknown>).role === 'tool') {
        return null;
      }

      if (message.role === 'assistant') {
        // Use type-safe content extraction
        const contentText = getMessageContent(message);
        return {
          id: message.id,
          role: message.role,
          parts: [{ type: 'text', text: contentText }],
          content: contentText, // v4 compatibility
          createdAt: message.createdAt || new Date(),
        } as ExtendedUIMessage;
      }

      return message;
    })
    .filter((msg): msg is ExtendedUIMessage => msg !== null);

  // Ensure we have at least one message
  if (cleanedMessages.length === 0) {
    return [
      {
        id: 'fallback-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        content: 'Hello', // v4 compatibility
        createdAt: new Date(),
      } as ExtendedUIMessage,
    ];
  }

  // The last message should be from the user
  const lastMessage = cleanedMessages.at(-1);
  if (lastMessage && lastMessage.role !== 'user') {
    // Ensure last message is always from user for API requirements
    cleanedMessages.push({
      id: `user-fallback-${Date.now()}`,
      role: 'user',
      parts: [{ type: 'text', text: 'Continue' }],
      content: 'Continue', // v4 compatibility
      createdAt: new Date(),
    } as ExtendedUIMessage);
  }

  return cleanedMessages;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message?.includes('Incorrect API key')) {
      return 'Invalid API key. Please check your settings.';
    }
    if (error.message?.includes('rate limit')) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (error.message?.includes('context length')) {
      return 'Message too long. Please shorten your input.';
    }
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as {
      error?: { message?: string };
      message?: string;
      statusText?: string;
    };
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.message) {
      return err.message;
    }
    if (err.statusText) {
      return err.statusText;
    }
  }

  return 'An unexpected error occurred';
}

export function createErrorResponse(error: {
  code?: string;
  message?: string;
  statusCode?: number;
}) {
  const status = error.statusCode || DEFAULT_ERROR_STATUS_CODE;
  const message = error.message || 'Internal server error';

  return new Response(
    JSON.stringify({
      error: message,
      code: error.code,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
