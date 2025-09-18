import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '@/components/app/chat/conversation';
import type { UIMessage } from '@ai-sdk/react';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import * as aiExtended from '@/app/types/ai-extended';

// Mock components are now handled in setup.ts

// Additional mock components can be added to setup.ts if needed globally

// AI type helper functions can be mocked in setup.ts if needed globally

const createMockMessage = (
  id: string,
  role: 'user' | 'assistant',
  content: string,
  options: Partial<ExtendedUIMessage> = {}
): UIMessage => ({
  id,
  role,
  content,
  createdAt: new Date(),
  ...options,
});

const defaultProps = {
  messages: [],
  status: 'ready' as const,
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  onReload: vi.fn(),
  onQuote: vi.fn(),
};

function renderConversation(props = {}) {
  return render(<Conversation {...defaultProps} {...props} />);
}

describe('Conversation (ChatMessages)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render empty div when no messages', () => {
      renderConversation({ messages: [] });

      const container = document.querySelector('.h-full.w-full');
      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('chat-container-root')).not.toBeInTheDocument();
    });

    it('should render empty div when messages is null', () => {
      renderConversation({ messages: null as any });

      const container = document.querySelector('.h-full.w-full');
      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('chat-container-root')).not.toBeInTheDocument();
    });

    it('should render empty div when messages is undefined', () => {
      renderConversation({ messages: undefined as any });

      const container = document.querySelector('.h-full.w-full');
      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('chat-container-root')).not.toBeInTheDocument();
    });
  });

  describe('Message Rendering', () => {
    it('should render single user message', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Hello, how are you?'),
      ];

      renderConversation({ messages });

      expect(screen.getByTestId('chat-container-root')).toBeInTheDocument();
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('Hello, how are you?');
    });

    it('should render single assistant message', () => {
      const messages = [
        createMockMessage('msg-1', 'assistant', 'I am doing well, thank you!'),
      ];

      renderConversation({ messages });

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('I am doing well, thank you!');
    });

    it('should render multiple messages in order', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Hello'),
        createMockMessage('msg-2', 'assistant', 'Hi there!'),
        createMockMessage('msg-3', 'user', 'How are you?'),
        createMockMessage('msg-4', 'assistant', 'I am doing well!'),
      ];

      renderConversation({ messages });

      const userMessages = screen.getAllByTestId('message-user');
      const assistantMessages = screen.getAllByTestId('message-assistant');

      expect(userMessages).toHaveLength(2);
      expect(assistantMessages).toHaveLength(2);

      // Check order
      const allMessages = screen.getAllByTestId(/^message-(user|assistant)$/);
      expect(allMessages[0]).toHaveAttribute('data-message-id', 'msg-1');
      expect(allMessages[1]).toHaveAttribute('data-message-id', 'msg-2');
      expect(allMessages[2]).toHaveAttribute('data-message-id', 'msg-3');
      expect(allMessages[3]).toHaveAttribute('data-message-id', 'msg-4');
    });
  });

  describe('Message States and Props', () => {
    it('should mark last message correctly', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'First message'),
        createMockMessage('msg-2', 'assistant', 'Second message'),
        createMockMessage('msg-3', 'user', 'Last message'),
      ];

      renderConversation({ messages, status: 'ready' });

      const userMessages = screen.getAllByTestId('message-user');
      const firstMessage = userMessages[0];
      const lastMessage = userMessages[1];

      expect(firstMessage).toHaveAttribute('data-is-last', 'false');
      expect(lastMessage).toHaveAttribute('data-is-last', 'true');
    });

    it('should not mark last message as last when status is submitted', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Message'),
      ];

      renderConversation({ messages, status: 'submitted' });

      const message = screen.getByTestId('message-user');
      expect(message).toHaveAttribute('data-is-last', 'false');
    });

    it('should handle scroll anchor for new messages', () => {
      const { rerender } = renderConversation({
        messages: [createMockMessage('msg-1', 'user', 'First')],
      });

      // Add a new message
      const updatedMessages = [
        createMockMessage('msg-1', 'user', 'First'),
        createMockMessage('msg-2', 'assistant', 'Second'),
      ];

      rerender(<Conversation {...defaultProps} messages={updatedMessages} />);

      const lastMessage = screen.getByTestId('message-assistant');
      expect(lastMessage).toHaveAttribute('data-has-scroll-anchor', 'true');
    });
  });

  describe('Message Attachments', () => {
    it('should pass attachments to messages with attachments', () => {
      vi.mocked(aiExtended.hasAttachments).mockReturnValue(true);

      const messages = [
        createMockMessage('msg-1', 'user', 'Message with attachment', {
          experimental_attachments: [
            { name: 'file.txt', contentType: 'text/plain', url: 'file.txt' },
          ],
        }),
      ];

      renderConversation({ messages });

      expect(screen.getByTestId('message-attachments')).toBeInTheDocument();
      expect(screen.getByTestId('attachment-0')).toHaveTextContent('file.txt');
    });

    it('should not render attachments for messages without them', () => {
      vi.mocked(aiExtended.hasAttachments).mockReturnValue(false);

      const messages = [
        createMockMessage('msg-1', 'user', 'Message without attachment'),
      ];

      renderConversation({ messages });

      expect(screen.queryByTestId('message-attachments')).not.toBeInTheDocument();
    });
  });

  describe('Message Parts', () => {
    it('should pass parts to messages with parts', () => {
      const messages = [
        createMockMessage('msg-1', 'assistant', 'Assistant message', {
          parts: [
            { type: 'text', text: 'Hello' },
            { type: 'tool-call', toolName: 'search', toolCallId: 'call-1' },
          ],
        }),
      ];

      renderConversation({ messages });

      expect(screen.getByTestId('message-parts')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toHaveAttribute('data-part-type', 'text');
      expect(screen.getByTestId('part-1')).toHaveAttribute('data-part-type', 'tool-call');
    });
  });

  describe('Loading State', () => {
    it('should show loader when status is submitted after user message', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'User question'),
      ];

      renderConversation({ messages, status: 'submitted' });

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should show loader when status is streaming after user message', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'User question'),
      ];

      renderConversation({ messages, status: 'streaming' });

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should show loader when last assistant message is empty and streaming', () => {
      vi.mocked(aiExtended.getMessageContent).mockReturnValue('');

      const messages = [
        createMockMessage('msg-1', 'user', 'User question'),
        createMockMessage('msg-2', 'assistant', ''),
      ];

      renderConversation({ messages, status: 'streaming' });

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should not show loader when status is ready', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'User question'),
      ];

      renderConversation({ messages, status: 'ready' });

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });

    it('should not show loader when last message is not user or empty assistant', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'User question'),
        createMockMessage('msg-2', 'assistant', 'Complete response'),
      ];

      renderConversation({ messages, status: 'submitted' });

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
  });

  describe('Scroll Button', () => {
    it('should render scroll button', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Message'),
      ];

      renderConversation({ messages });

      expect(screen.getByTestId('scroll-button')).toBeInTheDocument();
    });
  });

  describe('Message Actions', () => {
    it('should handle delete action', async () => {
      const onDelete = vi.fn();
      const messages = [
        createMockMessage('msg-1', 'user', 'Message to delete'),
      ];

      renderConversation({ messages, onDelete });

      const deleteButton = screen.getByTestId('delete-button');
      deleteButton.click();

      expect(onDelete).toHaveBeenCalledWith('msg-1');
    });

    it('should handle edit action', async () => {
      const onEdit = vi.fn();
      const messages = [
        createMockMessage('msg-1', 'user', 'Message to edit'),
      ];

      renderConversation({ messages, onEdit });

      const editButton = screen.getByTestId('edit-button');
      editButton.click();

      expect(onEdit).toHaveBeenCalledWith('msg-1', 'edited');
    });

    it('should handle reload action', async () => {
      const onReload = vi.fn();
      const messages = [
        createMockMessage('msg-1', 'assistant', 'Message to reload'),
      ];

      renderConversation({ messages, onReload });

      const reloadButton = screen.getByTestId('reload-button');
      reloadButton.click();

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('should handle quote action', async () => {
      const onQuote = vi.fn();
      const messages = [
        createMockMessage('msg-1', 'assistant', 'Message to quote'),
      ];

      renderConversation({ messages, onQuote });

      const quoteButton = screen.getByTestId('quote-button');
      quoteButton.click();

      expect(onQuote).toHaveBeenCalledWith('quoted text', 'msg-1');
    });
  });

  describe('LangSmith Integration', () => {
    it('should pass langsmithRunId to messages', () => {
      const messages = [
        createMockMessage('msg-1', 'assistant', 'Message with run ID', {
          langsmithRunId: 'run-123',
        }),
      ];

      renderConversation({ messages });

      const message = screen.getByTestId('message-assistant');
      expect(message).toHaveAttribute('data-langsmith-run-id', 'run-123');
    });

    it('should handle null langsmithRunId', () => {
      const messages = [
        createMockMessage('msg-1', 'assistant', 'Message without run ID', {
          langsmithRunId: null,
        }),
      ];

      renderConversation({ messages });

      const message = screen.getByTestId('message-assistant');
      expect(message).toHaveAttribute('data-langsmith-run-id', 'null');
    });
  });

  describe('Performance and Memoization', () => {
    it('should not re-render when messages have not changed', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Static message'),
      ];

      const { rerender } = renderConversation({ messages });

      // Re-render with same messages
      rerender(<Conversation {...defaultProps} messages={messages} />);

      // Should still render correctly
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });

    it('should handle large number of messages', () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) =>
        createMockMessage(`msg-${i}`, i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
      );

      expect(() => renderConversation({ messages: manyMessages })).not.toThrow();

      const userMessages = screen.getAllByTestId('message-user');
      const assistantMessages = screen.getAllByTestId('message-assistant');

      expect(userMessages.length + assistantMessages.length).toBe(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle messages with missing properties', () => {
      const incompleteMessage = {
        id: 'incomplete',
        role: 'user',
        // missing content and other properties
      } as UIMessage;

      const messages = [incompleteMessage];

      expect(() => renderConversation({ messages })).not.toThrow();
    });

    it('should handle invalid message roles gracefully', () => {
      const invalidMessage = createMockMessage('msg-1', 'invalid' as any, 'Invalid role');

      const messages = [invalidMessage];

      expect(() => renderConversation({ messages })).not.toThrow();
    });

    it('should handle missing callback functions', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Message'),
      ];

      const props = {
        messages,
        status: 'ready' as const,
        onDelete: undefined as any,
        onEdit: undefined as any,
        onReload: undefined as any,
        onQuote: undefined as any,
      };

      expect(() => renderConversation(props)).not.toThrow();
    });
  });

  describe('Layout and Styling', () => {
    it('should apply correct container classes', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Message'),
      ];

      renderConversation({ messages });

      const chatContainer = screen.getByTestId('chat-container-content');
      expect(chatContainer).toHaveClass(
        'flex',
        'w-full',
        'flex-col',
        'items-center',
        'pt-20',
        'pb-4'
      );
    });

    it('should apply scroll styles', () => {
      const messages = [
        createMockMessage('msg-1', 'user', 'Message'),
      ];

      renderConversation({ messages });

      const chatContainer = screen.getByTestId('chat-container-content');
      expect(chatContainer).toHaveStyle({
        scrollbarGutter: 'stable both-edges',
        scrollbarWidth: 'none',
      });
    });
  });
});