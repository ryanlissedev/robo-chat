import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogAuth } from '@/components/app/chat/dialog-auth';
import { createMockSupabaseClient } from '../../../../utils/supabase-mocks';

// Mock Next.js Image component - minimal mock
vi.mock('next/image', () => ({
  default: ({ alt, src, ...props }: any) => (
    <img alt={alt} src={src} {...props} />
  ),
}));

// Hoisted mocks
const mockSignInWithGoogle = vi.hoisted(() => vi.fn());
const mockIsSupabaseEnabled = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  signInWithGoogle: mockSignInWithGoogle,
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: mockIsSupabaseEnabled,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: mockCreateClient,
}));

// Mock UI Dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) =>
    open ? (
      <div role="dialog" data-testid="dialog">
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: any) => (
    <div className={className} data-testid="dialog-content">
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: any) => (
    <h2 className={className} data-slot="dialog-title">
      {children}
    </h2>
  ),
  DialogDescription: ({ children, className }: any) => (
    <p className={className} data-slot="dialog-description">
      {children}
    </p>
  ),
  DialogFooter: ({ children, className }: any) => (
    <div className={className} data-testid="dialog-footer">
      {children}
    </div>
  ),
}));

// Mock UI Button component
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
      data-slot="button"
      data-testid="auth-button"
      {...props}
    >
      {children}
    </button>
  ),
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
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockLocation.href = '';
    vi.clearAllMocks();

    // Create mock client
    mockSupabaseClient = createMockSupabaseClient();

    // Setup default mock implementations
    mockIsSupabaseEnabled.mockReturnValue(true);
    mockCreateClient.mockReturnValue(mockSupabaseClient);
  });

  describe('Rendering', () => {
    it('should render dialog when open and Supabase is enabled', () => {
      renderDialogAuth();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText("You've reached the limit for today")
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in below to increase your message limits.')
      ).toBeInTheDocument();
    });

    it('should render Google sign-in button', () => {
      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should render Google logo in button', () => {
      renderDialogAuth();

      const logo = screen.getByAltText('Google logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', 'https://www.google.com/favicon.ico');
    });
  });

  describe('Supabase Configuration', () => {
    it('should not render when Supabase is not enabled', () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { container } = renderDialogAuth();
      expect(container.firstChild).toBeNull();
    });

    it('should not render when Supabase client is null', () => {
      mockCreateClient.mockReturnValue(null);

      const { container } = renderDialogAuth();
      expect(container.firstChild).toBeNull();
    });

    it('should render when both Supabase is enabled and client exists', () => {
      mockIsSupabaseEnabled.mockReturnValue(true);
      mockCreateClient.mockReturnValue(mockSupabaseClient);

      renderDialogAuth();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Dialog State', () => {
    it('should show dialog when open is true', () => {
      renderDialogAuth({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should hide dialog when open is false', () => {
      renderDialogAuth({ open: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Google Sign-In', () => {
    it('should call signInWithGoogle when button is clicked', async () => {
      const mockResponse = {
        provider: 'google' as const,
        url: 'https://auth.google.com/redirect',
      };
      mockSignInWithGoogle.mockResolvedValue(mockResponse);

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
      });
    });

    it('should redirect to auth URL on successful sign-in', async () => {
      const authUrl = 'https://auth.google.com/oauth/redirect';
      mockSignInWithGoogle.mockResolvedValue({
        provider: 'google' as const,
        url: authUrl,
      });

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe(authUrl);
      });
    });

    it('should not redirect when no URL is returned', async () => {
      mockSignInWithGoogle.mockResolvedValue({
        provider: 'google' as const,
        url: null as any,
      });

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
      });
    });

    it('should not redirect when undefined URL is returned', async () => {
      mockSignInWithGoogle.mockResolvedValue({} as any);

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await user.click(button);

      await waitFor(() => {
        expect(mockLocation.href).toBe('');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading text when signing in', async () => {
      mockSignInWithGoogle.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
        expect(button).toBeDisabled();
      });
    });

    it('should disable button during loading', async () => {
      mockSignInWithGoogle.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(button).toBeDisabled();
    });

    it('should reset loading state after successful sign-in', async () => {
      mockSignInWithGoogle.mockResolvedValue({
        provider: 'google' as const,
        url: 'https://auth.test.com',
      });

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when sign-in fails', async () => {
      const errorMessage = 'Authentication failed';
      mockSignInWithGoogle.mockRejectedValue(new Error(errorMessage));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should display generic error for unknown errors', async () => {
      mockSignInWithGoogle.mockRejectedValue('Unknown error');

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });

    it('should apply error styling to error message', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('Test error'));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      const errorMessage = screen.getByText('Test error');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage.closest('div')).toHaveClass('bg-destructive/10');
    });

    it('should reset error state on new sign-in attempt', async () => {
      // First attempt fails
      mockSignInWithGoogle.mockRejectedValueOnce(new Error('First error'));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(screen.getByText('First error')).toBeInTheDocument();

      // Second attempt succeeds
      mockSignInWithGoogle.mockResolvedValueOnce({
        provider: 'google' as const,
        url: 'success',
      });
      await act(async () => {
        await user.click(button);
      });

      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });

    it('should reset loading state after error', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('Test error'));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(button).not.toBeDisabled();
      expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });
  });

  describe('Multiple Interactions', () => {
    it('should handle multiple rapid clicks', async () => {
      let resolveSignIn: (value: { provider: 'google'; url: string }) => void =
        () => {};
      const signInPromise = new Promise<{ provider: 'google'; url: string }>(
        (resolve) => {
          resolveSignIn = resolve;
        }
      );
      mockSignInWithGoogle.mockReturnValue(signInPromise);

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');

      // Click multiple times rapidly - use single act() to avoid overlapping
      await act(async () => {
        await user.click(button);
        await user.click(button);
        await user.click(button);
      });

      // Should only call once due to loading state disabling button
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(button).toBeDisabled();

      // Resolve the promise to clean up
      await act(async () => {
        resolveSignIn({ provider: 'google', url: 'test' });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    });

    it('should allow retry after error', async () => {
      // First attempt fails
      mockSignInWithGoogle
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ provider: 'google' as const, url: 'success' });

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');

      // First attempt
      await act(async () => {
        await user.click(button);
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();

      // Second attempt
      await act(async () => {
        await user.click(button);
      });
      expect(mockLocation.href).toBe('success');

      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog structure', () => {
      renderDialogAuth();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText("You've reached the limit for today")
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in below to increase your message limits.')
      ).toBeInTheDocument();
      expect(screen.getByTestId('auth-button')).toBeInTheDocument();
    });

    it('should have accessible button text', () => {
      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      expect(button).toBeInTheDocument();
    });

    it('should have alt text for Google logo', () => {
      renderDialogAuth();

      expect(screen.getByAltText('Google logo')).toBeInTheDocument();
    });

    it('should maintain focus management during loading', async () => {
      mockSignInWithGoogle.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ provider: 'google' as const, url: 'test' }),
              100
            )
          )
      );

      renderDialogAuth();

      const button = screen.getByTestId('auth-button') as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);

      await act(async () => {
        await user.click(button);
      });

      // Button should still be focusable even when disabled
      expect(button).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null response from signInWithGoogle', async () => {
      mockSignInWithGoogle.mockResolvedValue(null as any);

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle empty error message', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error(''));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });

    it('should handle very long error messages', async () => {
      const longError = 'A'.repeat(1000);
      mockSignInWithGoogle.mockRejectedValue(new Error(longError));

      renderDialogAuth();

      const button = screen.getByTestId('auth-button');
      await act(async () => {
        await user.click(button);
      });

      expect(screen.getByText(longError)).toBeInTheDocument();
    });
  });
});
