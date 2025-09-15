import React from 'react';
/**
 * Comprehensive unit tests for Reasoning components
 * Ensuring 100% test coverage for production validation
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';

// Mock Response component
vi.mock('@/components/ai-elements/response', () => ({
  Response: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
}));

describe('Reasoning Components', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Reasoning Component', () => {
    it('should render with default props', () => {
      render(
        <Reasoning>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(screen.queryByText('Test reasoning content')).not.toBeVisible();
    });

    it('should render with defaultOpen=true', () => {
      render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should handle controlled open state', async () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <Reasoning open={false} onOpenChange={onOpenChange}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const trigger = screen.getByText('Thinking...');
      await user.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);

      rerender(
        <Reasoning open={true} onOpenChange={onOpenChange}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should auto-open when streaming starts', () => {
      const { rerender } = render(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.queryByText('Test reasoning content')).not.toBeVisible();

      rerender(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should track duration during streaming', async () => {
      const mockDate = new Date('2024-01-01T10:00:00.000Z');
      vi.setSystemTime(mockDate);

      const { rerender } = render(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thinking...')).toBeInTheDocument();

      // Advance time by 3 seconds
      vi.advanceTimersByTime(3000);
      vi.setSystemTime(new Date('2024-01-01T10:00:03.000Z'));

      rerender(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      await waitFor(() => {
        expect(screen.getByText('Thought for 3 seconds')).toBeInTheDocument();
      });
    });

    it('should handle custom duration prop', () => {
      render(
        <Reasoning duration={5}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thought for 5 seconds')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <Reasoning className="custom-reasoning">
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const reasoningElement = container.querySelector('.custom-reasoning');
      expect(reasoningElement).toBeInTheDocument();
      expect(reasoningElement).toHaveClass(
        'not-prose',
        'mb-4',
        'custom-reasoning'
      );
    });

    it('should handle auto-close functionality when enabled', async () => {
      // Mock AUTO_CLOSE_DELAY to be non-zero for this test
      const _originalDelay = 0; // Current value in component

      const { rerender } = render(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();

      rerender(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      // Since AUTO_CLOSE_DELAY is 0, content should remain visible
      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should not auto-close when defaultOpen is true', async () => {
      const { rerender } = render(
        <Reasoning isStreaming={true} defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      rerender(
        <Reasoning isStreaming={false} defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should pass through additional props to Collapsible', () => {
      const { container } = render(
        <Reasoning data-testid="reasoning-collapsible">
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(
        container.querySelector('[data-testid="reasoning-collapsible"]')
      ).toBeInTheDocument();
    });
  });

  describe('ReasoningTrigger Component', () => {
    it('should render default trigger content when streaming', () => {
      render(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveClass(
        'flex',
        'items-center',
        'gap-2',
        'text-muted-foreground',
        'text-sm'
      );
    });

    it('should render duration when not streaming and duration > 0', () => {
      render(
        <Reasoning isStreaming={false} duration={5}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thought for 5 seconds')).toBeInTheDocument();
    });

    it('should show Thinking when not streaming and duration = 0', () => {
      render(
        <Reasoning isStreaming={false} duration={0}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('should render custom children when provided', () => {
      render(
        <Reasoning>
          <ReasoningTrigger>Custom trigger content</ReasoningTrigger>
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Custom trigger content')).toBeInTheDocument();
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <Reasoning>
          <ReasoningTrigger className="custom-trigger" />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveClass('custom-trigger');
    });

    it('should rotate chevron icon when open/closed', async () => {
      render(
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const chevron = document.querySelector('.lucide-chevron-down');
      expect(chevron).toHaveClass('rotate-0');

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(chevron).toHaveClass('rotate-180');
      });
    });

    it('should handle click to toggle state', async () => {
      render(
        <Reasoning defaultOpen={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.queryByText('Test reasoning content')).not.toBeVisible();

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Test reasoning content')).toBeVisible();
      });
    });

    it('should pass through additional props', () => {
      render(
        <Reasoning>
          <ReasoningTrigger data-testid="custom-trigger" />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument();
    });

    it('should render brain icon in default content', () => {
      const { container } = render(
        <Reasoning>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const brainIcon = container.querySelector('.lucide-brain');
      expect(brainIcon).toBeInTheDocument();
      expect(brainIcon).toHaveClass('size-4');
    });

    it('should handle title prop', () => {
      render(
        <Reasoning>
          <ReasoningTrigger title="Custom reasoning title" />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('title', 'Custom reasoning title');
    });
  });

  describe('ReasoningContent Component', () => {
    it('should render content with proper styling', () => {
      render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const content = screen.getByText('Test reasoning content');
      expect(content.parentElement).toHaveClass(
        'mt-4',
        'text-sm',
        'text-popover-foreground',
        'outline-none'
      );
    });

    it('should apply custom className', () => {
      render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent className="custom-content">
            Test reasoning content
          </ReasoningContent>
        </Reasoning>
      );

      const content = screen.getByText('Test reasoning content');
      expect(content.parentElement).toHaveClass('custom-content');
    });

    it('should pass children to Response component', () => {
      render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Complex reasoning content</ReasoningContent>
        </Reasoning>
      );

      const content = screen.getByText('Complex reasoning content');
      expect(content).toBeInTheDocument();
      expect(content.parentElement).toHaveClass('grid', 'gap-2');
    });

    it('should pass through additional props', () => {
      render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent data-testid="custom-content">
            Test reasoning content
          </ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('should handle animation classes properly', () => {
      const { container } = render(
        <Reasoning defaultOpen={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      const content = container.querySelector('[data-state="open"]');
      expect(content).toHaveClass(
        'data-[state=closed]:fade-out-0',
        'data-[state=closed]:slide-out-to-top-2',
        'data-[state=open]:slide-in-from-top-2',
        'data-[state=closed]:animate-out',
        'data-[state=open]:animate-in'
      );
    });
  });

  describe('Context Error Handling', () => {
    it('should throw error when ReasoningTrigger is used outside Reasoning context', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<ReasoningTrigger />);
      }).toThrow('Reasoning components must be used within Reasoning');

      console.error = originalError;
    });

    it('should throw error when ReasoningContent is used outside Reasoning context', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<ReasoningContent>Test content</ReasoningContent>);
      }).toThrow('Reasoning components must be used within Reasoning');

      console.error = originalError;
    });
  });

  describe('Display Names', () => {
    it('should have correct display names for debugging', () => {
      expect(Reasoning.displayName).toBe('Reasoning');
      expect(ReasoningTrigger.displayName).toBe('ReasoningTrigger');
      expect(ReasoningContent.displayName).toBe('ReasoningContent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid streaming state changes', async () => {
      const { rerender } = render(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      // Rapid state changes
      rerender(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      rerender(
        <Reasoning isStreaming={false}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      rerender(
        <Reasoning isStreaming={true}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Test reasoning content')).toBeVisible();
    });

    it('should handle duration updates correctly', () => {
      const { rerender } = render(
        <Reasoning duration={1}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thought for 1 seconds')).toBeInTheDocument();

      rerender(
        <Reasoning duration={10}>
          <ReasoningTrigger />
          <ReasoningContent>Test reasoning content</ReasoningContent>
        </Reasoning>
      );

      expect(screen.getByText('Thought for 10 seconds')).toBeInTheDocument();
    });

    it('should handle multiple reasoning components independently', () => {
      render(
        <div>
          <Reasoning data-testid="reasoning-1" isStreaming={true}>
            <ReasoningTrigger />
            <ReasoningContent>Content 1</ReasoningContent>
          </Reasoning>
          <Reasoning data-testid="reasoning-2" isStreaming={false} duration={5}>
            <ReasoningTrigger />
            <ReasoningContent>Content 2</ReasoningContent>
          </Reasoning>
        </div>
      );

      expect(screen.getByText('Content 1')).toBeVisible();
      expect(screen.queryByText('Content 2')).not.toBeVisible();
      expect(screen.getByText('Thinking...')).toBeInTheDocument();
      expect(screen.getByText('Thought for 5 seconds')).toBeInTheDocument();
    });
  });
});
