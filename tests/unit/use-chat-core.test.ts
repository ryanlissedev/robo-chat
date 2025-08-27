import { act, renderHook } from '@testing-library/react';
import type { UIMessage as Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatCore } from '@/components/app/chat/use-chat-core';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { createMockFile, mockUserProfile } from '../test-utils';

// Mock modules with inline factories to avoid hoisting issues
vi.mock('@ai-sdk/react', () => {
  const mockSendMessage = vi.fn() as any;
  const mockSetMessages = vi.fn() as any;
  const mockStop = vi.fn();

  // Add mock methods to the functions
  mockSendMessage.mockClear = vi.fn();
  mockSendMessage.mockResolvedValue = vi.fn();
  mockSetMessages.mockClear = vi.fn();

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

vi.mock('@/components/app/chat/chat-business-logic', () => {
  const submitMessageScenario = vi.fn();
  const submitSuggestionScenario = vi.fn();
  const prepareReloadScenario = vi.fn();
  const handleChatError = vi.fn();

  return {
    submitMessageScenario,
    submitSuggestionScenario,
    prepareReloadScenario,
    handleChatError,
  };
});

// Mock the chat draft hook with proper implementation
const mockSetDraftValue = vi.fn();
const mockClearDraft = vi.fn();
vi.mock('@/app/hooks/use-chat-draft', () => ({
  useChatDraft: () => ({
    draftValue: '',
    setDraftValue: mockSetDraftValue,
    clearDraft: mockClearDraft,
  }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
  })),
}));

import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
// Import the actual business logic module for proper typing (after mocking)
import * as businessLogic from '@/components/app/chat/chat-business-logic';

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

// Get typed mocked functions
const mockBusinessLogic = vi.mocked(businessLogic);
const mockUseSearchParams = vi.mocked(useSearchParams);

// Access the actual mock object returned by useChat
let mockUseChat: ReturnType<typeof useChat>;

beforeEach(() => {
  mockUseChat = useChat();
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
      expect(result.current.enableSearch).toBe(false); // enableSearch starts as false
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

      expect(result.current.systemPrompt).toBe(SYSTEM_PROMPT_DEFAULT);
    });
  });

  describe('When handling search params', () => {
    it('should handle prompt parameter from URL', async () => {
      // Mock the search params to return a URL parameter
      const mockGet = vi.fn().mockReturnValue('Hello from URL');
      mockUseSearchParams.mockReturnValue({ get: mockGet } as any);

      // Mock requestAnimationFrame for the effect
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = vi.fn((cb) => {
        cb(0);
        return 0;
      });

      const { result } = renderHook(() => useChatCore(defaultProps));

      // The effect should run and call searchParams.get
      expect(mockGet).toHaveBeenCalledWith('prompt');

      // The hook should handle the prompt parameter internally
      expect(mockGet).toHaveBeenCalled();

      // Restore requestAnimationFrame
      global.requestAnimationFrame = originalRAF;
    });
  });

  describe('When submitting messages', () => {
    beforeEach(() => {
      // Reset and configure the mock
      mockBusinessLogic.submitMessageScenario.mockResolvedValue({
        success: true,
        data: {
          chatId: 'test-chat-id',
          requestOptions: {
            body: {
              chatId: 'test-chat-id',
              userId: 'test-user',
              model: 'test-model',
              isAuthenticated: true,
              systemPrompt: 'test prompt',
              reasoningEffort: 'medium' as const,
            },
          },
          optimisticMessage: {
            id: 'opt-1',
            role: 'user',
            content: '',
            createdAt: new Date(),
          } as any,
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

      // Clear previous mocks
      (mockUseChat.setMessages as any).mockClear();
      (mockUseChat.sendMessage as any).mockClear();
      (mockBusinessLogic.submitMessageScenario as any).mockClear();

      // Mock sendMessage to resolve successfully
      (mockUseChat.sendMessage as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockBusinessLogic.submitMessageScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test message',
          files: expect.any(Array),
          user: mockUserProfile,
          selectedModel: 'test-model',
          isAuthenticated: true,
          enableSearch: false,
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
      expect(mockUseChat.sendMessage).toHaveBeenCalledWith(
        { text: 'Test message' },
        expect.any(Object)
      );
      expect(props.setFiles).toHaveBeenCalledWith([]);
      expect(props.clearDraft).toHaveBeenCalled();
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

      // Clear previous mocks
      (mockUseChat.setMessages as any).mockClear();
      (mockUseChat.sendMessage as any).mockClear();
      props.cleanupOptimisticAttachments.mockClear();
      props.cacheAndAddMessage.mockClear();
      props.clearDraft.mockClear();

      // Mock sendMessage to resolve successfully
      (mockUseChat.sendMessage as any).mockResolvedValue(undefined);

      const { result } = renderHook(() => useChatCore(props));

      await act(async () => {
        await result.current.submit();
      });

      // Should have called sendMessage (which handles optimistic updates in v5)
      expect(mockUseChat.sendMessage).toHaveBeenCalledWith(
        { text: 'Test message' },
        expect.any(Object)
      );

      // Should have cleaned up after success
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
          requestOptions: {
            body: {
              chatId: 'test-chat-id',
              userId: 'test-user',
              model: 'test-model',
              isAuthenticated: true,
              systemPrompt: 'test prompt',
              reasoningEffort: 'medium' as const,
            },
          },
          optimisticMessage: {
            id: 'opt-2',
            role: 'user',
            content: '',
            createdAt: new Date(),
          } as any,
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
          enableSearch: false,
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
          requestOptions: {
            body: {
              chatId: 'test-chat-id',
              userId: 'test-user',
              model: 'test-model',
              isAuthenticated: true,
              systemPrompt: 'test prompt',
              reasoningEffort: 'medium' as const,
            },
          },
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

      // Clear previous mocks and set up successful response
      mockBusinessLogic.prepareReloadScenario.mockClear();
      mockBusinessLogic.prepareReloadScenario.mockResolvedValue({
        success: true,
        data: {
          requestOptions: {
            body: {
              chatId: 'test-chat-id',
              userId: 'test-user',
              model: 'test-model',
              isAuthenticated: true,
              systemPrompt: 'test prompt',
              reasoningEffort: 'medium' as const,
            },
          },
        },
      });
      // AI SDK v5 doesn't have reload - handleReload uses setMessages instead

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
      // In AI SDK v5, reload is done via setMessages instead of reload()
      expect(mockUseChat.setMessages).toHaveBeenCalledWith(expect.any(Array));
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
        expect.any(Error)
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
        expect.any(Error)
      );
    });
  });
});
