/**
 * Comprehensive unit tests for chat utility functions
 * Ensuring 100% test coverage for production validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cleanMessagesForTools,
  extractErrorMessage,
  createErrorResponse,
} from '@/app/api/chat/utils';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';

// Mock the getMessageContent function
vi.mock('@/app/types/ai-extended', () => ({
  getMessageContent: vi.fn((message: ExtendedUIMessage) => {
    // Mock implementation that extracts text from message
    if (typeof message.content === 'string') {
      return message.content;
    }
    if (message.parts && message.parts.length > 0) {
      return message.parts
        .filter(part => part.type === 'text')
        .map(part => part.text)
        .join(' ');
    }
    return 'Default content';
  }),
}));

import { getMessageContent } from '@/app/types/ai-extended';

describe('Chat Utils Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanMessagesForTools', () => {
    const sampleUserMessage: ExtendedUIMessage = {
      id: 'user-1',
      role: 'user',
      content: 'Hello, how are you?',
      parts: [{ type: 'text', text: 'Hello, how are you?' }],
      createdAt: new Date('2024-01-01T10:00:00Z'),
    };

    const sampleAssistantMessage: ExtendedUIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      content: 'I am doing well, thank you!',
      parts: [{ type: 'text', text: 'I am doing well, thank you!' }],
      createdAt: new Date('2024-01-01T10:01:00Z'),
    };

    const sampleToolMessage = {
      id: 'tool-1',
      role: 'tool',
      content: 'Tool result',
      toolCallId: 'call-123',
      createdAt: new Date('2024-01-01T10:02:00Z'),
    } as unknown as ExtendedUIMessage;

    it('should return messages unchanged when tools are available', () => {
      const messages = [sampleUserMessage, sampleAssistantMessage, sampleToolMessage];
      
      const result = cleanMessagesForTools(messages, true);
      
      expect(result).toEqual(messages);
      expect(result).toHaveLength(3);
    });

    it('should filter out tool messages when tools are not available', () => {
      const messages = [sampleUserMessage, sampleAssistantMessage, sampleToolMessage];
      
      const result = cleanMessagesForTools(messages, false);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(sampleUserMessage);
      expect(result[1].role).toBe('assistant');
      expect(getMessageContent).toHaveBeenCalledWith(sampleAssistantMessage);
    });

    it('should clean assistant messages by removing tool invocations', () => {
      const assistantWithToolInvocation: ExtendedUIMessage = {
        id: 'assistant-2',
        role: 'assistant',
        content: 'Let me search for that information.',
        parts: [
          { type: 'text', text: 'Let me search for that information.' },
          { type: 'tool-call', toolCallId: 'call-123', toolName: 'search', args: {} },
        ],
        createdAt: new Date('2024-01-01T10:03:00Z'),
      };

      vi.mocked(getMessageContent).mockReturnValue('Let me search for that information.');

      const messages = [sampleUserMessage, assistantWithToolInvocation];
      
      const result = cleanMessagesForTools(messages, false);
      
      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({
        id: 'assistant-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Let me search for that information.' }],
        content: 'Let me search for that information.',
        createdAt: assistantWithToolInvocation.createdAt,
      });
    });

    it('should add fallback message when all messages are filtered out', () => {
      const messages = [sampleToolMessage];
      
      const result = cleanMessagesForTools(messages, false);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'fallback-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        content: 'Hello',
        createdAt: expect.any(Date),
      });
    });

    it('should ensure last message is from user', () => {
      const messages = [sampleUserMessage, sampleAssistantMessage];
      
      const result = cleanMessagesForTools(messages, false);
      
      // Should add a user fallback message at the end
      expect(result).toHaveLength(3);
      expect(result[result.length - 1].role).toBe('user');
      expect(result[result.length - 1].content).toBe('Continue');
      expect(result[result.length - 1].id).toMatch(/^user-fallback-/);
    });

    it('should not add fallback user message if last message is already from user', () => {
      const messages = [sampleAssistantMessage, sampleUserMessage];
      
      const result = cleanMessagesForTools(messages, false);
      
      expect(result).toHaveLength(2);
      expect(result[result.length - 1]).toEqual(sampleUserMessage);
    });

    it('should handle empty messages array', () => {
      const result = cleanMessagesForTools([], false);
      
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('Hello');
    });

    it('should handle messages without createdAt property', () => {
      const messageWithoutDate: ExtendedUIMessage = {
        id: 'user-2',
        role: 'user',
        content: 'Test message',
        parts: [{ type: 'text', text: 'Test message' }],
      } as ExtendedUIMessage;

      const result = cleanMessagesForTools([messageWithoutDate], false);
      
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle assistant messages with complex content structures', () => {
      const complexAssistantMessage: ExtendedUIMessage = {
        id: 'assistant-3',
        role: 'assistant',
        content: '',
        parts: [
          { type: 'text', text: 'Here is the answer: ' },
          { type: 'text', text: '42' },
        ],
        createdAt: new Date(),
      };

      vi.mocked(getMessageContent).mockReturnValue('Here is the answer: 42');

      const result = cleanMessagesForTools([complexAssistantMessage], false);
      
      expect(result[0].content).toBe('Here is the answer: 42');
      expect(result[0].parts).toEqual([{ type: 'text', text: 'Here is the answer: 42' }]);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Something went wrong');
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Something went wrong');
    });

    it('should handle specific error patterns - API key error', () => {
      const error = new Error('Incorrect API key provided for OpenAI');
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Invalid API key. Please check your settings.');
    });

    it('should handle specific error patterns - rate limit error', () => {
      const error = new Error('Rate limit exceeded. Please try again later');
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Rate limit exceeded. Please try again later.');
    });

    it('should handle specific error patterns - context length error', () => {
      const error = new Error('Maximum context length exceeded');
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Message too long. Please shorten your input.');
    });

    it('should extract message from object with nested error', () => {
      const error = {
        error: {
          message: 'Network timeout occurred'
        }
      };
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Network timeout occurred');
    });

    it('should extract message from object with direct message property', () => {
      const error = {
        message: 'Direct error message'
      };
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Direct error message');
    });

    it('should extract message from object with statusText property', () => {
      const error = {
        statusText: 'Internal Server Error'
      };
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Internal Server Error');
    });

    it('should handle string errors', () => {
      const error = 'Simple string error';
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Simple string error');
    });

    it('should return default message for unknown error types', () => {
      const error = 42; // Number as error
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('An unexpected error occurred');
    });

    it('should return default message for null error', () => {
      const error = null;
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('An unexpected error occurred');
    });

    it('should handle object with all undefined properties', () => {
      const error = {
        error: undefined,
        message: undefined,
        statusText: undefined,
      };
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('An unexpected error occurred');
    });

    it('should handle Error instance with undefined message', () => {
      const error = new Error();
      error.message = undefined as any;
      
      const result = extractErrorMessage(error);
      
      expect(result).toBeUndefined();
    });

    it('should prioritize nested error message over direct message', () => {
      const error = {
        error: {
          message: 'Nested error message'
        },
        message: 'Direct message'
      };
      
      const result = extractErrorMessage(error);
      
      expect(result).toBe('Nested error message');
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with all properties', () => {
      const error = {
        code: 'INVALID_INPUT',
        message: 'The input provided is invalid',
        statusCode: 400,
      };
      
      const response = createErrorResponse(error);
      
      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed).toEqual({
          error: 'The input provided is invalid',
          code: 'INVALID_INPUT',
        });
      });
    });

    it('should use default status code when not provided', () => {
      const error = {
        message: 'Something went wrong'
      };
      
      const response = createErrorResponse(error);
      
      expect(response.status).toBe(500);
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed).toEqual({
          error: 'Something went wrong',
          code: undefined,
        });
      });
    });

    it('should use default message when not provided', () => {
      const error = {
        statusCode: 404
      };
      
      const response = createErrorResponse(error);
      
      expect(response.status).toBe(404);
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed).toEqual({
          error: 'Internal server error',
          code: undefined,
        });
      });
    });

    it('should handle empty error object', () => {
      const error = {};
      
      const response = createErrorResponse(error);
      
      expect(response.status).toBe(500);
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed).toEqual({
          error: 'Internal server error',
          code: undefined,
        });
      });
    });

    it('should set correct content type header', () => {
      const error = { message: 'Test error' };
      
      const response = createErrorResponse(error);
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle zero status code', () => {
      const error = {
        statusCode: 0,
        message: 'Network error'
      };
      
      const response = createErrorResponse(error);
      
      expect(response.status).toBe(0);
    });

    it('should include code in response when provided', () => {
      const error = {
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
        statusCode: 401,
      };
      
      const response = createErrorResponse(error);
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed.code).toBe('AUTH_FAILED');
      });
    });

    it('should handle undefined code properly', () => {
      const error = {
        message: 'Test error',
        code: undefined,
      };
      
      const response = createErrorResponse(error);
      
      return response.text().then(body => {
        const parsed = JSON.parse(body);
        expect(parsed.code).toBeUndefined();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex message cleaning scenario', () => {
      const messages: ExtendedUIMessage[] = [
        {
          id: 'user-1',
          role: 'user',
          content: 'Please search for information about AI',
          parts: [{ type: 'text', text: 'Please search for information about AI' }],
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'tool-1',
          role: 'tool' as any,
          content: 'Search results: AI is...',
          createdAt: new Date('2024-01-01T10:01:00Z'),
        } as ExtendedUIMessage,
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Based on the search results, AI stands for...',
          parts: [{ type: 'text', text: 'Based on the search results, AI stands for...' }],
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];

      vi.mocked(getMessageContent).mockReturnValue('Based on the search results, AI stands for...');

      const result = cleanMessagesForTools(messages, false);

      // Should remove tool message and clean assistant message
      expect(result).toHaveLength(3); // user + cleaned assistant + fallback user
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');
      expect(result[2].role).toBe('user'); // fallback user message
      expect(result[2].content).toBe('Continue');
    });

    it('should handle error extraction with complex nested structure', () => {
      const complexError = {
        response: {
          data: {
            error: {
              message: 'Deeply nested error message'
            }
          }
        },
        message: 'Top level message',
        statusText: 'Bad Request'
      };

      // Should prioritize the direct message property
      const result = extractErrorMessage(complexError);
      expect(result).toBe('Top level message');
    });
  });
});