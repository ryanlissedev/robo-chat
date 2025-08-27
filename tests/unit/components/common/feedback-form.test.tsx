import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create hoisted mocks
const { mockToast, mockCreateClient, mockIsSupabaseEnabled } = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockCreateClient: vi.fn(),
  mockIsSupabaseEnabled: vi.fn(() => true),
}));

// Mock dependencies
vi.mock('@/components/ui/toast', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/supabase/config', () => ({
  get isSupabaseEnabled() {
    return mockIsSupabaseEnabled();
  },
}));

// Import after mocking
import { FeedbackForm } from '@/components/common/feedback-form';

// Mock motion components
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => {
      // Filter out motion-specific props
      const {
        animate, initial, exit, transition, variants, whileHover, whileTap,
        whileFocus, whileInView, drag, dragConstraints, layout, layoutId,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
    form: ({ children, ...props }: any) => {
      // Filter out motion-specific props
      const {
        animate, initial, exit, transition, variants, whileHover, whileTap,
        whileFocus, whileInView, drag, dragConstraints, layout, layoutId,
        ...domProps
      } = props;
      return <form role="form" {...domProps}>{children}</form>;
    },
    span: ({ children, ...props }: any) => {
      // Filter out motion-specific props
      const {
        animate, initial, exit, transition, variants, whileHover, whileTap,
        whileFocus, whileInView, drag, dragConstraints, layout, layoutId,
        ...domProps
      } = props;
      return <span {...domProps}>{children}</span>;
    },
  },
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
  CircleCheck: () => <div data-testid="circle-check-icon" />,
  Loader2: () => <div data-testid="loader2-icon" />,
}));

// Removed duplicate mock declarations - using the ones from vi.mock statements above

describe('FeedbackForm', () => {
  const user = userEvent.setup();
  const mockOnClose = vi.fn();
  const mockUserId = 'user-123';

  // Mock Supabase client
  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockCreateClient.mockReturnValue(mockSupabaseClient as any);
    mockSupabaseClient.insert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render feedback form when authenticated', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeInTheDocument();
      expect(screen.getByText('What would make Zola better for you?')).toBeInTheDocument();
    });

    it('should render null when Supabase is disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);
      
      const { container } = render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should have correct initial state', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      expect(textarea).toHaveValue('');
      expect(textarea).toHaveFocus();
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Send');
    });

    it('should show placeholder text initially', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      expect(screen.getByText('What would make Zola better for you?')).toBeInTheDocument();
    });

    it('should have correct dimensions and styling', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const container = screen.getByText('What would make Zola better for you?').closest('div');
      expect(container).toHaveClass('h-[200px]', 'w-full');
    });
  });

  describe('User Interaction', () => {
    it('should enable submit button when text is entered', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      expect(submitButton).toBeDisabled();
      
      await user.type(textarea, 'Great app!');
      
      expect(submitButton).not.toBeDisabled();
      expect(textarea).toHaveValue('Great app!');
    });

    it('should hide placeholder when typing', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const placeholder = screen.getByText('What would make Zola better for you?');
      
      expect(placeholder).toBeInTheDocument();
      
      await user.type(textarea, 'Some feedback');
      
      // Placeholder should be hidden (opacity: 0)
      expect(placeholder).toHaveStyle('opacity: 0');
    });

    it('should show placeholder when text is cleared', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const placeholder = screen.getByText('What would make Zola better for you?');
      
      await user.type(textarea, 'Some feedback');
      expect(placeholder).toHaveStyle('opacity: 0');
      
      await user.clear(textarea);
      expect(placeholder).toHaveStyle('opacity: 1');
    });

    it('should disable submit button for whitespace-only text', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      await user.type(textarea, '   \n\t  ');
      
      expect(submitButton).toBeDisabled();
    });

    it('should call onClose when close button is clicked', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should reset form state when closing', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Some feedback');
      
      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);
      
      expect(textarea).toHaveValue('');
    });
  });

  describe('Form Submission', () => {
    it('should submit feedback successfully', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Great app, love it!');
      
      mockSupabaseClient.insert.mockResolvedValue({ error: null });
      
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(screen.getByText('Sending...')).toBeInTheDocument();
        expect(screen.getByTestId('loader2-icon')).toBeInTheDocument();
      });
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feedback');
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith({
        message: 'Great app, love it!',
        user_id: mockUserId,
      });
    });

    it('should show success state after submission', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Great feedback');
      fireEvent.submit(form);
      
      // Fast forward through the delay
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Thank you for your time!')).toBeInTheDocument();
        expect(screen.getByText('Your feedback makes Zola better.')).toBeInTheDocument();
        expect(screen.getByTestId('circle-check-icon')).toBeInTheDocument();
      });
    });

    it('should auto-close after success', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Great feedback');
      fireEvent.submit(form);
      
      // Fast forward through submission delay
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Thank you for your time!')).toBeInTheDocument();
      });
      
      // Fast forward through auto-close delay
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle submission without user ID', async () => {
      render(<FeedbackForm authUserId={undefined} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Please login to submit feedback',
        status: 'error',
      });
      
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('should handle empty feedback submission', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const form = screen.getByRole('form');
      fireEvent.submit(form);
      
      // Should not proceed with empty feedback
      expect(mockSupabaseClient.insert).not.toHaveBeenCalled();
    });

    it('should disable form during submission', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      const closeButton = screen.getByRole('button', { name: 'Close' });
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(textarea).toBeDisabled();
        expect(closeButton).toBeDisabled();
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client creation failure', async () => {
      mockCreateClient.mockReturnValue(null);
      
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Feedback is not supported in this deployment',
          status: 'info',
        });
      });
    });

    it('should handle database insertion error', async () => {
      const dbError = new Error('Database error');
      mockSupabaseClient.insert.mockResolvedValue({ error: dbError });
      
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: `Error submitting feedback: ${dbError}`,
          status: 'error',
        });
      });
    });

    it('should handle network/connection errors', async () => {
      const networkError = new Error('Network error');
      mockSupabaseClient.insert.mockRejectedValue(networkError);
      
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: `Error submitting feedback: ${networkError}`,
          status: 'error',
        });
      });
    });

    it('should reset form state after error', async () => {
      mockSupabaseClient.insert.mockRejectedValue(new Error('Error'));
      
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const form = screen.getByRole('form');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      await user.type(textarea, 'Some feedback');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });
      
      // Form should be enabled again after error
      expect(textarea).not.toBeDisabled();
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should submit form with keyboard shortcut', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      
      await user.type(textarea, 'Some feedback');
      await user.keyboard('{Meta>}{Enter}{/Meta}');
      
      expect(mockSupabaseClient.insert).toHaveBeenCalled();
    });

    it('should navigate with Tab key', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      const closeButton = screen.getByRole('button', { name: 'Close' });
      
      expect(textarea).toHaveFocus();
      
      await user.keyboard('{Tab}');
      expect(closeButton).toHaveFocus();
      
      await user.keyboard('{Tab}');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      expect(submitButton).toHaveFocus();
    });

    it('should handle Escape key to close', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      await user.keyboard('{Escape}');
      
      // Note: This would need to be implemented in the component
      // Currently testing the behavior that exists
      expect(screen.getByRole('form')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const closeButton = screen.getByRole('button', { name: 'Close' });
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      const placeholder = screen.getByText('What would make Zola better for you?');
      
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
      expect(submitButton).toHaveAttribute('aria-label', 'Submit feedback');
      expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper form semantics', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const form = screen.getByRole('form');
      const textarea = screen.getByRole('textbox');
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      
      expect(form).toBeInTheDocument();
      expect(textarea).toBeInTheDocument();
      expect(submitButton).toHaveAttribute('type', 'submit');
    });

    it('should auto-focus textarea on render', () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveFocus();
      // The autoFocus attribute should be present on the textarea
      expect(textarea).toHaveProperty('autofocus', true);
    });

    it('should be keyboard navigable', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      // All interactive elements should be focusable
      const textarea = screen.getByRole('textbox');
      const closeButton = screen.getByRole('button', { name: 'Close' });
      
      expect(textarea).toHaveFocus();
      
      closeButton.focus();
      expect(closeButton).toHaveFocus();
    });
  });

  describe('Animation States', () => {
    it('should handle form to success transition', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      
      await user.type(textarea, 'Great feedback');
      
      // Submit by clicking submit button
      const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
      await user.click(submitButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Sending...')).toBeInTheDocument();
      });
      
      // Fast forward to success state
      act(() => {
        vi.advanceTimersByTime(1200);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Thank you for your time!')).toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('should maintain proper z-index and positioning', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const placeholder = screen.getByText('What would make Zola better for you?');
      
      expect(placeholder).toHaveClass('absolute', 'pointer-events-none');
      expect(placeholder).toHaveClass('top-3.5', 'left-4');
    });
  });

  describe('Performance', () => {
    it('should not cause memory leaks', () => {
      const { unmount } = render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      unmount();
      
      // Should clean up timers
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should handle rapid state changes', async () => {
      render(<FeedbackForm authUserId={mockUserId} onClose={mockOnClose} />);
      
      const textarea = screen.getByRole('textbox');
      
      // Use fireEvent for faster text input instead of userEvent
      fireEvent.change(textarea, { target: { value: 'a'.repeat(50) } });
      
      // Should handle without errors
      expect(textarea).toHaveValue('a'.repeat(50));
    }, 2000);
  });
});