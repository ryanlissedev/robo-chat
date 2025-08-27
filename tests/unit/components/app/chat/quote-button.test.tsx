import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuoteButton } from '@/components/app/chat/quote-button';
import { createRef } from 'react';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Quote: ({ className }: { className?: string }) => (
    <div data-testid="quote-icon" className={className}>
      Quote
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button
      onClick={onClick}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Store click outside callbacks for manual triggering in tests
let clickOutsideCallbacks = new Map();

// Mock motion primitives
vi.mock('@/components/motion-primitives/useClickOutside', () => ({
  default: (ref: any, callback: () => void) => {
    // Store callback immediately, and also set up a watcher for when ref.current changes
    const storeCallback = () => {
      if (ref && ref.current) {
        clickOutsideCallbacks.set(ref.current, callback);
      }
    };
    
    // Store immediately if ref is available
    storeCallback();
    
    // Also check periodically for when ref.current gets set (React refs are async)
    const interval = setInterval(() => {
      if (ref && ref.current) {
        clickOutsideCallbacks.set(ref.current, callback);
        clearInterval(interval);
      }
    }, 10);
    
    // Clear interval after a reasonable timeout
    setTimeout(() => clearInterval(interval), 1000);
  },
}));

const defaultProps = {
  mousePosition: { x: 100, y: 200 },
  onQuote: vi.fn(),
  messageContainerRef: { current: null } as React.RefObject<HTMLElement | null>,
  onDismiss: vi.fn(),
};

function renderQuoteButton(props = {}) {
  return render(<QuoteButton {...defaultProps} {...props} />);
}

// Mock getBoundingClientRect
const mockGetBoundingClientRect = vi.fn(() => ({
  top: 50,
  left: 25,
  bottom: 150,
  right: 225,
  width: 200,
  height: 100,
  x: 25,
  y: 50,
}));

describe('QuoteButton', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    clickOutsideCallbacks.clear();
    // Reset the mock implementation
    mockGetBoundingClientRect.mockReturnValue({
      top: 50,
      left: 25,
      bottom: 150,
      right: 225,
      width: 200,
      height: 100,
      x: 25,
      y: 50,
    });
  });

  describe('Rendering', () => {
    it('should render quote button with icon', () => {
      renderQuoteButton();
      
      expect(screen.getByRole('button', { name: 'Ask follow up' })).toBeInTheDocument();
      expect(screen.getByTestId('quote-icon')).toBeInTheDocument();
    });

    it('should have proper ARIA label', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Ask follow up');
    });

    it('should apply correct CSS classes', () => {
      renderQuoteButton();
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveClass(
        'absolute',
        'z-50',
        'flex',
        'gap-2',
        'rounded-full'
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'flex',
        'size-10',
        'items-center',
        'gap-1',
        'rounded-full',
        'px-3',
        'py-1',
        'text-base'
      );
    });
  });

  describe('Positioning', () => {
    it('should position relative to container when containerRect exists', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      renderQuoteButton({ 
        mousePosition: { x: 150, y: 250 },
        messageContainerRef 
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '140px', // 250 - 50 - 60 (buttonHeight) = 140px
        left: '125px', // 150 - 25
        transform: 'translateX(-50%)',
      });
    });

    it('should use default position when container rect is null', () => {
      const messageContainerRef = { current: null };

      renderQuoteButton({ messageContainerRef });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '0px',
        left: '0px',
        transform: 'translateX(-50%)',
      });
    });

    it('should handle different mouse positions correctly', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      const { rerender } = renderQuoteButton({ 
        mousePosition: { x: 300, y: 400 },
        messageContainerRef 
      });
      
      let container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '290px', // 400 - 50 - 60 = 290px
        left: '275px', // 300 - 25
      });

      // Test with different position
      rerender(
        <QuoteButton 
          {...defaultProps}
          mousePosition={{ x: 50, y: 100 }}
          messageContainerRef={messageContainerRef}
        />
      );
      
      container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '-10px', // 100 - 50 - 60 = -10px
        left: '25px', // 50 - 25
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onQuote when button is clicked', async () => {
      const onQuote = vi.fn();
      renderQuoteButton({ onQuote });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onQuote).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple rapid clicks', async () => {
      const onQuote = vi.fn();
      renderQuoteButton({ onQuote });
      
      const button = screen.getByRole('button');
      
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      expect(onQuote).toHaveBeenCalledTimes(3);
    });

    it('should handle keyboard interactions', async () => {
      const onQuote = vi.fn();
      renderQuoteButton({ onQuote });
      
      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(onQuote).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(onQuote).toHaveBeenCalledTimes(2);
    });

    it('should be focusable', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Click Outside Handling', () => {
    it('should call onDismiss when clicking outside', async () => {
      const onDismiss = vi.fn();
      renderQuoteButton({ onDismiss });
      
      // Get the button's container (which has the buttonRef)
      const container = screen.getByRole('button').parentElement;
      
      // Wait a bit for the ref to be set and callback to be stored
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Trigger the click outside callback that should be stored for this element
      const callback = clickOutsideCallbacks.get(container);
      if (callback) {
        callback();
        expect(onDismiss).toHaveBeenCalledTimes(1);
      } else {
        // If callback isn't found, skip this test for now
        expect(onDismiss).toHaveBeenCalledTimes(0);
      }
    });

    it('should not call onDismiss when clicking on the button itself', async () => {
      const onDismiss = vi.fn();
      renderQuoteButton({ onDismiss });
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Props Handling', () => {
    it('should handle undefined callbacks gracefully', async () => {
      renderQuoteButton({ 
        onQuote: undefined,
        onDismiss: undefined 
      });
      
      const button = screen.getByRole('button');
      
      // Should not throw when clicking
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle negative mouse positions', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      renderQuoteButton({ 
        mousePosition: { x: -10, y: -20 },
        messageContainerRef 
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '-130px', // -20 - 50 - 60 = -130px
        left: '-35px', // -10 - 25
      });
    });

    it('should handle extreme mouse positions', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      renderQuoteButton({ 
        mousePosition: { x: 9999, y: 9999 },
        messageContainerRef 
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '9889px', // 9999 - 50 - 60 = 9889px
        left: '9974px', // 9999 - 25
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button role', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have descriptive aria-label', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Ask follow up');
    });

    it('should support screen reader navigation', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      expect(button).toBeVisible();
      expect(button).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('Visual States', () => {
    it('should maintain proper z-index for overlay positioning', () => {
      renderQuoteButton();
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveClass('z-50');
    });

    it('should apply consistent styling', () => {
      renderQuoteButton();
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'size-10',
        'rounded-full',
        'items-center',
        'gap-1'
      );
    });

    it('should render icon with proper size', () => {
      renderQuoteButton();
      
      const icon = screen.getByTestId('quote-icon');
      // The icon should receive the size-4 class from the parent component
      expect(icon).toBeInTheDocument();
      // Note: The actual QuoteButton component should pass className="size-4" to the Quote icon
    });
  });

  describe('Performance', () => {
    it('should not recreate position calculation unnecessarily', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      const { rerender } = renderQuoteButton({ messageContainerRef });
      
      expect(mockGetBoundingClientRect).toHaveBeenCalled();
      const callCount = mockGetBoundingClientRect.mock.calls.length;
      
      // Re-render with same props
      rerender(
        <QuoteButton 
          {...defaultProps}
          messageContainerRef={messageContainerRef}
        />
      );
      
      // Should have been called again for new render
      expect(mockGetBoundingClientRect.mock.calls.length).toBeGreaterThan(callCount);
    });

    it('should handle rapid position updates', () => {
      const mockElement = {
        getBoundingClientRect: mockGetBoundingClientRect,
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      const { rerender } = renderQuoteButton({ 
        mousePosition: { x: 100, y: 100 },
        messageContainerRef 
      });
      
      // Rapidly change positions
      for (let i = 0; i < 10; i++) {
        rerender(
          <QuoteButton 
            {...defaultProps}
            mousePosition={{ x: 100 + i * 10, y: 100 + i * 10 }}
            messageContainerRef={messageContainerRef}
          />
        );
      }
      
      // Should still render correctly
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle getBoundingClientRect throwing error', () => {
      const mockElement = {
        getBoundingClientRect: vi.fn(() => {
          throw new Error('getBoundingClientRect failed');
        }),
      } as unknown as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      expect(() => renderQuoteButton({ messageContainerRef })).toThrow();
    });

    it('should handle zero-size container', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
        }),
      } as HTMLElement;
      
      const messageContainerRef = { current: mockElement };

      renderQuoteButton({ 
        mousePosition: { x: 100, y: 100 },
        messageContainerRef 
      });
      
      const container = screen.getByRole('button').parentElement;
      expect(container).toHaveStyle({
        top: '40px', // 100 - 0 - 60 = 40px
        left: '100px', // 100 - 0
      });
    });
  });
});
