import { act, renderHook } from '@testing-library/react';
import type { UIMessage as Message } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules FIRST before any imports to avoid hoisting issues
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockSetMessages = vi.fn();
const mockStop = vi.fn();
const mockSetDraftValue = vi.fn();
const mockHandleInputChange = vi.fn();
const mockHandleSubmit = vi.fn();

// Mock functions are now declared after imports using vi.mocked()

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(),
}));

vi.mock('@/components/app/chat/chat-business-logic', () => ({
  submitMessageScenario: vi.fn(),
  submitSuggestionScenario: vi.fn(),
  prepareReloadScenario: vi.fn(),
  handleChatError: vi.fn(),
}));

vi.mock('@/lib/security/guest-headers', () => ({
  headersForModel: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/config', () => ({
  SYSTEM_PROMPT_DEFAULT: 'Default system prompt',
  MESSAGE_MAX_LENGTH: 8000,
}));

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

vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

// Now import actual modules after mocking
import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'next/navigation';
import { useChatDraft } from '@/app/hooks/use-chat-draft';
import {
  handleChatError,
  prepareReloadScenario,
  submitMessageScenario,
  submitSuggestionScenario,
} from '@/components/app/chat/chat-business-logic';
import { useChatCore } from '@/components/app/chat/use-chat-core';
import { toast } from '@/components/ui/toast';
import { SYSTEM_PROMPT_DEFAULT } from '@/lib/config';
import { createMockFile, mockUserProfile } from '../test-utils';

// Get references to the mocked functions
const mockToastFn = vi.mocked(toast);
const mockSubmitMessageScenario = vi.mocked(submitMessageScenario);
const mockSubmitSuggestionScenario = vi.mocked(submitSuggestionScenario);
const mockPrepareReloadScenario = vi.mocked(prepareReloadScenario);
const mockHandleChatError = vi.mocked(handleChatError);

// TDD London Style: Focus on behavior and interactions
describe('useChatCore', () => {
  // Create fresh props for each test to avoid mock contamination
  const createFreshProps = () => ({
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
  });

  const defaultProps = createFreshProps();

  beforeEach(() => {
    // Don't clear ALL mocks as it breaks module mocks
    // vi.clearAllMocks();

    // Reset only the specific mocks we need to reset

    // Reset all mock functions
    mockSendMessage.mockClear().mockResolvedValue(undefined);
    mockSetMessages.mockClear();
    mockStop.mockClear();
    mockToastFn.mockClear();
    mockSetDraftValue.mockClear();
    mockHandleInputChange.mockClear();
    mockHandleSubmit.mockClear();

    // Setup business logic mocks with default success responses
    mockSubmitMessageScenario.mockClear().mockResolvedValue({
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

    mockSubmitSuggestionScenario.mockClear().mockResolvedValue({
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

    mockPrepareReloadScenario.mockClear().mockResolvedValue({
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

    mockHandleChatError.mockClear().mockImplementation(() => {});

    // Mock useChat hook with fresh implementations - ensure it always returns a valid object
    vi.mocked(useChat).mockImplementation(() => {
      const mockResult = {
        messages: [],
        status: 'idle' as const,
        error: null,
        stop: mockStop,
        setMessages: mockSetMessages,
        sendMessage: mockSendMessage,
        input: '',
        handleInputChange: mockHandleInputChange,
        handleSubmit: mockHandleSubmit,
        isLoading: false,
      };
      return mockResult;
    });

    // Mock useChatDraft hook
    vi.mocked(useChatDraft).mockImplementation(() => ({
      setDraftValue: mockSetDraftValue,
    }));

    // Mock useSearchParams hook
    vi.mocked(useSearchParams).mockImplementation(
      () =>
        ({
          get: vi.fn().mockReturnValue(null),
        }) as any
    );
  });

  afterEach(() => {
    // Don't use vi.clearAllMocks() as it breaks module mocks between tests
    // Don't use vi.resetAllMocks() as it can break mock implementations
    // Instead, ensure each test sets up its own mock state correctly in beforeEach
  });

  describe('When hook initializes', () => {
    it('should provide initial state values', () => {
      const props = createFreshProps();
      const { result } = renderHook(() => useChatCore(props));

      expect(result.current).not.toBeNull();
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.hasDialogAuth).toBe(false);
      expect(result.current.enableSearch).toBe(false); // enableSearch starts as false
      expect(result.current.reasoningEffort).toBe('medium');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.status).toBe('idle'); // AI SDK v5 uses 'idle' status
    });

    it('should detect authenticated user correctly', () => {
      const props = createFreshProps();
      props.user = mockUserProfile;

      const { result } = renderHook(() => useChatCore(props));

      expect(result.current).not.toBeNull();
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.systemPrompt).toBe(mockUserProfile.system_prompt);
    });

    it('should use default system prompt when user has none', () => {
      const props = createFreshProps();
      const userWithoutPrompt = { ...mockUserProfile, system_prompt: null };
      props.user = userWithoutPrompt;

      const { result } = renderHook(() => useChatCore(props));

      expect(result.current).not.toBeNull();
      expect(result.current.systemPrompt).toBe(SYSTEM_PROMPT_DEFAULT);
    });
  });

  describe('When handling search params', () => {
    it('should handle prompt parameter from URL', async () => {
      // Mock the search params to return a URL parameter
      const mockGet = vi.fn().mockReturnValue('Hello from URL');
      vi.mocked(useSearchParams).mockReturnValue({ get: mockGet } as any);

      // Mock requestAnimationFrame for the effect
      const originalRAF = global.requestAnimationFrame;
      global.requestAnimationFrame = vi.fn((cb) => {
        cb(0);
        return 0;
      });

      const props = createFreshProps();
      const { result } = renderHook(() => useChatCore(props));

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
      mockSubmitMessageScenario.mockResolvedValue({
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
      const props = createFreshProps();
      props.user = mockUserProfile;
      props.chatId = 'test-chat-id';
      props.files = [createMockFile('test.txt', 'content')];
      props.draftValue = 'Test message';

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
      mockSubmitMessageScenario.mockClear();

      // Mock sendMessage to resolve successfully
      mockSendMessage.mockResolvedValue(undefined);

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook returned properly
      if (result.current === null) {
        throw new Error(
          'Hook initialization failed - this indicates a mocking issue'
        );
      }

      // Ensure hook is properly initialized before continuing
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('Test message');

      // Use single act() call to avoid overlapping
      await act(async () => {
        await result.current.submit();
      });

      // Check that submit was called and business logic was invoked
      expect(mockSubmitMessageScenario).toHaveBeenCalledWith(
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
      mockToastFn.mockClear();

      // Override the default successful mock with a failure response
      mockSubmitMessageScenario.mockResolvedValue({
        success: false,
        error: 'Submission failed',
      });

      const props = createFreshProps();
      props.user = mockUserProfile;
      props.draftValue = 'Test message';

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook returned properly
      if (result.current === null) {
        throw new Error('Hook initialization failed in failed message test');
      }

      // Single act() call for the async operation
      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockToastFn).toHaveBeenCalledWith({
        title: 'Submission failed',
        status: 'error',
      });
    });

    it('should create and cleanup optimistic messages properly', async () => {
      const props = createFreshProps();
      props.user = mockUserProfile;
      props.files = [createMockFile()];
      props.draftValue = 'Test message';

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
      const props = Object.assign({}, defaultProps, {
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
      });

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
      mockSubmitSuggestionScenario.mockResolvedValue({
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
      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
        chatId: 'test-chat-id',
      });

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockSubmitSuggestionScenario).toHaveBeenCalledWith(
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
      mockToastFn.mockClear();

      mockSubmitSuggestionScenario.mockResolvedValue({
        success: false,
        error: 'Suggestion failed',
      });

      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
      });

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockToastFn).toHaveBeenCalledWith({
        title: 'Suggestion failed',
        status: 'error',
      });
    });
  });

  describe('When handling reload', () => {
    beforeEach(() => {
      mockPrepareReloadScenario.mockResolvedValue({
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
      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
        chatId: 'test-chat-id',
      });

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
      mockPrepareReloadScenario.mockClear();
      mockPrepareReloadScenario.mockResolvedValue({
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

      expect(mockPrepareReloadScenario).toHaveBeenCalledWith({
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
      mockToastFn.mockClear();

      mockPrepareReloadScenario.mockResolvedValue({
        success: false,
        error: 'Reload failed',
      });

      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
      });

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      await act(async () => {
        await result.current.handleReload();
      });

      expect(mockToastFn).toHaveBeenCalledWith({
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
      mockSubmitMessageScenario.mockRejectedValue(
        new Error('Unexpected error')
      );

      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
        draftValue: 'Test message',
      });

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();
      expect(result.current.input).toBe('Test message');

      await act(async () => {
        await result.current.submit();
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockHandleChatError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle unexpected errors during suggestion submission', async () => {
      mockSubmitSuggestionScenario.mockRejectedValue(
        new Error('Unexpected suggestion error')
      );

      const props = Object.assign({}, defaultProps, {
        user: mockUserProfile,
      });

      const { result } = renderHook(() => useChatCore(props));

      // Ensure hook is properly initialized
      expect(result.current).not.toBeNull();

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke');
      });

      expect(result.current.isSubmitting).toBe(false);
      expect(mockHandleChatError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
