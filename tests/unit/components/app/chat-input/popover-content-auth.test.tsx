import { cleanup, render, screen, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopoverContentAuth } from '@/components/app/chat-input/popover-content-auth';
import * as api from '@/lib/api';
import * as config from '@/lib/config';
import * as supabaseClient from '@/lib/supabase/client';
import * as supabaseConfig from '@/lib/supabase/config';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, className, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      className={className}
      {...props}
      data-testid="next-image"
    />
  ),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    disabled,
    size,
    variant,
    ...props
  }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  PopoverContent: ({ children, align, className, side }: any) => (
    <div
      data-testid="popover-content"
      data-align={align}
      data-side={side}
      className={className}
    >
      {children}
    </div>
  ),
}));

// Mock lib functions
vi.mock('@/lib/api', () => ({
  signInWithGoogle: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/config', () => ({
  APP_NAME: 'TestApp',
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

function renderPopoverContentAuth(props = {}) {
  cleanup(); // Clean up before each render
  return render(<PopoverContentAuth {...props} />);
}

describe('PopoverContentAuth', () => {
  const user = userEvent.setup();
  const mockSupabaseClient = {
    auth: {
      signInWithOAuth: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = '';

    // Setup mocks using the imported modules
    vi.mocked(supabaseConfig.isSupabaseEnabled).mockReturnValue(true);
    vi.mocked(supabaseClient.createClient).mockReturnValue(
      mockSupabaseClient as any
    );
    vi.mocked(api.signInWithGoogle).mockResolvedValue({
      provider: 'google',
      url: 'https://auth.google.com/oauth',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Supabase disabled', () => {
    it('should return null when Supabase is disabled', () => {
      vi.mocked(supabaseConfig.isSupabaseEnabled).mockReturnValue(false);

      const { container } = renderPopoverContentAuth();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Initial render', () => {
    it('should render popover with banner image', () => {
      renderPopoverContentAuth();

      const bannerImage = screen.getByAltText('calm paint generate by TestApp');
      expect(bannerImage).toBeInTheDocument();
      expect(bannerImage).toHaveAttribute('src', '/banner_forest.jpg');
      expect(bannerImage).toHaveAttribute('width', '300');
      expect(bannerImage).toHaveAttribute('height', '128');
    });

    it('should display login prompt text', () => {
      renderPopoverContentAuth();

      expect(
        screen.getByText('Login to try more features for free')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Add files, use more models, BYOK, and more.')
      ).toBeInTheDocument();
    });

    it('should render Google sign-in button', () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).not.toBeDisabled();
    });

    it('should display Google logo in button', () => {
      renderPopoverContentAuth();

      const googleLogo = screen.getByAltText('Google logo');
      expect(googleLogo).toBeInTheDocument();
      expect(googleLogo).toHaveAttribute(
        'src',
        'https://www.google.com/favicon.ico'
      );
      expect(googleLogo).toHaveAttribute('width', '20');
      expect(googleLogo).toHaveAttribute('height', '20');
    });

    it('should have proper popover content attributes', () => {
      renderPopoverContentAuth();

      const popoverContent = screen.getByTestId('popover-content');
      expect(popoverContent).toHaveAttribute('data-align', 'start');
      expect(popoverContent).toHaveAttribute('data-side', 'top');
      expect(popoverContent).toHaveClass(
        'w-[300px]',
        'overflow-hidden',
        'rounded-xl',
        'p-0'
      );
    });
  });

  describe('Sign-in functionality', () => {
    it('should call signInWithGoogle when button clicked', async () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      
      // Single act() call - remove nested act() calls
      await act(async () => {
        await user.click(signInButton);
      });

      expect(api.signInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
    });

    it('should redirect to auth URL on successful sign-in', async () => {
      const authUrl = 'https://auth.google.com/oauth/redirect';
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google',
        url: authUrl,
      });

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      
      // Single act() call - remove nested act() calls
      await act(async () => {
        await user.click(signInButton);
      });

      // Redirect should be synchronous after act() - no need for waitFor
      expect(mockLocation.href).toBe(authUrl);
    });

    it('should show loading state during sign-in', async () => {
      // Create a promise that we can control
      let resolveSignIn: (value: { provider: 'google'; url: string }) => void =
        () => {};
      const signInPromise = new Promise<{ provider: 'google'; url: string }>(
        (resolve) => {
          resolveSignIn = resolve;
        }
      );
      vi.mocked(api.signInWithGoogle).mockReturnValue(signInPromise);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      
      // Single act() call - remove nested act() calls
      await act(async () => {
        await user.click(signInButton);
      });

      // Should show loading text
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(signInButton).toBeDisabled();

      // Resolve the promise and wait for state updates
      await act(async () => {
        resolveSignIn({ provider: 'google', url: 'https://auth.google.com' });
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Loading state should be cleared after completion - no need for waitFor
      expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
    });

    it('should handle sign-in without redirect URL', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue(
        {} as { provider: 'google'; url: string }
      );

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Should not redirect
      expect(mockLocation.href).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should display error message when sign-in fails', async () => {
      const errorMessage = 'Authentication failed';
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error(errorMessage)
      );

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should display default error message for unknown errors', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue('Unknown error');

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });

    it('should handle Supabase client creation failure', async () => {
      vi.mocked(supabaseClient.createClient).mockReturnValue(null);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(screen.getByText('Supabase is not configured')).toBeInTheDocument();
    });

    it('should clear error on retry', async () => {
      vi.mocked(api.signInWithGoogle)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({
          provider: 'google',
          url: 'https://auth.google.com',
        });

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });

      // First attempt - should fail
      await act(async () => {
        await user.click(signInButton);
      });
      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(screen.getByText('First error')).toBeInTheDocument();

      // Second attempt - should succeed and clear error
      await act(async () => {
        await user.click(signInButton);
      });
      // Error should be cleared synchronously after act() - no need for waitFor
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });

    it('should show error with proper styling', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error('Test error')
      );

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error styling should be applied synchronously after act() - no need for waitFor
      const errorElement = screen.getByText('Test error');
      expect(errorElement.closest('div')).toHaveClass(
        'rounded-md',
        'bg-destructive/10',
        'p-3',
        'text-destructive',
        'text-sm'
      );
    });
  });

  describe('Loading states', () => {
    it('should reset loading state after successful sign-in', async () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Redirect should be synchronous after act() - no need for waitFor
      expect(mockLocation.href).toBe('https://auth.google.com/oauth');

      // Loading state should be reset (though component might unmount after redirect)
      expect(signInButton).not.toBeDisabled();
    });

    it('should reset loading state after error', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(
        new Error('Test error')
      );

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(screen.getByText('Test error')).toBeInTheDocument();

      expect(signInButton).not.toBeDisabled();
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    });
  });

  describe('Button styling', () => {
    it('should have proper button styling', () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      expect(signInButton).toHaveClass('w-full', 'text-base');
      expect(signInButton).toHaveAttribute('data-size', 'lg');
      expect(signInButton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should have proper Google logo styling', () => {
      renderPopoverContentAuth();

      const googleLogo = screen.getByAltText('Google logo');
      expect(googleLogo).toHaveClass('mr-2', 'size-4');
    });
  });

  describe('Content layout', () => {
    it('should have proper content padding', () => {
      renderPopoverContentAuth();

      const contentContainer = screen
        .getByText('Login to try more features for free')
        .closest('div');
      expect(contentContainer).toHaveClass('p-3');
    });

    it('should have proper text styling', () => {
      renderPopoverContentAuth();

      const titleText = screen.getByText('Login to try more features for free');
      expect(titleText).toHaveClass(
        'mb-1',
        'font-medium',
        'text-base',
        'text-primary'
      );

      const descriptionText = screen.getByText(
        'Add files, use more models, BYOK, and more.'
      );
      expect(descriptionText).toHaveClass(
        'mb-5',
        'text-base',
        'text-muted-foreground'
      );
    });

    it('should have proper banner image styling', () => {
      renderPopoverContentAuth();

      const bannerImage = screen.getByAltText('calm paint generate by TestApp');
      expect(bannerImage).toHaveClass('h-32', 'w-full', 'object-cover');
    });
  });

  describe('Accessibility', () => {
    it('should have proper button role and text', () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      expect(signInButton.tagName).toBe('BUTTON');
    });

    it('should have proper image alt text', () => {
      renderPopoverContentAuth();

      expect(
        screen.getByAltText('calm paint generate by TestApp')
      ).toBeInTheDocument();
      expect(screen.getByAltText('Google logo')).toBeInTheDocument();
    });

    it('should be keyboard navigable', async () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      signInButton.focus();

      expect(document.activeElement).toBe(signInButton);

      await act(async () => {
        await user.keyboard('{Enter}');
      });
      expect(api.signInWithGoogle).toHaveBeenCalled();
    });

    it('should properly announce loading state to screen readers', async () => {
      let resolveSignIn: (value: { provider: 'google'; url: string }) => void =
        () => {};
      const signInPromise = new Promise<{ provider: 'google'; url: string }>(
        (resolve) => {
          resolveSignIn = resolve;
        }
      );
      vi.mocked(api.signInWithGoogle).mockReturnValue(signInPromise);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      expect(
        screen.getByRole('button', { name: /connecting/i })
      ).toBeInTheDocument();

      await act(async () => {
        resolveSignIn({ provider: 'google', url: 'https://auth.google.com' });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid button clicks', async () => {
      let resolveSignIn: (value: { provider: 'google'; url: string }) => void =
        () => {};
      const signInPromise = new Promise<{ provider: 'google'; url: string }>(
        (resolve) => {
          resolveSignIn = resolve;
        }
      );
      vi.mocked(api.signInWithGoogle).mockReturnValue(signInPromise);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });

      // Click multiple times rapidly - use single act() to avoid overlapping
      await act(async () => {
        await user.click(signInButton);
        await user.click(signInButton);
        await user.click(signInButton);
      });

      // Should only call once due to disabled state during loading
      expect(api.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(signInButton).toBeDisabled();

      // Resolve the promise to clean up
      await act(async () => {
        resolveSignIn({ provider: 'google', url: 'test' });
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });

    it('should handle empty error objects', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue({});

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });

    it('should handle null error', async () => {
      vi.mocked(api.signInWithGoogle).mockRejectedValue(null);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Error message should be displayed synchronously after act() - no need for waitFor
      expect(
        screen.getByText('An unexpected error occurred. Please try again.')
      ).toBeInTheDocument();
    });

    it('should handle sign-in response without data', async () => {
      vi.mocked(api.signInWithGoogle).mockResolvedValue(undefined as any);

      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Should not redirect
      expect(mockLocation.href).toBe('');
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should work with real-like auth flow', async () => {
      const authUrl =
        'https://accounts.google.com/oauth/authorize?client_id=123';
      vi.mocked(api.signInWithGoogle).mockResolvedValue({
        provider: 'google',
        url: authUrl,
      });

      const { container } = renderPopoverContentAuth();

      // Initial state
      expect(screen.getByText('Continue with Google')).toBeInTheDocument();
      expect(
        screen.getByText('Login to try more features for free')
      ).toBeInTheDocument();

      // Start sign-in
      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      // Should redirect
      // Redirect should be synchronous after act() - no need for waitFor
      expect(mockLocation.href).toBe(authUrl);
    });

    it('should integrate properly with Supabase client', async () => {
      renderPopoverContentAuth();

      const signInButton = screen.getByRole('button', {
        name: /continue with google/i,
      });
      await act(async () => {
        await user.click(signInButton);
      });

      expect(supabaseClient.createClient).toHaveBeenCalled();
      expect(api.signInWithGoogle).toHaveBeenCalledWith(mockSupabaseClient);
    });
  });
});
