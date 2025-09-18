import React from 'react';
import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { DialogAuth } from '@/components/app/chat/dialog-auth';
import {
  createMockSupabaseClient,
  setupTestEnvironment,
  resetEnvironment
} from '../../../../utils/supabase-mocks';

// Mock Next.js Image component - minimal mock
vi.mock('next/image', () => ({
  default: ({ alt, src, ...props }: any) => (
    <img alt={alt} src={src} {...props} />
  ),
}));

// Hoisted mocks - create fresh instances for each module
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
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={className}
      data-size={size}
      data-variant={variant}
      data-slot="button"
      data-testid="auth-button"
      aria-disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock window.location with proper href handling
const mockLocationObj = {
  _href: '',
  get href() { return this._href; },
  set href(value) { this._href = value; },
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn(),
};

// Store original location to restore later
const originalLocation = window.location;

// Replace window.location entirely with our mock
delete window.location;
window.location = mockLocationObj as any;

const defaultProps = {
  open: true,
  setOpen: vi.fn(),
};

function renderDialogAuth(props = {}) {
  return render(<DialogAuth {...defaultProps} {...props} />);
}

function getFirstAuthButton() {
  const buttons = screen.queryAllByTestId('auth-button');
  expect(buttons.length).toBeGreaterThan(0);
  return buttons[0];
}

async function clickAuthButton(button: HTMLElement) {
  await act(async () => {
    await userEvent.click(button);
  });
}

describe('DialogAuth', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset window.location
    mockLocationObj._href = '';

    // Setup test environment with Supabase enabled
    setupTestEnvironment(true);

    // Create fresh mock client
    mockSupabaseClient = createMockSupabaseClient();

    // Clear all mocks AFTER setting up environment
    vi.clearAllMocks();

    // Setup mocks with consistent return values - must be AFTER clearAllMocks
    mockIsSupabaseEnabled.mockReturnValue(true);
    mockCreateClient.mockReturnValue(mockSupabaseClient);
    mockSignInWithGoogle.mockResolvedValue({
      provider: 'google' as const,
      url: 'https://auth.google.com/default',
    });

    // Setup userEvent
    user = userEvent.setup();
  });

  afterEach(() => {
    cleanup();
    resetEnvironment();
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

      const buttons = screen.queryAllByTestId('auth-button');
      expect(buttons.length).toBeGreaterThan(0);
      const button = buttons[0];
      expect(button).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });

    it('should render Google logo in button', () => {
      renderDialogAuth();

      const logos = screen.queryAllByAltText('Google logo');
      expect(logos.length).toBeGreaterThan(0);
      const logo = logos[0];
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', 'https://www.google.com/favicon.ico');
    });

    // Move critical interaction tests here to avoid describe block isolation issues
    it('should call signInWithGoogle when button is clicked', async () => {
      const mockResponse = {
        provider: 'google' as const,
        url: 'https://auth.google.com/redirect',
      };
      mockSignInWithGoogle.mockResolvedValue(mockResponse);

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

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

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      // Wait for the async operation and redirect
      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
      });

      await waitFor(() => {
        expect(window.location.href).toBe(authUrl);
      }, { timeout: 2000 });
    });

    it('should show loading text when signing in', async () => {
      let resolvePromise: (value: { provider: 'google'; url: string }) => void;
      const signInPromise = new Promise<{ provider: 'google'; url: string }>((resolve) => {
        resolvePromise = resolve;
      });

      mockSignInWithGoogle.mockReturnValue(signInPromise);

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      // Wait for loading state to appear
      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      resolvePromise!({
        provider: 'google' as const,
        url: 'https://auth.google.com',
      });
    });

    // Move remaining critical tests from failing describe blocks

    it('should not redirect when no URL is returned', async () => {
      mockSignInWithGoogle.mockResolvedValue({
        provider: 'google' as const,
        url: null as any,
      });

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(window.location.href).toBe('');
      });
    });

    it('should not redirect when undefined URL is returned', async () => {
      mockSignInWithGoogle.mockResolvedValue({} as any);

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(window.location.href).toBe('');
      });
    });

    it('should disable button during loading', async () => {
      let resolvePromise: (value: { provider: 'google'; url: string }) => void;
      const signInPromise = new Promise<{ provider: 'google'; url: string }>((resolve) => {
        resolvePromise = resolve;
      });

      mockSignInWithGoogle.mockReturnValue(signInPromise);

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      // Wait for the button to become disabled and show loading text
      await waitFor(() => {
        expect(button).toBeDisabled();
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });

      // Resolve the promise to clean up
      act(() => {
        resolvePromise!({ provider: 'google', url: 'test' });
      });
    });

    it('should reset loading state after successful sign-in', async () => {
      mockSignInWithGoogle.mockResolvedValue({
        provider: 'google' as const,
        url: 'https://auth.test.com',
      });

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      });
    });

    it('should display error message when sign-in fails', async () => {
      const errorMessage = 'Authentication failed';
      mockSignInWithGoogle.mockRejectedValue(new Error(errorMessage));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await act(async () => {
        await clickAuthButton(button);
      });

      // Wait for the error to be processed and displayed
      await waitFor(() => {
        expect(mockSignInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
      });

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display generic error for unknown errors', async () => {
      mockSignInWithGoogle.mockRejectedValue('Unknown error');

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should apply error styling to error message', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('Test error'));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        const errorMessage = screen.getByText('Test error');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.closest('div')).toHaveClass('bg-destructive/10');
      });
    });

    it('should reset error state on new sign-in attempt', async () => {
      // First attempt fails
      mockSignInWithGoogle.mockRejectedValueOnce(new Error('First error'));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second attempt succeeds
      mockSignInWithGoogle.mockResolvedValueOnce({
        provider: 'google' as const,
        url: 'success',
      });

      await clickAuthButton(button);

      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });

    it('should reset loading state after error', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error('Test error'));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
        expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      });
    });

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

      const button = getFirstAuthButton();

      // Click once and wait for state changes
      await act(async () => {
        await clickAuthButton(button);
      });

      // Wait for first click to process and button to disable
      await waitFor(() => {
        expect(button).toBeDisabled();
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });

      // Try clicking again - should not trigger additional calls
      await clickAuthButton(button);
      await clickAuthButton(button);

      // Should only call once due to loading state disabling button
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);

      // Resolve the promise to clean up
      act(() => {
        resolveSignIn({ provider: 'google', url: 'test' });
      });
    });

    it('should allow retry after error', async () => {
      // First attempt fails
      mockSignInWithGoogle
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ provider: 'google' as const, url: 'success' });

      renderDialogAuth();

      const button = getFirstAuthButton();

      // First attempt
      await clickAuthButton(button);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });

      // Second attempt
      await clickAuthButton(button);

      await waitFor(() => {
        expect(window.location.href).toBe('success');
      });

      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(2);
    });

    it('should have proper dialog structure', () => {
      renderDialogAuth();

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByText("You've reached the limit for today")
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in below to increase your message limits.')
      ).toBeInTheDocument();
      expect(getFirstAuthButton()).toBeInTheDocument();
    });

    it('should have accessible button text', () => {
      renderDialogAuth();

      const button = getFirstAuthButton();
      expect(button).toBeInTheDocument();
    });

    it('should have alt text for Google logo', () => {
      renderDialogAuth();

      const logos = screen.queryAllByAltText('Google logo');
      expect(logos.length).toBeGreaterThan(0);
      const logo = logos[0];
      expect(logo).toBeInTheDocument();
    });

    it('should maintain focus management during loading', async () => {
      let resolvePromise: (value: { provider: 'google'; url: string }) => void;
      const signInPromise = new Promise<{ provider: 'google'; url: string }>((resolve) => {
        resolvePromise = resolve;
      });

      mockSignInWithGoogle.mockReturnValue(signInPromise);

      renderDialogAuth();

      const button = getFirstAuthButton() as HTMLButtonElement;
      button.focus();
      expect(document.activeElement).toBe(button);

      await clickAuthButton(button);

      // Wait for loading state to kick in
      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Button should still be the focused element even when disabled
      await waitFor(() => {
        expect(button).toHaveFocus();
      });

      // Resolve the promise to clean up
      resolvePromise!({ provider: 'google', url: 'test' });
    });

    it('should handle null response from signInWithGoogle', async () => {
      mockSignInWithGoogle.mockResolvedValue(null as any);

      renderDialogAuth();

      const button = getFirstAuthButton();

      await expect(user.click(button)).resolves.not.toThrow();
    });

    it('should handle empty error message', async () => {
      mockSignInWithGoogle.mockRejectedValue(new Error(''));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await act(async () => {
        await clickAuthButton(button);
      });

      await waitFor(() => {
        expect(
          screen.getByText('An unexpected error occurred. Please try again.')
        ).toBeInTheDocument();
      });
    });

    it('should handle very long error messages', async () => {
      const longError = 'A'.repeat(1000);
      mockSignInWithGoogle.mockRejectedValue(new Error(longError));

      renderDialogAuth();

      const button = getFirstAuthButton();

      await clickAuthButton(button);

      await waitFor(() => {
        expect(screen.getByText(longError)).toBeInTheDocument();
      });
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

});
