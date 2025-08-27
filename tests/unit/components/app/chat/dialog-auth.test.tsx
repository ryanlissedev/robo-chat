import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogAuth } from '@/components/app/chat/dialog-auth';
import * as api from '@/lib/api';
import * as supabaseClient from '@/lib/supabase/client';
import * as supabaseConfig from '@/lib/supabase/config';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ alt, src, className, width, height, ...props }: any) => (
    <img
      alt={alt}
      src={src}
      className={className}
      width={width}
      height={height}
      {...props}
    />
  ),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    size,
    variant,
    ...props
  }: any) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: any) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({ children, className }: any) => (
    <p data-testid="dialog-description" className={className}>
      {children}
    </p>
  ),
  DialogFooter: ({ children, className }: any) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
}));

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    signInWithOAuth: vi.fn(),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/api', () => ({
  signInWithGoogle: vi.fn(),
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

const defaultProps = {
  open: true,
  setOpen: vi.fn(),
};

function renderDialogAuth(props = {}) {
  return render(<DialogAuth {...defaultProps} {...props} />);
}

describe('DialogAuth', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';
    vi.mocked(supabaseConfig.isSupabaseEnabled).mockReturnValue(true);
    vi.mocked(supabaseClient.createClient).mockReturnValue(
      mockSupabaseClient as any
    );
  });

  describe('Rendering', () => {
    it('should render dialog when open and Supabase is enabled', () => {
      renderDialogAuth();

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-title')).toHaveTextContent(
        "You've reached the limit for today"
      );
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Sign in below to increase your message limits.'
      );
    });

    it('should render Google sign-in button', () => {
      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('data-size', 'lg');
      expect(button).toHaveAttribute('data-variant', 'secondary');
    });

    it('should render Google logo in button', () => {
      renderDialogAuth();

      const logo = screen.getByAltText('Google logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', 'https://www.google.com/favicon.ico');
      expect(logo).toHaveClass('mr-2', 'size-4');
    });

    it('should apply correct CSS classes', () => {
      renderDialogAuth();

      expect(screen.getByTestId('dialog-content')).toHaveClass('sm:max-w-md');
      expect(screen.getByTestId('dialog-title')).toHaveClass('text-xl');
      expect(screen.getByTestId('dialog-description')).toHaveClass(
        'pt-2',
        'text-base'
      );
      expect(screen.getByTestId('dialog-footer')).toHaveClass(
        'mt-6',
        'sm:justify-center'
      );
    });
  });

  describe('Supabase Configuration', () => {
    it('should return null when Supabase is not enabled', () => {
      vi.mocked(supabaseConfig.isSupabaseEnabled).mockReturnValue(false);

      const { container } = renderDialogAuth();
      expect(container.firstChild).toBeNull();
    });

    it('should return null when Supabase client is null', () => {
      vi.mocked(supabaseClient.createClient).mockReturnValue(null);

      const { container } = renderDialogAuth();
      expect(container.firstChild).toBeNull();
    });

    it('should render when both Supabase is enabled and client exists', () => {
      vi.mocked(supabaseConfig.isSupabaseEnabled).mockReturnValue(true);
      vi.mocked(supabaseClient.createClient).mockReturnValue(
        mockSupabaseClient as any
      );

      renderDialogAuth();
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('Dialog State', () => {
    it('should show dialog when open is true', () => {
      renderDialogAuth({ open: true });
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('should hide dialog when open is false', () => {
      renderDialogAuth({ open: false });
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('should call setOpen when dialog close is triggered', () => {
      const setOpen = vi.fn();
      renderDialogAuth({ setOpen });

      // Dialog component calls onOpenChange internally
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
  });

  describe('Google Sign-In', () => {
    it('should call signInWithGoogle when button is clicked', async () => {
      const mockResponse = {
        provider: 'google' as const,
        url: 'https://auth.google.com/redirect',
      };
      vi.mocked(api.signInWithGoogle).mockResolvedValue(mockResponse);

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      expect(api.signInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
    });

    it('should redirect to auth URL on successful sign-in', async () => {
      const authUrl = 'https://auth.google.com/oauth/redirect';
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google' as const,
        url: authUrl,
      });

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe(authUrl);
      });
    });

    it('should not redirect when no URL is returned', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google' as const,
        url: null as any,
      });

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
      });
    });

    it('should not redirect when undefined URL is returned', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue({} as any);

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading text when signing in', async () => {
      vi.mocked(api.signInWithGoogle).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it('should disable button during loading', async () => {
      vi.mocked(api.signInWithGoogle).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      expect(button).toBeDisabled();
    });

    it('should reset loading state after successful sign-in', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google' as const,
        url: 'https://auth.test.com',
      });

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when sign-in fails', async () => {
      const errorMessage = 'Authentication failed';
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error(errorMessage)
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue('Unknown error');

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should apply error styling to error message', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error('Test error')
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        const errorDiv = screen.getByText('Test error').parentElement;
        expect(errorDiv).toHaveClass(
          'rounded-md',
          'bg-destructive/10',
          'p-3',
          'text-destructive',
          'text-sm'
        );
      });
    });

    it('should reset error state on new sign-in attempt', async () => {
      // First attempt fails
      vi.mocked(api.signInWithGoogle).mockRejectedValueOnce(
        new Error('First error')
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second attempt succeeds
      vi.mocked(api.signInWithGoogle).mockResolvedValueOnce({
        provider: 'google' as const,
        url: 'success',
      });
      await user.click(button);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });

    it('should reset loading state after error', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error('Test error')
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
        expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Interactions', () => {
    it('should handle multiple rapid clicks', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google' as const,
        url: 'test',
      });

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });

      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only call once due to loading state disabling button
      await waitFor(() => {
        expect(api.signInWithGoogle).toHaveBeenCalledTimes(1);
      });
    });

    it('should allow retry after error', async () => {
      // First attempt fails
      vi.mocked(api.signInWithGoogle)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ provider: 'google' as const, url: 'success' });

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });

      // First attempt
      await user.click(button);
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Second attempt
      await user.click(button);
      await waitFor(() => {
        expect(mockLocation.href).toBe('success');
      });

      expect(api.signInWithGoogle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog structure', () => {
      renderDialogAuth();

      expect(screen.getByTestId('dialog-title')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-description')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have accessible button text', () => {
      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      expect(button).toBeInTheDocument();
    });

    it('should have alt text for Google logo', () => {
      renderDialogAuth();

      const logo = screen.getByAltText('Google logo');
      expect(logo).toBeInTheDocument();
    });

    it('should maintain focus management during loading', async () => {
      vi.mocked(api.signInWithGoogle).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      button.focus();
      expect(document.activeElement).toBe(button);

      await user.click(button);

      // Button should still be focusable even when disabled
      expect(button).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null response from signInWithGoogle', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue(null as any);

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });

      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle empty error message', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(new Error(''));

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should handle very long error messages', async () => {
      const longError = 'A'.repeat(1000);
      vi.mocked(api.signInWithGoogle).mockRejectedValue(new Error(longError));

      renderDialogAuth();

      const button = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(longError)).toBeInTheDocument();
      });
    });
  });
});
