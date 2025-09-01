/**
 * Unit test for message content extraction
 * Tests the core getMessageContent function with various AI SDK formats
 */

import { describe, it, expect } from 'vitest';

// Import the function directly (not mocked)
import { getMessageContent } from '@/app/types/ai-extended';

describe('Message Content Extraction', () => {
  describe('AI SDK v5 Format', () => {
    it('should extract content from content array with text parts', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: [
          { type: 'text', text: 'Hello, ' },
          { type: 'text', text: 'how can I help you today?' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('Hello, how can I help you today?');
    });

    it('should filter out non-text parts from content array', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: [
          { type: 'text', text: 'Processing your request' },
          { type: 'tool-call', toolName: 'search', args: { query: 'test' } },
          { type: 'text', text: '... Done!' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('Processing your request... Done!');
    });

    it('should handle empty content array', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: [],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('');
    });
  });

  describe('AI SDK v4 Format', () => {
    it('should extract string content directly', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: 'This is a simple string response',
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('This is a simple string response');
    });

    it('should handle empty string content', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: '',
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('');
    });
  });

  describe('Parts Format', () => {
    it('should extract content from parts array', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        parts: [
          { type: 'text', text: 'First part ' },
          { type: 'text', text: 'second part' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('First part second part');
    });

    it('should handle parts with missing text', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        parts: [
          { type: 'text', text: 'Valid text' },
          { type: 'text' }, // Missing text property
          { type: 'text', text: ' continued' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('Valid text continued');
    });
  });

  describe('Edge Cases', () => {
    it('should handle message with no content properties', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('');
    });

    it('should handle null or undefined gracefully', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: null,
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('');
    });

    it('should handle message with text property directly', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        text: 'Direct text property',
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('Direct text property');
    });

    it('should prioritize string content over other formats', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: 'String content',
        parts: [{ type: 'text', text: 'Parts content' }],
        text: 'Direct text',
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('String content');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle complex assistant response with reasoning', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: [
          { type: 'reasoning', text: 'Let me think about this...' },
          { type: 'text', text: 'Based on my analysis, ' },
          { type: 'text', text: 'here is the solution:' },
          { type: 'code', language: 'javascript', code: 'console.log("hello")' },
          { type: 'text', text: ' This should work!' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('Based on my analysis, here is the solution: This should work!');
    });

    it('should handle user message format', () => {
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'What is the weather like?',
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('What is the weather like?');
    });

    it('should handle streaming partial message', () => {
      const message = {
        id: 'msg-1',
        role: 'assistant' as const,
        content: [
          { type: 'text', text: 'I am still thinking' },
          { type: 'text', text: '...' },
        ],
      };
      
      const content = getMessageContent(message as any);
      expect(content).toBe('I am still thinking...');
    });
  });
});