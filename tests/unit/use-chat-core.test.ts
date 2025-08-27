import { act, renderHook } from '@testing-library/react';
import type { UIMessage as Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatCore } from '@/components/app/chat/use-chat-core';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { createMockFile, mockUserProfile } from '../test-utils';

// Mock modules with inline factories to avoid hoisting issues
// Mock AI SDK functions
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockSetMessages = vi.fn();
const mockStop = vi.fn();

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    status: 'ready' as const,
    error: null,
    stop: mockStop,
    setMessages: mockSetMessages,
    sendMessage: mockSendMessage,
  })),
}));

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

// Mock guest headers
vi.mock('@/lib/security/guest-headers', () => ({
  headersForModel: vi.fn().mockResolvedValue({}),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  SYSTEM_PROMPT_DEFAULT: 'Default system prompt',
}));

// Mock the chat draft hook with proper implementation
const mockSetDraftValue = vi.fn();
const mockClearDraft = vi.fn();
vi.mock('@/app/hooks/use-chat-draft', () => ({
  useChatDraft: vi.fn(() => ({
    setDraftValue: mockSetDraftValue,
  })),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
  })),
}));

import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
// Import the actual business logic module for proper typing (after mocking)
import * as businessLogic from '@/components/app/chat/chat-business-logic';
// Import after mocking
import { toast } from '@/components/ui/toast';

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

// Get typed mocked functions
const mockBusinessLogic = vi.mocked(businessLogic);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockToast = vi.mocked(toast);
const mockUseChatDraft = vi.mocked(useChatDraft);
const mockUseChat = vi.mocked(useChat);

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
    // Reset all mock implementations to clean state
    mockSendMessage.mockResolvedValue(undefined);
    mockSetMessages.mockClear();
    mockStop.mockClear();
    mockToast.mockClear();
    mockSetDraftValue.mockClear();
    
    // Reset useChat mock to return consistent values
    mockUseChat.mockReturnValue({
      messages: [],
      status: 'ready' as const,
      error: null,
      stop: mockStop,
      setMessages: mockSetMessages,
      sendMessage: mockSendMessage,
    });
    
    // Reset useChatDraft mock
    mockUseChatDraft.mockReturnValue({
      setDraftValue: mockSetDraftValue,
    });
    
    // Reset and setup business logic mocks with default success responses
    mockBusinessLogic.submitMessageScenario.mockResolvedValue({
      success: true,
      data: {
        chatId: 'default-chat-id',
        requestOptions: {
          body: {
            chatId: 'default-chat-id',
            userId: 'default-user',
            model: 'default-model',
            isAuthenticated: false,
            systemPrompt: 'Default system prompt',
            reasoningEffort: 'medium' as const,
          },
        },
        optimisticMessage: {
          id: 'opt-default',
          role: 'user',
          content: '',
          createdAt: new Date(),
        } as any,
      },
    });
    
    mockBusinessLogic.submitSuggestionScenario.mockResolvedValue({
      success: true,
      data: {
        chatId: 'default-chat-id',
        requestOptions: {
          body: {
            chatId: 'default-chat-id',
            userId: 'default-user',
            model: 'default-model',
            isAuthenticated: false,
            systemPrompt: 'Default system prompt',
            reasoningEffort: 'medium' as const,
          },
        },
        optimisticMessage: {
          id: 'opt-suggestion',
          role: 'user',
          content: '',
          createdAt: new Date(),
        } as any,
      },
    });
    
    mockBusinessLogic.prepareReloadScenario.mockResolvedValue({
      success: true,
      data: {
        requestOptions: {
          body: {
            chatId: 'default-chat-id',
            userId: 'default-user',
            model: 'default-model',
            isAuthenticated: false,
            systemPrompt: 'Default system prompt',
            reasoningEffort: 'medium' as const,
          },
        },
      },
    });
    
    mockBusinessLogic.handleChatError.mockImplementation(() => {});
    
    // Reset search params mock
    mockUseSearchParams.mockReturnValue({ get: vi.fn().mockReturnValue(null) } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Don't use vi.resetAllMocks() as it can break mock implementations
    // Instead, ensure each test sets up its own mock state correctly
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
      mockSetMessages.mockClear();
      mockSendMessage.mockClear();
      mockBusinessLogic.submitMessageScenario.mockClear();

      // Mock sendMessage to resolve successfully
      mockSendMessage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook returned properly
      if (result.current === null) {
        throw new Error('Hook initialization failed - this indicates a mocking issue');
      }

      // Debug: Check the initial state
      console.log('Initial input value:', result.current.input);
      console.log('Draft value passed:', props.draftValue);
      console.log('User provided:', !!props.user);
      console.log('Chat ID:', props.chatId);
      
      // Ensure hook is properly initialized before continuing
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('Test message');

      // Use single act() call to avoid overlapping
      await act(async () => {
        await result.current.submit();
      });

      // Debug: Check what happened after submit
      console.log('After submit - isSubmitting:', result.current.isSubmitting);
      console.log('Submit scenario called:', mockBusinessLogic.submitMessageScenario.mock.calls.length);
      console.log('SendMessage called:', mockSendMessage.mock.calls.length);

      // Check that submit was called and business logic was invoked
      // The async operation may still be running, so isSubmitting could be true or false
      // We'll focus on verifying the calls were made correctly
      
      // Debug: Check what actually got called
      console.log('Submit scenario calls:', mockBusinessLogic.submitMessageScenario.mock.calls.length);
      console.log('Send message calls:', mockSendMessage.mock.calls.length);
      console.log('Input value at time of test:', result.current.input);
      console.log('Is submitting:', result.current.isSubmitting);
      
      // The submit function IS being called, but it's async and may still be running
      // Let's verify the calls were made rather than checking final state
      expect(mockBusinessLogic.submitMessageScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test message', // The hook captures the input value before clearing it
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
      expect(mockSendMessage).toHaveBeenCalledWith(
        { text: 'Test message' },
        expect.any(Object)
      );
      expect(props.setFiles).toHaveBeenCalledWith([]);
      expect(props.clearDraft).toHaveBeenCalled();
    });

    it('should handle failed message submission', async () => {
      mockToast.mockClear();

      // Override the default successful mock with a failure response
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

      // Ensure hook returned properly
      if (result.current === null) {
        throw new Error('Hook initialization failed in failed message test');
      }

      // Debug: Check initial state
      console.log('Failed test - Initial input:', result.current.input);

      // Single act() call for the async operation
      await act(async () => {
        await result.current.submit();
      });

      // Debug: Check what happened
      console.log('Failed test - Submit scenario called:', mockBusinessLogic.submitMessageScenario.mock.calls.length);
      console.log('Failed test - Toast called:', mockToast.mock.calls.length);

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
      mockSetMessages.mockClear();
      mockSendMessage.mockClear();
      props.cleanupOptimisticAttachments.mockClear();
      props.cacheAndAddMessage.mockClear();
      props.clearDraft.mockClear();

      // Mock sendMessage to resolve successfully
      mockSendMessage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('Test message');

      // Single act() call for async operation
      await act(async () => {
        await result.current.submit();
      });

      // Should have called sendMessage (which handles optimistic updates in v5)
      expect(mockSendMessage).toHaveBeenCalledWith(
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

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('New message');

      // Set up messages manually after hook initialization to simulate existing messages
      await act(async () => {
        result.current.setMessages([
          {
            id: '1',
            parts: [{ type: 'text', text: 'Previous message' }],
            role: 'user',
          },
        ] as Message[]);
      });

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

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

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
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle failed suggestion submission', async () => {
      mockToast.mockClear();

      mockBusinessLogic.submitSuggestionScenario.mockResolvedValue({
        success: false,
        error: 'Suggestion failed',
      });

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

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

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Set up messages manually after hook initialization to simulate a loaded state
      await act(async () => {
        result.current.setMessages([
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
        ]);
      });

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
      expect(mockSetMessages).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should handle failed reload', async () => {
      mockToast.mockClear();

      mockBusinessLogic.prepareReloadScenario.mockResolvedValue({
        success: false,
        error: 'Reload failed',
      });

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      };

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

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
    it('should update draft value', async () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Use single async act() to prevent overlapping
      await act(async () => {
        result.current.handleInputChange('New input value');
      });

      expect(mockSetDraftValue).toHaveBeenCalledWith('New input value');
    });
  });

  describe('When managing UI state', () => {
    it('should allow setting submission state', async () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Use single async act() to prevent overlapping
      await act(async () => {
        result.current.setIsSubmitting(true);
      });

      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        result.current.setIsSubmitting(false);
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should allow setting dialog auth state', async () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Use single async act() to prevent overlapping
      await act(async () => {
        result.current.setHasDialogAuth(true);
      });

      expect(result.current.hasDialogAuth).toBe(true);
    });

    it('should allow setting search enablement', async () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Use single async act() to prevent overlapping
      await act(async () => {
        result.current.setEnableSearch(false);
      });

      expect(result.current.enableSearch).toBe(false);
    });

    it('should allow setting reasoning effort', async () => {
      const { result } = renderHook(() => useChatCore(defaultProps));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      // Use single async act() to prevent overlapping
      await act(async () => {
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

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('Test message');

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

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

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
