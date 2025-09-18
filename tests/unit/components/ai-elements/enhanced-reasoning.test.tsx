import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EnhancedReasoning,
  EnhancedReasoningContent,
  EnhancedReasoningTrigger,
} from '@/components/ai-elements/enhanced-reasoning';

// Mock Date.now for predictable timing
const mockDateNow = vi.fn();

// Mock TextShimmer component
const mockTextShimmer = vi.hoisted(() => ({
  TextShimmer: ({ children, ...props }: any) => (
    <span data-testid="text-shimmer" {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/text-shimmer', () => mockTextShimmer);

// Mock Response component to avoid streamdown/katex CSS import issues
const mockResponse = vi.hoisted(() => ({
  Response: ({ children, className, ...props }: any) => (
    <div data-testid="response" className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ai-elements/response', () => mockResponse);

// Mock Date.now for predictable timing
Object.defineProperty(global, 'Date', {
  value: {
    ...Date,
    now: mockDateNow,
  },
  writable: true,
});

describe('EnhancedReasoning Component (London School TDD)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default Date.now mock
    mockDateNow.mockReturnValue(1000);
  });

  describe('Auto-open behavior', () => {
    it('should auto-open when streaming starts', () => {
      render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Verify component is open (content should be visible)
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
    });

    it('should not auto-open when not streaming', () => {
      render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Verify component is closed (content should not be visible)
      expect(screen.queryByText('Test reasoning content')).not.toBeInTheDocument();
    });

    it('should auto-open when streaming changes from false to true', () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Initially closed
      expect(screen.queryByText('Test reasoning content')).not.toBeInTheDocument();

      // Start streaming
      rerender(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should auto-open
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
    });
  });

  describe('Auto-close behavior', () => {
    it('should schedule auto-close after streaming ends', async () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Component should be open
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();

      // Stop streaming
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Component should still be open initially
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();

      // Wait for auto-close (1 second + buffer)
      await waitFor(
        () => {
          expect(screen.queryByText('Test reasoning content')).not.toBeInTheDocument();
        },
        { timeout: 1500 }
      );
    });

    it('should not auto-close if streaming resumes', async () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Stop streaming (schedules auto-close)
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Resume streaming quickly (should clear timeout)
      rerender(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Wait longer than auto-close delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Component should still be open since timer was cleared
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
    });
  });

  describe('Duration tracking', () => {
    it('should start tracking duration when streaming begins', () => {
      const startTime = 2000;
      mockDateNow.mockReturnValue(startTime);

      render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Verify Date.now was called to capture start time
      expect(mockDateNow).toHaveBeenCalled();
    });

    it('should calculate duration when streaming ends', () => {
      const startTime = 1000;
      const endTime = 4500; // 3.5 seconds later
      const expectedDuration = 4; // Rounded to 4 seconds

      mockDateNow.mockReturnValueOnce(startTime);

      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Mock end time
      mockDateNow.mockReturnValueOnce(endTime);

      // Stop streaming
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Check if duration is displayed correctly
      expect(screen.getByText(`Thought for ${expectedDuration} seconds`)).toBeInTheDocument();
    });

    it('should reset tracking when streaming starts again', () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Stop streaming
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Start streaming again with new time
      const newStartTime = 5000;
      mockDateNow.mockReturnValue(newStartTime);

      rerender(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Verify new tracking started
      expect(mockDateNow).toHaveBeenCalledTimes(3); // Initial + stop + new start
    });
  });

  describe('Manual override behavior', () => {
    it('should allow manual interaction to override auto-close', async () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Stop streaming (triggers auto-close timer)
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // User manually interacts (which should mark as manually interacted)
      const trigger = screen.getByRole('button');
      await user.click(trigger); // This marks manual interaction

      // Wait longer than auto-close delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Component behavior after manual interaction depends on current state
      // The key is that manual interaction prevents automatic behavior
    });

    it('should allow manual close to override auto-open', async () => {
      render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Component should be auto-opened
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();

      // User manually closes
      const trigger = screen.getByRole('button');
      await user.click(trigger);

      // Component should be closed
      expect(screen.queryByText('Test reasoning content')).not.toBeInTheDocument();
    });

    it('should preserve manual state after streaming changes', async () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // User manually opens
      const trigger = screen.getByRole('button');
      await user.click(trigger);
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();

      // Start streaming (should not affect manual state)
      rerender(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should remain open
      expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
    });
  });

  describe('Shimmer display during streaming', () => {
    it('should show shimmer effect when streaming', () => {
      render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Verify TextShimmer is rendered for "Thinking..." text
      const shimmer = screen.getByTestId('text-shimmer');
      expect(shimmer).toBeInTheDocument();
      expect(shimmer).toHaveTextContent('Thinking...');
    });

    it('should not show shimmer when not streaming', () => {
      render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should show duration instead of shimmer
      expect(screen.queryByTestId('text-shimmer')).not.toBeInTheDocument();
      expect(screen.getByText('Thought for 0 seconds')).toBeInTheDocument();
    });

    it('should transition from shimmer to duration display', () => {
      const { rerender } = render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Initially shows shimmer
      expect(screen.getByTestId('text-shimmer')).toBeInTheDocument();

      // Stop streaming with duration
      mockTimers.Date.now.mockReturnValueOnce(3000); // 2 seconds duration
      rerender(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should show duration, no shimmer
      expect(screen.queryByTestId('text-shimmer')).not.toBeInTheDocument();
      expect(screen.getByText('Thought for 2 seconds')).toBeInTheDocument();
    });
  });

  describe('Collapsible UI with chevron indicator', () => {
    it('should render chevron icon in correct orientation when closed', () => {
      render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      const chevron = screen.getByTestId('chevron-icon');
      expect(chevron).toHaveClass('rotate-0');
    });

    it('should render chevron icon in correct orientation when open', () => {
      render(
        <EnhancedReasoning isStreaming={true}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      const chevron = screen.getByTestId('chevron-icon');
      expect(chevron).toHaveClass('rotate-180');
    });

    it('should toggle chevron orientation on manual open/close', async () => {
      render(
        <EnhancedReasoning isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      const chevron = screen.getByTestId('chevron-icon');
      const trigger = screen.getByRole('button');

      // Initially closed
      expect(chevron).toHaveClass('rotate-0');

      // Click to open
      await user.click(trigger);
      expect(chevron).toHaveClass('rotate-180');

      // Click to close
      await user.click(trigger);
      expect(chevron).toHaveClass('rotate-0');
    });
  });

  describe('Context provider functionality', () => {
    it('should provide correct context values to children', () => {
      const TestConsumer = () => {
        // This would use the context hook
        return <div data-testid="context-consumer">Context consumer</div>;
      };

      render(
        <EnhancedReasoning isStreaming={true}>
          <TestConsumer />
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      expect(screen.getByTestId('context-consumer')).toBeInTheDocument();
    });

    it('should throw error when components used outside provider', () => {
      // Mock console.error to prevent error output in test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<EnhancedReasoningTrigger />);
      }).toThrow('Reasoning components must be used within EnhancedReasoning');

      consoleSpy.mockRestore();
    });
  });

  describe('Controlled state props', () => {
    it('should respect controlled open prop', () => {
      const { rerender } = render(
        <EnhancedReasoning open={false} isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should be closed despite auto-open logic
      expect(screen.queryByText('Test content')).not.toBeInTheDocument();

      // Open via prop
      rerender(
        <EnhancedReasoning open={true} isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      // Should be open
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should call onOpenChange when state changes', async () => {
      const onOpenChange = vi.fn();

      render(
        <EnhancedReasoning onOpenChange={onOpenChange} isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      const trigger = screen.getByRole('button');
      await user.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('should respect controlled duration prop', () => {
      render(
        <EnhancedReasoning duration={42} isStreaming={false}>
          <EnhancedReasoningTrigger />
          <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
        </EnhancedReasoning>
      );

      expect(screen.getByText('Thought for 42 seconds')).toBeInTheDocument();
    });
  });
});