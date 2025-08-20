import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Under test
import { Chat } from '@/app/components/chat/chat';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ModelProvider } from '@/lib/model-store/provider';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';
import { renderWithProviders } from '@/tests/test-utils';

// Mocks for dependent hooks
// next/navigation.redirect is globally mocked in tests/setup.ts

vi.mock('@/lib/chat-store/session/provider', () => ({
  useChatSession: () => ({ chatId: 'non-existent-id' }),
}));

vi.mock('@/lib/chat-store/chats/provider', () => ({
  useChats: () => ({
    createNewChat: vi.fn(),
    getChatById: vi.fn(() => {}),
    updateChatModel: vi.fn(),
    bumpChat: vi.fn(),
    isLoading: false,
    hasFetched: false, // toggled per test
  }),
}));

vi.mock('@/lib/chat-store/messages/provider', () => ({
  useMessages: () => ({ messages: [], cacheAndAddMessage: vi.fn() }),
}));

vi.mock('@/lib/user-store/provider', () => ({
  useUser: () => ({ user: null }),
}));

// Avoid rendering the real ChatInput (which pulls models/preferences)
vi.mock('@/app/components/chat-input/chat-input', () => ({
  ChatInput: () => <div data-testid="mock-chat-input" />,
}));

vi.mock('@/lib/user-preference-store/provider', async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import('@/lib/user-preference-store/provider');
  return {
    ...actual,
    useUserPreferences: () =>
      ({ preferences: { promptSuggestions: false } }) as any,
  };
});

vi.mock('@/app/hooks/use-chat-draft', () => ({
  useChatDraft: () => ({ draftValue: '', clearDraft: vi.fn() }),
}));

vi.mock('@/app/components/chat/use-model', () => ({
  useModel: () => ({ selectedModel: 'test', handleModelChange: vi.fn() }),
}));

vi.mock('@/app/components/chat/use-file-upload', () => ({
  useFileUpload: () => ({
    files: [],
    setFiles: vi.fn(),
    handleFileUploads: vi.fn(),
    createOptimisticAttachments: vi.fn(),
    cleanupOptimisticAttachments: vi.fn(),
    handleFileUpload: vi.fn(),
    handleFileRemove: vi.fn(),
  }),
}));

vi.mock('@/app/components/chat/use-chat-operations', () => ({
  useChatOperations: () => ({
    checkLimitsAndNotify: vi.fn(),
    ensureChatExists: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
  }),
}));

vi.mock('@/app/components/chat/use-chat-core', () => ({
  useChatCore: () => ({
    messages: [],
    input: '',
    status: 'ready',
    stop: vi.fn(),
    hasSentFirstMessageRef: { current: false },
    isSubmitting: false,
    enableSearch: true,
    setEnableSearch: vi.fn(),
    reasoningEffort: 'medium',
    setReasoningEffort: vi.fn(),
    submit: vi.fn(),
    handleSuggestion: vi.fn(),
    handleReload: vi.fn(),
    handleInputChange: vi.fn(),
  }),
}));

describe('Chat redirect gating', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
  });

  it('does not redirect before chats have fetched', () => {
    // useChats is mocked with hasFetched: false above
    renderWithProviders(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <Chat />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects when chats have fetched and chat is missing', async () => {
    // Reset modules to apply fresh mock for this scenario
    vi.resetModules();
    vi.doMock('@/lib/chat-store/chats/provider', () => ({
      useChats: () => ({
        createNewChat: vi.fn(),
        getChatById: vi.fn(() => {}),
        updateChatModel: vi.fn(),
        bumpChat: vi.fn(),
        isLoading: false,
        hasFetched: true,
      }),
    }));

    const { Chat: FreshChat } = await import('@/app/components/chat/chat');
    renderWithProviders(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <FreshChat />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    );
    expect(redirect).toHaveBeenCalledWith('/');
  });
});
