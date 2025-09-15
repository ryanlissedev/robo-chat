import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageAssistant } from '@/components/app/chat/message-assistant';
import type { UIMessage } from '@ai-sdk/react';

// Mock the user preferences provider
const mockPreferences = {
  showToolInvocations: true,
  multiModelEnabled: false,
};

vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({ preferences: mockPreferences }),
}));

// Mock the quote button component
vi.mock('@/components/app/chat/quote-button', () => ({
  QuoteButton: ({ onQuote, onDismiss }: any) => (
    <div data-testid="quote-button">
      <button type="button" onClick={onQuote}>
        Quote
      </button>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  ),
}));

// Mock the smooth streaming message component
vi.mock('@/components/app/chat/smooth-streaming-message', () => ({
  SmoothStreamingMessage: ({ text, sources }: any) => (
    <div data-testid="smooth-streaming-message">
      <div data-testid="message-text">{text}</div>
      {sources?.map((source: any, index: number) => (
        <div key={index} data-testid={`source-${index}`}>
          {source.title}
        </div>
      ))}
    </div>
  ),
}));

// Mock the message feedback component
vi.mock('@/components/app/chat/message-feedback', () => ({
  MessageFeedback: ({ messageId, langsmithRunId }: any) => (
    <div data-testid="message-feedback" data-message-id={messageId} data-langsmith-run-id={langsmithRunId}>
      Feedback
    </div>
  ),
}));

// Mock the search images component
vi.mock('@/components/app/chat/search-images', () => ({
  SearchImages: ({ results }: any) => (
    <div data-testid="search-images">
      {results?.map((result: any, index: number) => (
        <div key={index} data-testid={`image-result-${index}`}>
          {result.title}
        </div>
      ))}
    </div>
  ),
}));

// Mock the AI elements
vi.mock('@/components/ai-elements/reasoning', () => ({
  Reasoning: ({ children, defaultOpen, isStreaming }: any) => (
    <div data-testid="reasoning" data-default-open={defaultOpen} data-streaming={isStreaming}>
      {children}
    </div>
  ),
  ReasoningTrigger: () => <button data-testid="reasoning-trigger">Reasoning</button>,
  ReasoningContent: ({ children }: any) => <div data-testid="reasoning-content">{children}</div>,
}));

vi.mock('@/components/ai-elements/source', () => ({
  Sources: ({ children }: any) => <div data-testid="sources">{children}</div>,
  SourcesTrigger: ({ count }: any) => (
    <button data-testid="sources-trigger">Sources ({count})</button>
  ),
  SourcesContent: ({ children }: any) => <div data-testid="sources-content">{children}</div>,
  Source: ({ href, title, index }: any) => (
    <a href={href} data-testid={`source-${index}`}>
      {title}
    </a>
  ),
}));

vi.mock('@/components/ai-elements/tool', () => ({
  Tool: ({ children }: any) => <div data-testid="tool">{children}</div>,
  ToolContent: ({ children }: any) => <div data-testid="tool-content">{children}</div>,
  ToolHeader: ({ state, type }: any) => (
    <div data-testid="tool-header" data-state={state} data-type={type}>
      Tool Header
    </div>
  ),
  ToolInput: ({ input }: any) => (
    <div data-testid="tool-input">{JSON.stringify(input)}</div>
  ),
  ToolOutput: ({ output, errorText }: any) => (
    <div data-testid="tool-output" data-error={errorText}>
      {output}
    </div>
  ),
}));

// Mock the prompt-kit message components
vi.mock('@/components/prompt-kit/message', () => ({
  Message: ({ children, className }: any) => (
    <div data-testid="message-container" className={className}>
      {children}
    </div>
  ),
  MessageActions: ({ children, className }: any) => (
    <div data-testid="message-actions" className={className}>
      {children}
    </div>
  ),
  MessageAction: ({ children, tooltip, side }: any) => (
    <div data-testid="message-action" data-tooltip={tooltip} data-side={side}>
      {children}
    </div>
  ),
}));

// Mock the toast component
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

// Mock the get-sources helper
const mockGetSources = vi.fn((parts: any[]) => [
  { id: '1', url: 'https://example.com', title: 'Example Source' },
]);

vi.mock('@/components/app/chat/get-sources', () => ({
  getSources: mockGetSources,
}));

// Mock the selection hook
const mockUseAssistantMessageSelection = vi.fn(() => ({
  selectionInfo: null,
  clearSelection: vi.fn(),
}));

vi.mock('@/components/app/chat/useAssistantMessageSelection', () => ({
  useAssistantMessageSelection: mockUseAssistantMessageSelection,
}));

const defaultProps = {
  children: 'Test assistant message content',
  messageId: 'test-assistant-message-1',
  isLast: false,
  hasScrollAnchor: false,
  copied: false,
  copyToClipboard: vi.fn(),
  onReload: vi.fn(),
  onQuote: vi.fn(),
  parts: [] as UIMessage['parts'],
  status: 'ready' as const,
  className: '',
  langsmithRunId: 'test-run-id',
};

function renderMessageAssistant(props = {}) {
  return render(<MessageAssistant {...defaultProps} {...props} />);
}

describe('MessageAssistant', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup({ delay: null });
  });

  describe('Basic Rendering', () => {
    it('should render assistant message content', () => {
      renderMessageAssistant();

      expect(screen.getByTestId('message-container')).toBeInTheDocument();
      expect(screen.getByTestId('smooth-streaming-message')).toBeInTheDocument();
      expect(screen.getByTestId('message-text')).toHaveTextContent('Test assistant message content');
    });

    it('should apply custom className', () => {
      renderMessageAssistant({ className: 'custom-class' });

      const container = screen.getByTestId('message-container');
      expect(container).toHaveClass('custom-class');
    });

    it('should apply scroll anchor styling when hasScrollAnchor is true', () => {
      renderMessageAssistant({ hasScrollAnchor: true });

      const container = screen.getByTestId('message-container');
      expect(container).toHaveClass('min-h-scroll-anchor');
    });

    it('should apply last message styling when isLast is true', () => {
      renderMessageAssistant({ isLast: true });

      // Check for pb-8 class which is applied to last messages
      const messageDiv = screen.getByTestId('message-container').querySelector('[data-message-id]');
      expect(messageDiv).toHaveClass('pb-8');
    });
  });

  describe('Message Actions', () => {
    it('should render copy button and handle copy action', async () => {
      const copyToClipboard = vi.fn();
      renderMessageAssistant({ copyToClipboard });

      const copyButton = screen.getByLabelText('Copy text');
      expect(copyButton).toBeInTheDocument();

      await user.click(copyButton);
      expect(copyToClipboard).toHaveBeenCalledTimes(1);
    });

    it('should show copied state when copied is true', () => {
      renderMessageAssistant({ copied: true });

      const checkIcon = screen.getByTestId('mock-icon'); // Check icon should be shown
      expect(checkIcon).toBeInTheDocument();
    });

    it('should render reload button for last message', () => {
      renderMessageAssistant({ isLast: true });

      const reloadButton = screen.getByLabelText('Regenerate');
      expect(reloadButton).toBeInTheDocument();
    });

    it('should handle reload action', async () => {
      const onReload = vi.fn();
      renderMessageAssistant({ isLast: true, onReload });

      const reloadButton = screen.getByLabelText('Regenerate');
      await user.click(reloadButton);

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('should not render reload button for non-last message', () => {
      renderMessageAssistant({ isLast: false });

      expect(screen.queryByLabelText('Regenerate')).not.toBeInTheDocument();
    });
  });

  describe('Reasoning Display', () => {
    it('should render reasoning when available', () => {
      const parts = [
        {
          type: 'reasoning',
          text: 'This is reasoning text',
        },
      ];

      renderMessageAssistant({ parts });

      expect(screen.getByTestId('reasoning')).toBeInTheDocument();
      expect(screen.getByTestId('reasoning-content')).toHaveTextContent('This is reasoning text');
    });

    it('should show reasoning trigger for streaming messages', () => {
      renderMessageAssistant({ status: 'streaming', isLast: true });

      expect(screen.getByTestId('reasoning')).toBeInTheDocument();
      expect(screen.getByTestId('reasoning')).toHaveAttribute('data-streaming', 'true');
    });
  });

  describe('Tool Invocations', () => {
    it('should render tool invocations when available and preference is enabled', () => {
      const parts = [
        {
          type: 'tool-call',
          toolCallId: 'call-123',
          toolName: 'search',
          state: 'output-available',
          input: { query: 'test query' },
          output: { result: 'test result' },
        },
      ];

      renderMessageAssistant({ parts });

      expect(screen.getByTestId('tool')).toBeInTheDocument();
      expect(screen.getByTestId('tool-header')).toBeInTheDocument();
      expect(screen.getByTestId('tool-input')).toHaveTextContent('{"query":"test query"}');
    });

    it('should not render tool invocations when preference is disabled', () => {
      mockPreferences.showToolInvocations = false;

      const parts = [
        {
          type: 'tool-call',
          toolCallId: 'call-123',
          toolName: 'search',
          state: 'output-available',
          input: { query: 'test query' },
        },
      ];

      renderMessageAssistant({ parts });

      expect(screen.queryByTestId('tool')).not.toBeInTheDocument();

      // Reset for other tests
      mockPreferences.showToolInvocations = true;
    });
  });

  describe('Sources Display', () => {
    it('should render sources when available', () => {
      // Mock getSources to return sources
      mockGetSources.mockReturnValue([
        { id: '1', url: 'https://example.com', title: 'Example Source' },
        { id: '2', url: 'https://test.com', title: 'Test Source' },
      ]);

      renderMessageAssistant();

      expect(screen.getByTestId('sources')).toBeInTheDocument();
      expect(screen.getByTestId('sources-trigger')).toHaveTextContent('Sources (2)');
      expect(screen.getByTestId('source-0')).toHaveTextContent('Example Source');
      expect(screen.getByTestId('source-1')).toHaveTextContent('Test Source');
    });

    it('should not render sources when none available', () => {
      mockGetSources.mockReturnValue([]);

      renderMessageAssistant();

      expect(screen.queryByTestId('sources')).not.toBeInTheDocument();
    });
  });

  describe('Search Images', () => {
    it('should render search images when available', () => {
      const parts = [
        {
          type: 'tool-call',
          toolName: 'imageSearch',
          state: 'output-available',
          output: {
            content: [
              {
                type: 'images',
                results: [
                  { title: 'Image 1', imageUrl: 'img1.jpg', sourceUrl: 'source1.com' },
                  { title: 'Image 2', imageUrl: 'img2.jpg', sourceUrl: 'source2.com' },
                ],
              },
            ],
          },
        },
      ];

      renderMessageAssistant({ parts });

      expect(screen.getByTestId('search-images')).toBeInTheDocument();
      expect(screen.getByTestId('image-result-0')).toHaveTextContent('Image 1');
      expect(screen.getByTestId('image-result-1')).toHaveTextContent('Image 2');
    });
  });

  describe('Message Feedback', () => {
    it('should render message feedback component', () => {
      renderMessageAssistant();

      const feedback = screen.getByTestId('message-feedback');
      expect(feedback).toBeInTheDocument();
      expect(feedback).toHaveAttribute('data-message-id', 'test-assistant-message-1');
      expect(feedback).toHaveAttribute('data-langsmith-run-id', 'test-run-id');
    });
  });

  describe('Streaming State', () => {
    it('should handle streaming status correctly', () => {
      renderMessageAssistant({ status: 'streaming', isLast: true });

      // Should show reasoning with streaming state
      expect(screen.getByTestId('reasoning')).toHaveAttribute('data-streaming', 'true');

      // Should not show actions during streaming
      expect(screen.queryByTestId('message-actions')).not.toBeInTheDocument();
    });

    it('should show actions when not streaming', () => {
      renderMessageAssistant({ status: 'ready' });

      expect(screen.getByTestId('message-actions')).toBeInTheDocument();
    });
  });

  describe('Quote Functionality', () => {
    it('should handle quote selection when enabled', () => {
      const mockSelectionInfo = {
        text: 'Selected text',
        messageId: 'test-assistant-message-1',
        position: { x: 100, y: 200 },
      };

      mockUseAssistantMessageSelection.mockReturnValue({
        selectionInfo: mockSelectionInfo,
        clearSelection: vi.fn(),
      });

      const onQuote = vi.fn();
      renderMessageAssistant({ onQuote });

      expect(screen.getByTestId('quote-button')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional props gracefully', () => {
      const minimalProps = {
        children: 'Test content',
        messageId: 'test-id',
      };

      expect(() => renderMessageAssistant(minimalProps)).not.toThrow();
    });

    it('should handle empty content', () => {
      renderMessageAssistant({ children: '' });

      // Should still render container but not content
      expect(screen.getByTestId('message-container')).toBeInTheDocument();
      expect(screen.queryByTestId('smooth-streaming-message')).not.toBeInTheDocument();
    });

    it('should handle undefined parts array', () => {
      renderMessageAssistant({ parts: undefined });

      expect(screen.getByTestId('message-container')).toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should not render content when children is null', () => {
      renderMessageAssistant({ children: null as any });

      expect(screen.queryByTestId('smooth-streaming-message')).not.toBeInTheDocument();
    });

    it('should not render content when children is empty', () => {
      renderMessageAssistant({ children: '' });

      expect(screen.queryByTestId('smooth-streaming-message')).not.toBeInTheDocument();
    });

    it('should render content when children has value', () => {
      renderMessageAssistant({ children: 'Valid content' });

      expect(screen.getByTestId('smooth-streaming-message')).toBeInTheDocument();
      expect(screen.getByTestId('message-text')).toHaveTextContent('Valid content');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      renderMessageAssistant({ isLast: true });

      expect(screen.getByLabelText('Copy text')).toBeInTheDocument();
      expect(screen.getByLabelText('Regenerate')).toBeInTheDocument();
    });

    it('should have proper button types', () => {
      renderMessageAssistant({ isLast: true });

      const copyButton = screen.getByLabelText('Copy text');
      const reloadButton = screen.getByLabelText('Regenerate');

      expect(copyButton).toHaveAttribute('type', 'button');
      expect(reloadButton).toHaveAttribute('type', 'button');
    });
  });

  describe('Performance', () => {
    it('should handle large content efficiently', () => {
      const largeContent = 'A'.repeat(10000);

      expect(() => renderMessageAssistant({ children: largeContent })).not.toThrow();
      expect(screen.getByTestId('message-text')).toHaveTextContent(largeContent);
    });

    it('should handle many tool invocations', () => {
      const manyParts = Array.from({ length: 50 }, (_, i) => ({
        type: 'tool-call',
        toolCallId: `call-${i}`,
        toolName: `tool-${i}`,
        state: 'output-available' as const,
        input: { query: `query-${i}` },
      }));

      expect(() => renderMessageAssistant({ parts: manyParts })).not.toThrow();
    });
  });
});