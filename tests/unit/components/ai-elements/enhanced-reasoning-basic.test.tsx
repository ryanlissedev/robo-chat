import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  EnhancedReasoning,
  EnhancedReasoningContent,
  EnhancedReasoningTrigger,
} from '@/components/ai-elements/enhanced-reasoning';

// Mock TextShimmer component
vi.mock('@/components/ui/text-shimmer', () => ({
  TextShimmer: ({ children, ...props }: any) => (
    <span data-testid="text-shimmer" {...props}>
      {children}
    </span>
  ),
}));

// Mock Response component to avoid streamdown/katex CSS import issues
vi.mock('@/components/ai-elements/response', () => ({
  Response: ({ children, className, ...props }: any) => (
    <div data-testid="response" className={className} {...props}>
      {children}
    </div>
  ),
}));

describe('EnhancedReasoning Basic Tests', () => {
  it('should render correctly when streaming', () => {
    render(
      <EnhancedReasoning isStreaming={true}>
        <EnhancedReasoningTrigger />
        <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
      </EnhancedReasoning>
    );

    // Should show thinking shimmer when streaming
    expect(screen.getByTestId('text-shimmer')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();

    // Content should be visible when streaming (auto-open)
    expect(screen.getByText('Test reasoning content')).toBeInTheDocument();
  });

  it('should render correctly when not streaming', () => {
    render(
      <EnhancedReasoning isStreaming={false}>
        <EnhancedReasoningTrigger />
        <EnhancedReasoningContent>Test reasoning content</EnhancedReasoningContent>
      </EnhancedReasoning>
    );

    // Should show duration when not streaming
    expect(screen.getByText('Thought for 0 seconds')).toBeInTheDocument();

    // Content should not be visible when not streaming (closed by default)
    expect(screen.queryByText('Test reasoning content')).not.toBeInTheDocument();
  });

  it('should display chevron icon with correct rotation', () => {
    const { rerender } = render(
      <EnhancedReasoning isStreaming={false}>
        <EnhancedReasoningTrigger />
        <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
      </EnhancedReasoning>
    );

    // Closed state - chevron should be rotated to 0 degrees
    const chevron = screen.getByTestId('chevron-icon');
    expect(chevron).toHaveClass('rotate-0');

    // Open state - chevron should be rotated to 180 degrees
    rerender(
      <EnhancedReasoning isStreaming={true}>
        <EnhancedReasoningTrigger />
        <EnhancedReasoningContent>Test content</EnhancedReasoningContent>
      </EnhancedReasoning>
    );

    expect(chevron).toHaveClass('rotate-180');
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

  it('should auto-open when streaming starts', () => {
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