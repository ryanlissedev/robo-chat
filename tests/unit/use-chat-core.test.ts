import { act, renderHook, waitFor } from '@testing-library/react';
import type { UIMessage as Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatCore } from '@/app/components/chat/use-chat-core';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { createMockFile, mockUserProfile } from '../test-utils';

// Mock modules with inline factories to avoid hoisting issues
vi.mock('@ai-sdk/react', () => {
  const mockSendMessage = vi.fn();
  const mockSetMessages = vi.fn();
  const mockStop = vi.fn();

  // Create a mock for AI SDK v5 - no setInput, append, reload, handleSubmit
  const mockUseChat = {
    messages: [],
    status: 'ready' as const,
    error: null,
    stop: mockStop,
    setMessages: mockSetMessages,
    sendMessage: mockSendMessage,
  };

  return {
    useChat: () => mockUseChat,
  };
});

vi.mock('@/app/components/chat/chat-business-logic', () => ({
  submitMessageScenario: vi.fn(),
  submitSuggestionScenario: vi.fn(),
  prepareReloadScenario: vi.fn(),
  handleChatError: vi.fn(),
}));

vi.mock('@/app/hooks/use-chat-draft', () => {
  const mockSetDraftValue = vi.fn();
  return {
    useChatDraft: () => ({
      setDraftValue: mockSetDraftValue,
    }),
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
  })),
}));

import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
// Import the actual business logic module for proper typing (after mocking)
import * as businessLogic from '@/app/components/chat/chat-business-logic';
import * as chatDraft from '@/app/hooks/use-chat-draft';

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

// Get typed mocked functions
const mockBusinessLogic = vi.mocked(businessLogic);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseChatDraft = vi.mocked(chatDraft.useChatDraft);

// Access the actual mock object returned by useChat
let mockUseChat: ReturnType<typeof useChat>;
let mockSetDraftValue: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockUseChat = useChat();
  // Get the mocked setDraftValue function
  const chatDraftResult = mockUseChatDraft(null);
  mockSetDraftValue = chatDraftResult.setDraftValue as ReturnType<typeof vi.fn>;
});

// TDD London Style: Focus on behavior and interactions
describe('useChatCore', () => {
  const defaultProps = {
    initialMessages: [] as Message[],
    draftValue: '',
    cacheAndAddMessage: vi.fn(),
    chatId: null,
    user: null,
    files: [],
    createOptimisticAttachments: vi.fn(),
    setFiles: vi.fn(),
    checkLimitsAndNotify: vi.fn(),
    cleanupOptimisticAttachments: vi.fn(),
    ensureChatExists: vi.fn(),
    handleFileUploads: vi.fn(),
    selectedModel: 'test-model',
    clearDraft: vi.fn(),
    bumpChat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('When hook initializes', () => {
    it('should provide initial state values', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.hasDialogAuth).toBe(false);
      expect(result.current.enableSearch).toBe(true);
      expect(result.current.reasoningEffort).toBe('medium');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.status).toBe('ready'); // AI SDK v5 uses 'ready' instead of 'idle'
    });

    it('should detect authenticated user correctly', () => {
      const propsWithUser = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(propsWithUser));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.systemPrompt).toBe(mockUserProfile.system_prompt);
    });

    it('should use default system prompt when user has none', () => {
      const userWithoutPrompt = { ...mockUserProfile, system_prompt: null };
      const propsWithUser = {
        ...defaultProps,
        user: userWithoutPrompt,
      };

      const { result } = renderHook(() => useChatCore(propsWithUser));

      expect(
        result.current.systemPrompt
      ).toBe(SYSTEM_PROMPT_DEFAULT);
    });
  });

  describe('When handling search params', () => {
    it('should set draft value from prompt parameter', async () => {
      // Mock the search params to return a URL parameter
      const mockGet = vi.fn().mockReturnValue('Hello from URL');
      mockUseSearchParams.mockReturnValue({ get: mockGet } as any);

      renderHook(() => useChatCore(defaultProps));

      await waitFor(() => {
        expect(mockSetDraftValue).toHaveBeenCalledWith('Hello from URL');
      });
    });
  });

  describe('When submitting messages', () => {
    beforeEach(() => {
      // Reset and configure the mock
      mockBusinessLogic.submitMessageScenario.mockResolvedValue({
        success: true,
        data: {
          chatId: 'test-chat-id',
          requestOptions: { body: JSON.stringify({ test: 'data' }) },
          optimisticMessage: { id: 'opt-1', role: 'user', parts: [{ type: 'text', text: '' }], createdAt: new Date() },
        },
      });
    });

    it('should handle successful message submission', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
        files: [createMockFile('test.txt', 'content')],
        draftValue: 'Test message',
      };

      props.createOptimisticAttachments.mockReturnValue([
        {
          name: 'test.txt',
          contentType: 'text/plain',
          url: 'mock-url',
        },
      ]);

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockUseChat.setMessages).toHaveBeenCalled();
      expect(mockUseChat.sendMessage).toHaveBeenCalled();
      expect(props.setFiles).toHaveBeenCalledWith([]);
      expect(mockBusinessLogic.submitMessageScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.any(String),
          files: expect.any(Array),
          user: mockUserProfile,
          selectedModel: 'test-model',
          isAuthenticated: true,
          enableSearch: true,
          reasoningEffort: 'medium',
          chatId: 'test-chat-id',
          systemPrompt: mockUserProfile.system_prompt,
        }),
        expect.objectContaining({
          checkLimitsAndNotify: expect.any(Function),
          ensureChatExists: expect.any(Function),
          handleFileUploads: expect.any(Function),
          createOptimisticAttachments: expect.any(Function),
          cleanupOptimisticAttachments: expect.any(Function),
        })
      );
    });

    it('should handle failed message submission', async () => {
      const toastMock = await import('@/components/ui/toast');
      const mockToast = vi.mocked(toastMock.toast);

      mockBusinessLogic.submitMessageScenario.mockResolvedValue({
        success: false,
        error: 'Submission failed',
      });

      const props = {
        ...defaultProps,
        user: mockUserProfile,
        draftValue: 'Test message',
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Submission failed',
        status: 'error',
      });
    });

    it('should create and cleanup optimistic messages properly', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        files: [createMockFile()],
        draftValue: 'Test message',
      };

      props.createOptimisticAttachments.mockReturnValue([
        {
          name: 'test.txt',
          contentType: 'text/plain',
          url: 'mock-url',
        },
      ]);

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      // Should have added optimistic message
      expect(mockUseChat.setMessages).toHaveBeenCalledWith(
        expect.any(Function)
      );

      // Should have cleaned up optimistic message after success
      expect(props.cleanupOptimisticAttachments).toHaveBeenCalled();
      expect(props.cacheAndAddMessage).toHaveBeenCalled();
      expect(props.clearDraft).toHaveBeenCalled();
    });

    it('should bump chat when there are previous messages', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
        initialMessages: [
          {
            id: '1',
            parts: [{ type: 'text', text: 'Previous message' }],
            role: 'user',
          },
        ] as Message[],
        draftValue: 'New message',
      };

      // Set up the mock to return messages with parts
      mockUseChat.messages = [
        {
          id: '1',
          parts: [{ type: 'text', text: 'Previous message' }],
          role: 'user',
        },
      ] as Message[];

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      expect(props.bumpChat).toHaveBeenCalledWith('test-chat-id');
    });
  });

  describe('When handling suggestions', () => {
    beforeEach(() => {
      mockBusinessLogic.submitSuggestionScenario.mockResolvedValue({
        success: true,
        data: {
          chatId: 'test-chat-id',
          requestOptions: { body: JSON.stringify({ suggestion: 'data' }) },
          optimisticMessage: { id: 'opt-2', role: 'user', parts: [{ type: 'text', text: '' }], createdAt: new Date() },
        },
      });
    });

    it('should handle successful suggestion submission', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockBusinessLogic.submitSuggestionScenario).toHaveBeenCalledWith(
        'Tell me a joke',
        expect.objectContaining({
          user: mockUserProfile,
          selectedModel: 'test-model',
          isAuthenticated: true,
          reasoningEffort: 'medium',
          chatId: 'test-chat-id',
          enableSearch: true,
        }),
        expect.any(Object)
      );
      // The sendMessage function should be called after successful suggestion submission
      expect(mockUseChat.sendMessage).toHaveBeenCalled();
    });

    it('should handle failed suggestion submission', async () => {
      const toastMock = await import('@/components/ui/toast');
      const mockToast = vi.mocked(toastMock.toast);

      mockBusinessLogic.submitSuggestionScenario.mockResolvedValue({
        success: false,
        error: 'Suggestion failed',
      });

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Suggestion failed',
        status: 'error',
      });
    });
  });

  describe('When handling reload', () => {
    beforeEach(() => {
      mockBusinessLogic.prepareReloadScenario.mockResolvedValue({
        success: true,
        data: {
          requestOptions: { body: JSON.stringify({ reload: 'data' }) },
        },
      });
    });

    it('should handle successful reload', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
      };

      // Mock messages to include a user message for reload to work
      const testMessages = [
        {
          id: '1',
          role: 'user' as const,
          parts: [{ type: 'text' as const, text: 'Test question' }],
        },
        {
          id: '2',
          role: 'assistant' as const,
          parts: [{ type: 'text' as const, text: 'Test response' }],
        },
      ];
      mockUseChat.messages = testMessages;

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.handleReload();
      });

      expect(mockBusinessLogic.prepareReloadScenario).toHaveBeenCalledWith({
        user: mockUserProfile,
        chatId: 'test-chat-id',
        selectedModel: 'test-model',
        isAuthenticated: true,
        systemPrompt: mockUserProfile.system_prompt,
        reasoningEffort: 'medium',
      });
      expect(mockUseChat.sendMessage).toHaveBeenCalledWith(
        { text: 'Test question' },
        expect.any(Object)
      );
    });

    it('should handle failed reload', async () => {
      const toastMock = await import('@/components/ui/toast');
      const mockToast = vi.mocked(toastMock.toast);

      mockBusinessLogic.prepareReloadScenario.mockResolvedValue({
        success: false,
        error: 'Reload failed',
      });

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.handleReload();
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Reload failed',
        status: 'error',
      });
    });
  });

  describe('When handling input changes', () => {
    it('should update draft value', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      act(() => {
        result.current.handleInputChange('New input value');
      });

      expect(mockSetDraftValue).toHaveBeenCalledWith('New input value');
    });
  });

  describe('When managing UI state', () => {
    it('should allow setting submission state', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      act(() => {
        result.current.setIsSubmitting(true);
      });

      expect(result.current.isSubmitting).toBe(true);

      act(() => {
        result.current.setIsSubmitting(false);
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should allow setting dialog auth state', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      act(() => {
        result.current.setHasDialogAuth(true);
      });

      expect(result.current.hasDialogAuth).toBe(true);
    });

    it('should allow setting search enablement', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      act(() => {
        result.current.setEnableSearch(false);
      });

      expect(result.current.enableSearch).toBe(false);
    });

    it('should allow setting reasoning effort', () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      act(() => {
        result.current.setReasoningEffort('high');
      });

      expect(result.current.reasoningEffort).toBe('high');
    });
  });

  describe('When handling errors', () => {
    it('should handle unexpected errors during submission', async () => {
      mockBusinessLogic.submitMessageScenario.mockRejectedValue(
        new Error('Unexpected error')
      );

      const props = {
        ...defaultProps,
        user: mockUserProfile,
        draftValue: 'Test message',
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockBusinessLogic.handleChatError).toHaveBeenCalledWith(
        expect.any(Error),
        'Message submission'
      );
    });

    it('should handle unexpected errors during suggestion submission', async () => {
      mockBusinessLogic.submitSuggestionScenario.mockRejectedValue(
        new Error('Unexpected suggestion error')
      );

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockBusinessLogic.handleChatError).toHaveBeenCalledWith(
        expect.any(Error),
        'Suggestion submission'
      );
    });
  });
});
