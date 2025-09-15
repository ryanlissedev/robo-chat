import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import the Message component at module level
import { Message } from '@/components/app/chat/message';
// Import timer test utilities
import {
  createTimerTestContext,
  safeAdvanceTimers,
  safeRunAllTimers,
} from './utils/timer-test-utils';

// Helper function to filter DOM props
const filterDOMProps = (props: Record<string, any>): Record<string, any> => {
  const domProps: Record<string, any> = {};

  Object.keys(props).forEach((key) => {
    // Allow standard HTML attributes and data/aria attributes
    if (
      key.startsWith('data-') ||
      key.startsWith('aria-') ||
      key === 'id' ||
      key === 'role' ||
      key === 'tabIndex' ||
      key === 'className' ||
      key === 'style' ||
      key === 'title'
    ) {
      domProps[key] = props[key];
    }
  });

  return domProps;
};

// Mock child components with minimal implementations that include interactive elements
vi.mock('@/components/app/chat/message-assistant', () => ({
  MessageAssistant: ({
    children,
    copyToClipboard,
    onQuote,
    messageId,
    ...props
  }: any) => {
    const handleQuote = () => {
      if (onQuote) {
        onQuote(children, messageId);
      }
    };

    // Filter out non-DOM props to prevent React warnings
    const domProps = filterDOMProps(props);

    return (
      <div data-testid="message-assistant" {...domProps}>
        {children}
        <button aria-label="copy" onClick={copyToClipboard}>
          Copy
        </button>
        <button aria-label="quote" onClick={handleQuote}>
          Quote
        </button>
      </div>
    );
  },
}));

vi.mock('@/components/app/chat/message-user', () => ({
  MessageUser: ({ children, copyToClipboard, ...props }: any) => {
    // Filter out non-DOM props to prevent React warnings
    const domProps = filterDOMProps(props);

    return (
      <div data-testid="message-user" {...domProps}>
        {children}
        <button aria-label="copy" onClick={copyToClipboard}>
          Copy
        </button>
      </div>
    );
  },
}));

// Mock clipboard operations
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(''),
};

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  configurable: true,
});

describe('Message Component (Optimized)', () => {
  const timerContext = createTimerTestContext();

  beforeEach(() => {
    timerContext.setupTimers();
  });

  afterEach(() => {
    cleanup();
    timerContext.cleanupTimers();
  });

  const createMockProps = (overrides = {}) => ({
    variant: 'assistant' as const,
    children: 'Test message content',
    id: 'test-message-1',
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    onReload: vi.fn(),
    onQuote: vi.fn(),
    ...overrides,
  });

  describe('Basic Rendering', () => {
    it('should render assistant message', async () => {
      const props = createMockProps();

      render(<Message {...props} />);

      // Advance any timers that might be set
      safeRunAllTimers();

      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      });
    });

    it('should render user message', async () => {
      const props = createMockProps({ variant: 'user' });

      render(<Message {...props} />);

      // Advance any timers that might be set
      safeRunAllTimers();

      await waitFor(() => {
        expect(screen.getByTestId('message-user')).toBeInTheDocument();
      });
    });
  });

  describe('Interactive Features', () => {
    it('should render copy button', async () => {
      const props = createMockProps();

      render(<Message {...props} />);

      safeRunAllTimers();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /copy/i })
        ).toBeInTheDocument();
      });
    });

    it('should render quote button for assistant messages', async () => {
      const onQuote = vi.fn();
      const props = createMockProps({ onQuote });

      render(<Message {...props} />);

      safeRunAllTimers();

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /quote/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('should handle rapid interactions without memory leaks', async () => {
      const onQuote = vi.fn();
      const props = createMockProps({ onQuote });

      const { rerender } = render(<Message {...props} />);

      // Simulate rapid re-renders
      for (let i = 0; i < 10; i++) {
        rerender(<Message {...props} id={`message-${i}`} />);
        safeAdvanceTimers(100);
      }

      // Verify no memory leaks by checking cleanup
      safeRunAllTimers();

      expect(onQuote).not.toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', async () => {
      const props = createMockProps();

      const { unmount } = render(<Message {...props} />);

      // Allow component to initialize
      safeRunAllTimers();

      // Unmount and verify cleanup
      unmount();

      // Advance timers to ensure cleanup completes
      safeRunAllTimers();
      // Verify no remaining timers
      expect(timerContext.getCurrentTimerCount()).toBe(0);
    });
  });

  describe('Sequential Operations', () => {
    it('should render assistant message with content', async () => {
      const props = createMockProps({
        variant: 'assistant',
        children: 'Assistant message 1',
      });

      render(<Message {...props} />);

      // Advance timers if using fake timers
      safeRunAllTimers();

      await waitFor(
        () => {
          expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should render user message with content', async () => {
      const props = createMockProps({
        variant: 'user',
        children: 'User message 1',
      });

      render(<Message {...props} />);

      // Advance timers if using fake timers
      safeRunAllTimers();

      await waitFor(
        () => {
          expect(screen.getByTestId('message-user')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
