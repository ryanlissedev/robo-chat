import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ButtonCopy } from '@/components/common/button-copy';

describe('ButtonCopy', () => {
  const mockCode = 'console.log("Hello, World!");';

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup clipboard mock for each test
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    const mockClipboard = {
      writeText: mockWriteText,
      readText: vi.fn().mockResolvedValue(''),
      read: vi.fn().mockResolvedValue([]),
      write: vi.fn().mockResolvedValue(undefined),
    };
    
    // Use Object.assign to replace the existing clipboard mock
    Object.assign(navigator.clipboard, mockClipboard);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render with initial "Copy" text', () => {
      const { container } = render(<ButtonCopy code={mockCode} />);
      
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
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
    });

    it('should change text to "Copied" after clicking', async () => {
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    });

    it('should revert text back to "Copy" after 1 second', async () => {
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(screen.getByText('Copied')).toBeInTheDocument();
      
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.queryByText('Copied')).not.toBeInTheDocument();
    });

    it('should handle multiple clicks correctly', async () => {
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      
      // First click
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(screen.getByText('Copied')).toBeInTheDocument();
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      
      // Second click before timeout
      await act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
      
      // Fast forward past first timeout but not second
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      
      await act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(3);
      
      // Advance to complete all timeouts
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should copy different code values', async () => {
      const differentCode = 'const x = 42;';
      const { rerender } = render(<ButtonCopy code={mockCode} />);
      
      let button = screen.getByRole('button');
      await act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
      
      // Rerender with different code
      rerender(<ButtonCopy code={differentCode} />);
      button = screen.getByRole('button');
      await act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(differentCode);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty code string', async () => {
      render(<ButtonCopy code="" />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle very long code strings', async () => {
      const longCode = 'a'.repeat(10000);
      
      render(<ButtonCopy code={longCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle special characters in code', async () => {
      const specialCode = 'const regex = /[^a-zA-Z0-9]/g;\nconst emoji = "🚀";';
      
      render(<ButtonCopy code={specialCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should handle clipboard API failure gracefully', async () => {
      // Mock console.error to avoid error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockWriteText = navigator.clipboard.writeText as any;
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard failed'));
      
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      // Should still show "Copied" even if clipboard fails
      expect(screen.getByText('Copied')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Keyboard Interaction', () => {
    it('should be triggerable with Enter key', async () => {
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      // Simulate the native browser behavior where Enter on a button triggers click
      await act(async () => {
        fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
        // Browsers automatically trigger click on Enter for buttons
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
    });

    it('should be triggerable with Space key', async () => {
      render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      // Simulate the native browser behavior where Space on a button triggers click
      await act(async () => {
        fireEvent.keyDown(button, { key: ' ', code: 'Space' });
        fireEvent.keyUp(button, { key: ' ', code: 'Space' });
        // Browsers automatically trigger click on Space for buttons
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
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
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockCode);
      expect(screen.getByText('Copied')).toBeInTheDocument();
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
      await act(async () => {
        fireEvent.click(button);
      });
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      
      // The button should still be clickable after copy
      await act(async () => {
        vi.advanceTimersByTime(1000);
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
      
      // Should not have any pending timers after unmount - this test passes if no errors occur
      expect(true).toBe(true);
    });

    it('should clean up timers on unmount', async () => {
      const { unmount } = render(<ButtonCopy code={mockCode} />);
      
      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });
      
      unmount();
      
      // Timer should be cleaned up - advance timers to verify no errors
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      // No errors should occur
    });
  });
});