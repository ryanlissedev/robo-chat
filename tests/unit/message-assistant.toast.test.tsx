import userEvent from '@testing-library/user-event';
import type React from 'react';
import { useMemo } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock streamdown (which pulls in katex CSS) BEFORE importing MessageAssistant
vi.mock('streamdown', () => ({
  Streamdown: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock the Response wrapper that uses Streamdown
vi.mock('@/components/ai-elements/response', () => ({
  Response: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock framer-motion to avoid DOM-specific APIs during tests
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock the UI toast component that MessageAssistant actually uses
vi.mock('@/components/ui/toast', () => {
  // Create a mock toast function that captures its arguments
  const toastMock = vi.fn((options: any) => {
    const globalState = (global as any).__toastMockState;
    if (globalState) {
      globalState.lastToastOptions = options;
    }
    return 'mock-toast-id';
  });

  // Create global toast mock state for test access
  const globalToastMockState = {
    lastToastOptions: undefined as any,
    toast: toastMock,
  };

  // Make it available globally for test access
  (global as any).__toastMockState = globalToastMockState;

  return {
    toast: toastMock,
  };
});

// Also mock sonner since it's used by the UI toast component
vi.mock('sonner', () => ({
  toast: {
    custom: vi.fn(() => 'mock-sonner-id'),
    dismiss: vi.fn(),
  },
}));

import { MessageAssistant } from '@/components/app/chat/message-assistant';
import { cleanup, renderWithProviders } from '@/tests/test-utils';

// Mock user preferences provider and hook properly
vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({
    preferences: {
      showToolInvocations: true,
      multiModelEnabled: false,
    },
  }),
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Helpers to build a tool part for fileSearch failure
function buildFileSearchFailurePart(message: string) {
  return {
    type: 'tool-fileSearch',
    toolCallId: 'call_1',
    toolName: 'fileSearch',
    state: 'output-available',
    output: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: message }),
        },
      ],
    },
  } as any;
}

describe('MessageAssistant toast on fileSearch failure', () => {
  beforeEach(() => {
    // Clear all mocks and reset state
    vi.clearAllMocks();

    // Reset toast mock state
    const globalState = (global as any).__toastMockState;
    if (globalState) {
      globalState.lastToastOptions = undefined;
      if (globalState.toast && vi.isMockFunction(globalState.toast)) {
        globalState.toast.mockReset();
      }
    }

    // Clean up React components to reset internal refs
    cleanup();
  });

  it('shows error toast with Retry button and triggers onReload when clicked', async () => {
    const _user = userEvent.setup({ delay: null });
    const onReload = vi.fn();

    const globalState = (global as any).__toastMockState;

    // Reset state for clean test
    globalState.lastToastOptions = undefined;

    const { unmount } = renderWithProviders(
      <MessageAssistant
        children={''}
        isLast
        hasScrollAnchor={false}
        copied={false}
        copyToClipboard={() => {}}
        onReload={onReload}
        parts={[buildFileSearchFailurePart('Network error test 1')]}
        status={'ready'}
        className={''}
        messageId={'m1-unique-test'}
        onQuote={() => {}}
      />
    );

    // Toast is called synchronously after render - no need for waitFor
    expect(globalState.lastToastOptions).toBeDefined();
    expect(globalState.lastToastOptions.title).toBe('File search failed');
    expect(globalState.lastToastOptions.button).toBeDefined();

    // Verify button configuration
    expect(globalState.lastToastOptions.button.label).toBe('Retry');
    expect(typeof globalState.lastToastOptions.button.onClick).toBe('function');

    // Simulate button click
    globalState.lastToastOptions.button.onClick();

    // Verify onReload was called
    expect(onReload).toHaveBeenCalledTimes(1);

    // Clean up this component instance
    unmount();
  });

  it('shows error toast without button if no onReload provided', async () => {
    const globalState = (global as any).__toastMockState;

    // Reset state for clean test
    globalState.lastToastOptions = undefined;

    const { unmount } = renderWithProviders(
      <MessageAssistant
        children={''}
        isLast
        hasScrollAnchor={false}
        copied={false}
        copyToClipboard={() => {}}
        parts={[
          {
            type: 'tool-fileSearch',
            toolCallId: 'call_no_reload_test2',
            toolName: 'fileSearch',
            state: 'output-available',
            output: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: 'No onReload test error 2',
                  }),
                },
              ],
            },
          } as any,
        ]}
        status={'ready'}
        className={''}
        messageId={'m2-no-reload-unique'}
        onQuote={() => {}}
        // Explicitly no onReload prop - this should result in no button
      />
    );

    // Toast is called synchronously after render - no need for waitFor
    expect(globalState.lastToastOptions).toBeDefined();
    expect(globalState.lastToastOptions.title).toBe('File search failed');

    // Check that no button was provided since onReload is missing
    expect(globalState.lastToastOptions.button).toBeUndefined();

    // Clean up this component instance
    unmount();
  });
});
