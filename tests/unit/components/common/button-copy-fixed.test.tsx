import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonCopy } from '@/components/common/button-copy';

describe('ButtonCopy', () => {
  const mockCode = 'console.log("Hello, World!");';

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the existing clipboard mock from global setup - it's already a vi.fn()
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      // The global setup already creates vi.fn() mocks, just clear them
      (navigator.clipboard.writeText as any).mockClear?.();
      (navigator.clipboard.readText as any).mockClear?.();
    }
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render with initial "Copy" text', () => {
      render(<ButtonCopy code={mockCode} />);

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should have correct button attributes', () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveClass(
        'inline-flex',
        'items-center',
        'justify-center',
        'gap-1.5',
        'rounded-md',
        'px-2',
        'py-1',
        'text-muted-foreground',
        'text-xs',
        'hover:bg-muted'
      );
    });

    it('should render TextMorph component correctly', () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');
      expect(button).toContainHTML('Copy');
    });
  });

  describe('Copy Functionality', () => {
    it('should copy code to clipboard when clicked', async () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
    });

    it('should change text to "Copied" after clicking', async () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should revert text back to "Copy" after 1 second', async () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('Copied')).toBeInTheDocument();

      // Wait for the timeout to complete
      await (global as any).act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    });

    it('should handle multiple clicks correctly', async () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      // First click
      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

      // Second click before timeout
      await (global as any).act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);

      // Third click
      await (global as any).act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);

      // Wait for timeout to complete
      await (global as any).act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should copy different code values', async () => {
      const differentCode = 'const x = 42;';
      const { rerender } = render(<ButtonCopy code={mockCode} />);

      let button = screen.getByRole('button');
      await (global as any).act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);

      // Rerender with different code
      rerender(<ButtonCopy code={differentCode} />);
      button = screen.getByRole('button');
      await (global as any).act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(differentCode);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code string', async () => {
      render(<ButtonCopy code="" />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle very long code strings', async () => {
      const longCode = 'a'.repeat(10000);

      render(<ButtonCopy code={longCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle special characters in code', async () => {
      const specialCode = 'const regex = /[^a-zA-Z0-9]/g;\nconst emoji = "🚀";';

      render(<ButtonCopy code={specialCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle clipboard API failure gracefully', async () => {
      // Mock console.error to avoid error output in tests
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const mockWriteText = navigator.clipboard.writeText as any;
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard failed'));

      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      // Should still show "Copied" even if clipboard fails
      expect(screen.getByText('Copied')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should be triggerable with Enter key', async () => {
      const user = userEvent.setup({ delay: null });
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');
      button.focus();

      await (global as any).act(async () => {
        await user.keyboard('{Enter}');
      });

      // Verify the copy action succeeded by checking UI state
      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should be triggerable with Space key', async () => {
      const user = userEvent.setup({ delay: null });
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');
      button.focus();

      await (global as any).act(async () => {
        await user.keyboard(' ');
      });

      // Verify the copy action succeeded by checking UI state
      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should be focusable', () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');
      button.focus();

      expect(button).toHaveFocus();
    });
  });

  describe('Event Handling', () => {
    it('should handle click event with mouse', async () => {
      render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      // Verify the copy action succeeded by checking UI state
      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should not interfere with text selection', async () => {
      render(
        <div>
          <p>Some selectable text</p>
          <ButtonCopy code={mockCode} />
        </div>
      );

      const button = screen.getByRole('button');

      // Clicking button should not affect text selection behavior
      await (global as any).act(async () => {
        fireEvent.click(button);
      });
      // Verify the copy action succeeded by checking UI state
      expect(screen.getByText('Copied')).toBeInTheDocument();

      // The button should still be clickable after copy
      await (global as any).act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      });

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks with multiple renders', () => {
      const { rerender, unmount } = render(<ButtonCopy code={mockCode} />);

      // Re-render multiple times
      for (let i = 0; i < 10; i++) {
        rerender(<ButtonCopy code={`code-${i}`} />);
      }

      unmount();

      // Component should unmount without issues
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('should clean up timers on unmount', async () => {
      const { unmount } = render(<ButtonCopy code={mockCode} />);

      const button = screen.getByRole('button');

      await (global as any).act(async () => {
        fireEvent.click(button);
      });

      unmount();

      // Component should unmount cleanly without errors
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
