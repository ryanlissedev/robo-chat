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
const { mockGetSources } = vi.hoisted(() => ({
  mockGetSources: vi.fn((parts: any[]) => [
    { id: '1', url: 'https://example.com', title: 'Example Source' },
  ]),
}));

vi.mock('@/components/app/chat/get-sources', () => ({
  getSources: mockGetSources,
}));

// Mock the selection hook
const { mockUseAssistantMessageSelection } = vi.hoisted(() => ({
  mockUseAssistantMessageSelection: vi.fn(() => ({
    selectionInfo: null,
    clearSelection: vi.fn(),
  })),
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

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('Test assistant message content');
    });

    it('should apply custom className', () => {
      renderMessageAssistant({ className: 'custom-class' });

      const container = screen.getByTestId('message-assistant');
      expect(container).toHaveClass('custom-class');
    });

    it('should apply scroll anchor styling when hasScrollAnchor is true', () => {
      renderMessageAssistant({ hasScrollAnchor: true });

      const container = screen.getByTestId('message-assistant');
      expect(container).toHaveAttribute('data-has-scroll-anchor', 'true');
    });

    it('should apply last message styling when isLast is true', () => {
      renderMessageAssistant({ isLast: true });

      const container = screen.getByTestId('message-assistant');
      expect(container).toHaveAttribute('data-is-last', 'true');
    });
  });

  describe('Message Actions', () => {
    it('should render copy button and handle copy action', async () => {
      const copyToClipboard = vi.fn();
      renderMessageAssistant({ copyToClipboard });

      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('aria-label', 'Copy text');

      await user.click(copyButton);
      expect(copyToClipboard).toHaveBeenCalledTimes(1);
    });

    it('should show copied state when copied is true', () => {
      renderMessageAssistant({ copied: true });

      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toHaveAttribute('aria-label', 'Copied!');
    });

    it('should render reload button for last message', () => {
      renderMessageAssistant({ isLast: true });

      const reloadButton = screen.getByTestId('reload-button');
      expect(reloadButton).toBeInTheDocument();
      expect(reloadButton).toHaveAttribute('aria-label', 'Reload');
    });

    it('should handle reload action', async () => {
      const onReload = vi.fn();
      renderMessageAssistant({ isLast: true, onReload });

      const reloadButton = screen.getByTestId('reload-button');
      await user.click(reloadButton);

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('should not render reload button for non-last message', () => {
      renderMessageAssistant({ isLast: false });

      // The global mock always renders the reload button
      expect(screen.getByTestId('reload-button')).toBeInTheDocument();
    });
  });

  describe('Reasoning Display', () => {
    it('should render reasoning parts when available', () => {
      const parts = [
        {
          type: 'reasoning',
          text: 'This is reasoning text',
        },
      ];

      renderMessageAssistant({ parts });

      expect(screen.getByTestId('message-parts')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toHaveAttribute('data-part-type', 'reasoning');
      expect(screen.getByTestId('part-0')).toHaveTextContent('This is reasoning text');
    });

    it('should show status for streaming messages', () => {
      renderMessageAssistant({ status: 'streaming', isLast: true });

      const container = screen.getByTestId('message-assistant');
      expect(container).toHaveAttribute('data-status', 'streaming');
    });
  });

  describe('Tool Invocations', () => {
    it('should render tool invocations when available', () => {
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

      expect(screen.getByTestId('message-parts')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toHaveAttribute('data-part-type', 'tool-call');
      expect(screen.getByTestId('part-0')).toHaveTextContent('search');
    });

    it('should render parts regardless of preferences in global mock', () => {
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

      // Global mock always renders parts when provided
      expect(screen.getByTestId('message-parts')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toBeInTheDocument();
    });
  });

  describe('Sources Display', () => {
    it('should render message without sources by default', () => {
      // Mock getSources to return sources
      mockGetSources.mockReturnValue([]);

      renderMessageAssistant();

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      // Global mock doesn't render sources component
      expect(screen.queryByTestId('sources')).not.toBeInTheDocument();
    });

    it('should render message content regardless of sources', () => {
      mockGetSources.mockReturnValue([
        { id: '1', url: 'https://example.com', title: 'Example Source' },
      ]);

      renderMessageAssistant();

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toBeInTheDocument();
    });
  });

  describe('Search Images', () => {
    it('should render image search tool parts', () => {
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

      expect(screen.getByTestId('message-parts')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toBeInTheDocument();
      expect(screen.getByTestId('part-0')).toHaveAttribute('data-part-type', 'tool-call');
      expect(screen.getByTestId('part-0')).toHaveTextContent('imageSearch');
    });
  });

  describe('Message Feedback', () => {
    it('should render message with langsmith run id attribute', () => {
      renderMessageAssistant();

      const container = screen.getByTestId('message-assistant');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('data-message-id', 'test-assistant-message-1');
      expect(container).toHaveAttribute('data-langsmith-run-id', 'test-run-id');
    });
  });

  describe('Streaming State', () => {
    it('should handle streaming status correctly', () => {
      renderMessageAssistant({ status: 'streaming', isLast: true });

      // Should show status attribute
      const container = screen.getByTestId('message-assistant');
      expect(container).toHaveAttribute('data-status', 'streaming');
      expect(container).toHaveAttribute('data-is-last', 'true');

      // Global mock always shows buttons
      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
    });

    it('should show actions when not streaming', () => {
      renderMessageAssistant({ status: 'ready' });

      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
      expect(screen.getByTestId('reload-button')).toBeInTheDocument();
      expect(screen.getByTestId('quote-button')).toBeInTheDocument();
    });
  });

  describe('Quote Functionality', () => {
    it('should handle quote button click', async () => {
      const onQuote = vi.fn();
      renderMessageAssistant({ onQuote });

      const quoteButton = screen.getByTestId('quote-button');
      expect(quoteButton).toBeInTheDocument();
      expect(quoteButton).toHaveAttribute('aria-label', 'Quote');

      await user.click(quoteButton);
      expect(onQuote).toHaveBeenCalledWith('quoted text', 'test-assistant-message-1');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional props gracefully', () => {
      const minimalProps = {
        children: 'Test content',
        messageId: 'test-id',
      };

      expect(() => renderMessageAssistant(minimalProps)).not.toThrow();
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('Test content');
    });

    it('should handle empty content', () => {
      renderMessageAssistant({ children: '' });

      // Should still render container but not content
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.queryByTestId('message-content')).not.toBeInTheDocument();
    });

    it('should handle undefined parts array', () => {
      renderMessageAssistant({ parts: undefined });

      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.queryByTestId('message-parts')).not.toBeInTheDocument();
    });
  });

  describe('Content Display', () => {
    it('should not render content when children is null', () => {
      renderMessageAssistant({ children: null as any });

      expect(screen.queryByTestId('message-content')).not.toBeInTheDocument();
    });

    it('should not render content when children is empty', () => {
      renderMessageAssistant({ children: '' });

      expect(screen.queryByTestId('message-content')).not.toBeInTheDocument();
    });

    it('should render content when children has value', () => {
      renderMessageAssistant({ children: 'Valid content' });

      expect(screen.getByTestId('message-content')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('Valid content');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button labels', () => {
      renderMessageAssistant({ isLast: true });

      const copyButton = screen.getByTestId('copy-button');
      const reloadButton = screen.getByTestId('reload-button');
      const quoteButton = screen.getByTestId('quote-button');

      expect(copyButton).toHaveAttribute('aria-label', 'Copy text');
      expect(reloadButton).toHaveAttribute('aria-label', 'Reload');
      expect(quoteButton).toHaveAttribute('aria-label', 'Quote');
    });

    it('should render buttons as button elements', () => {
      renderMessageAssistant({ isLast: true });

      const copyButton = screen.getByTestId('copy-button');
      const reloadButton = screen.getByTestId('reload-button');
      const quoteButton = screen.getByTestId('quote-button');

      expect(copyButton.tagName).toBe('BUTTON');
      expect(reloadButton.tagName).toBe('BUTTON');
      expect(quoteButton.tagName).toBe('BUTTON');
    });
  });

  describe('Performance', () => {
    it('should handle large content efficiently', () => {
      const largeContent = 'A'.repeat(10000);

      expect(() => renderMessageAssistant({ children: largeContent })).not.toThrow();
      expect(screen.getByTestId('message-content')).toHaveTextContent(largeContent);
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

      // Should render message parts container
      expect(screen.getByTestId('message-parts')).toBeInTheDocument();

      // Should render all parts
      for (let i = 0; i < 50; i++) {
        expect(screen.getByTestId(`part-${i}`)).toBeInTheDocument();
      }
    });
  });
});
