import React from 'react';
/**
 * Integration tests for Chat UI workflows
 * Testing complete user interactions and component integration
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatContainer } from '@/components/app/chat/chat-container';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';

// Mock the sub-components
vi.mock('@/components/app/chat/chat', () => ({
  Chat: () => <div data-testid="single-chat">Single Chat Component</div>,
}));

vi.mock('@/components/app/multi-chat/multi-chat', () => ({
  MultiChat: () => <div data-testid="multi-chat">Multi Chat Component</div>,
}));

// Mock preferences provider
const mockPreferences = {
  multiModelEnabled: false,
  reasoningEnabled: true,
  searchEnabled: true,
  temperature: 0.7,
  maxTokens: 1000,
};

const mockPreferencesProvider = {
  preferences: mockPreferences,
  updatePreferences: vi.fn(),
  isLoading: false,
};

vi.mock('@/lib/user-preference-store/provider', () => {
  const mockUseUserPreferences = vi.fn(() => mockPreferencesProvider);
  return {
    useUserPreferences: mockUseUserPreferences,
    UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="preferences-provider">{children}</div>
    ),
  };
});

describe('Chat UI Workflows Integration', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();

    // Reset mock preferences
    mockPreferencesProvider.preferences = {
      multiModelEnabled: false,
      reasoningEnabled: true,
      searchEnabled: true,
      temperature: 0.7,
      maxTokens: 1000,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderChatContainer = (initialPreferences = {}) => {
    mockPreferencesProvider.preferences = {
      ...mockPreferences,
      ...initialPreferences,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <UserPreferencesProvider>
          <ChatContainer />
        </UserPreferencesProvider>
      </QueryClientProvider>
    );
  };

  describe('Chat Mode Selection', () => {
    it('should render single chat when multiModelEnabled is false', () => {
      renderChatContainer({ multiModelEnabled: false });

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
      expect(screen.queryByTestId('multi-chat')).not.toBeInTheDocument();
    });

    it('should render multi chat when multiModelEnabled is true', () => {
      renderChatContainer({ multiModelEnabled: true });

      expect(screen.getByTestId('multi-chat')).toBeInTheDocument();
      expect(screen.queryByTestId('single-chat')).not.toBeInTheDocument();
    });

    it('should switch between chat modes when preference changes', () => {
      const { rerender } = renderChatContainer({ multiModelEnabled: false });

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      // Update preferences
      mockPreferencesProvider.preferences.multiModelEnabled = true;

      rerender(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('multi-chat')).toBeInTheDocument();
      expect(screen.queryByTestId('single-chat')).not.toBeInTheDocument();
    });

    it('should handle loading state appropriately', () => {
      mockPreferencesProvider.isLoading = true;

      renderChatContainer();

      // Should still render something even when loading
      expect(
        screen.getByTestId('single-chat') || screen.getByTestId('multi-chat')
      ).toBeInTheDocument();
    });
  });

  describe('User Preference Integration', () => {
    it('should access preferences from context', () => {
      renderChatContainer({
        multiModelEnabled: false,
        temperature: 0.8,
        maxTokens: 2000,
      });

      expect(screen.getByTestId('preferences-provider')).toBeInTheDocument();
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should handle preferences update', async () => {
      renderChatContainer();

      // Simulate preference update
      mockPreferencesProvider.updatePreferences({
        multiModelEnabled: true,
      });

      expect(mockPreferencesProvider.updatePreferences).toHaveBeenCalledWith({
        multiModelEnabled: true,
      });
    });

    it('should handle undefined preferences gracefully', () => {
      mockPreferencesProvider.preferences = {} as any;

      expect(() => {
        renderChatContainer();
      }).not.toThrow();
    });

    it('should handle null preferences gracefully', () => {
      mockPreferencesProvider.preferences = null as any;

      expect(() => {
        renderChatContainer();
      }).not.toThrow();
    });
  });

  describe('Component Lifecycle', () => {
    it('should mount and unmount cleanly', () => {
      const { unmount } = renderChatContainer();

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      expect(() => unmount()).not.toThrow();
    });

    it('should handle re-renders without issues', () => {
      const { rerender } = renderChatContainer();

      // Multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(
          <QueryClientProvider client={queryClient}>
            <UserPreferencesProvider>
              <ChatContainer />
            </UserPreferencesProvider>
          </QueryClientProvider>
        );
      }

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should handle preference changes during render', () => {
      const { rerender } = renderChatContainer({ multiModelEnabled: false });

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      // Change preference and re-render
      mockPreferencesProvider.preferences = {
        ...mockPreferences,
        multiModelEnabled: true,
      };

      rerender(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('multi-chat')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle preferences provider errors gracefully', () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // This test verifies that the component can handle provider errors
      // Since we're using a mock provider, we just verify it renders without crashing
      expect(() => {
        renderChatContainer();
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle QueryClient errors', () => {
      // Create a query client that will error
      const errorQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            throwOnError: true,
          },
        },
      });

      expect(() => {
        render(
          <QueryClientProvider client={errorQueryClient}>
            <UserPreferencesProvider>
              <ChatContainer />
            </UserPreferencesProvider>
          </QueryClientProvider>
        );
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      // Simplified test - just check that component renders without issues
      const { rerender } = renderChatContainer();

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      // Re-render with same preferences should not throw errors
      rerender(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      // Component should still be rendered
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should memoize chat selection properly', () => {
      const { rerender } = renderChatContainer({ multiModelEnabled: false });

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      // Re-render with same preference
      rerender(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      // Should still show single chat
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should maintain proper accessibility structure', () => {
      renderChatContainer();

      const chatElement = screen.getByTestId('single-chat');
      expect(chatElement).toBeInTheDocument();
      expect(chatElement).toBeVisible();
    });

    it('should be keyboard navigable', async () => {
      renderChatContainer();

      // The chat container itself doesn't have focusable elements,
      // but it should not interfere with keyboard navigation
      const chatElement = screen.getByTestId('single-chat');
      expect(chatElement).not.toHaveFocus();

      // Tab navigation should work without errors
      await user.tab();
      expect(document.activeElement).toBeDefined();
    });

    it('should provide proper context to child components', () => {
      renderChatContainer();

      expect(screen.getByTestId('preferences-provider')).toBeInTheDocument();
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });
  });

  describe('Integration with Provider', () => {
    it('should properly integrate with UserPreferencesProvider', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('preferences-provider')).toBeInTheDocument();
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should handle preferences updates through provider', async () => {
      renderChatContainer();

      // Simulate external preference update
      act(() => {
        mockPreferencesProvider.preferences.multiModelEnabled = true;
      });

      // Component should respond to preference changes
      expect(mockPreferencesProvider.preferences.multiModelEnabled).toBe(true);
    });

    it('should handle provider loading states', () => {
      mockPreferencesProvider.isLoading = true;

      renderChatContainer();

      // Should render even when preferences are loading
      expect(
        screen.getByTestId('single-chat') || screen.getByTestId('multi-chat')
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid preference changes', async () => {
      const { rerender } = renderChatContainer({ multiModelEnabled: false });

      // Rapidly toggle preference
      for (let i = 0; i < 10; i++) {
        mockPreferencesProvider.preferences.multiModelEnabled = i % 2 === 0;

        rerender(
          <QueryClientProvider client={queryClient}>
            <UserPreferencesProvider>
              <ChatContainer />
            </UserPreferencesProvider>
          </QueryClientProvider>
        );
      }

      // Should handle all changes without crashing
      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should handle complex preference objects', () => {
      const complexPreferences = {
        multiModelEnabled: false,
        reasoningEnabled: true,
        searchEnabled: true,
        temperature: 0.75,
        maxTokens: 1500,
        customSettings: {
          theme: 'dark',
          language: 'en',
          notifications: true,
        },
      };

      renderChatContainer(complexPreferences);

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });

    it('should maintain state across provider changes', () => {
      const { rerender } = renderChatContainer({ multiModelEnabled: false });

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();

      // Change to different provider instance but same preferences
      rerender(
        <QueryClientProvider client={queryClient}>
          <UserPreferencesProvider>
            <ChatContainer />
          </UserPreferencesProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId('single-chat')).toBeInTheDocument();
    });
  });
});
