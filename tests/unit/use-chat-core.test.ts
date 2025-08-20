import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatCore } from '@/app/components/chat/use-chat-core'
import { mockUserProfile, createMockFile } from '../test-utils'
import type { UIMessage as Message } from 'ai'

// Mock the useChat hook from AI SDK
const mockUseChat = {
  messages: [],
  input: '',
  handleSubmit: vi.fn(),
  status: 'idle' as const,
  error: null,
  reload: vi.fn(),
  stop: vi.fn(),
  setMessages: vi.fn(),
  setInput: vi.fn(),
  append: vi.fn(),
}

vi.mock('@ai-sdk/react', () => ({
  useChat: () => mockUseChat,
}))

// Mock the chat business logic
vi.mock('@/app/components/chat/chat-business-logic', () => ({
  submitMessageScenario: vi.fn(),
  submitSuggestionScenario: vi.fn(),
  prepareReloadScenario: vi.fn(),
  handleChatError: vi.fn(),
}))

// Mock the chat draft hook
vi.mock('@/app/hooks/use-chat-draft', () => ({
  useChatDraft: () => ({
    setDraftValue: vi.fn(),
  }),
}))

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}))

// Mock toast
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}))

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
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockUseChat.messages = []
    mockUseChat.input = ''
    mockUseChat.status = 'idle'
    mockUseChat.error = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('When hook initializes', () => {
    it('should provide initial state values', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      expect(result.current.isSubmitting).toBe(false)
      expect(result.current.hasDialogAuth).toBe(false)
      expect(result.current.enableSearch).toBe(true)
      expect(result.current.reasoningEffort).toBe('medium')
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should detect authenticated user correctly', () => {
      const propsWithUser = {
        ...defaultProps,
        user: mockUserProfile,
      }

      const { result } = renderHook(() => useChatCore(propsWithUser))

      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.systemPrompt).toBe(mockUserProfile.system_prompt)
    })

    it('should use default system prompt when user has none', () => {
      const userWithoutPrompt = { ...mockUserProfile, system_prompt: null }
      const propsWithUser = {
        ...defaultProps,
        user: userWithoutPrompt,
      }

      const { result } = renderHook(() => useChatCore(propsWithUser))

      expect(result.current.systemPrompt).toBe('You are a helpful assistant.')
    })
  })

  describe('When handling search params', () => {
    it('should set input from prompt parameter', async () => {
      const mockSearchParams = {
        get: vi.fn().mockReturnValue('Hello from URL'),
      }

      vi.mocked(require('next/navigation').useSearchParams).mockReturnValue(mockSearchParams)

      renderHook(() => useChatCore(defaultProps))

      await waitFor(() => {
        expect(mockUseChat.setInput).toHaveBeenCalledWith('Hello from URL')
      })
    })
  })

  describe('When submitting messages', () => {
    const { submitMessageScenario } = require('@/app/components/chat/chat-business-logic')

    beforeEach(() => {
      submitMessageScenario.mockResolvedValue({
        success: true,
        data: {
          chatId: 'test-chat-id',
          requestOptions: { body: JSON.stringify({ test: 'data' }) },
        },
      })
    })

    it('should handle successful message submission', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
        files: [createMockFile('test.txt', 'content')],
      }

      mockUseChat.input = 'Test message'
      props.createOptimisticAttachments.mockReturnValue([{
        name: 'test.txt',
        contentType: 'text/plain',
        url: 'mock-url',
      }])

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(mockUseChat.setMessages).toHaveBeenCalled()
      expect(mockUseChat.setInput).toHaveBeenCalledWith('')
      expect(props.setFiles).toHaveBeenCalledWith([])
      expect(submitMessageScenario).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'Test message',
          files: expect.any(Array),
          user: mockUserProfile,
          selectedModel: 'test-model',
          isAuthenticated: true,
          enableSearch: true,
          reasoningEffort: 'medium',
          chatId: 'test-chat-id',
        }),
        expect.any(Object)
      )
    })

    it('should handle failed message submission', async () => {
      const { toast } = require('@/components/ui/toast')
      
      submitMessageScenario.mockResolvedValue({
        success: false,
        error: 'Submission failed',
      })

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      }

      mockUseChat.input = 'Test message'

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(toast).toHaveBeenCalledWith({
        title: 'Submission failed',
        status: 'error',
      })
    })

    it('should create and cleanup optimistic messages properly', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        files: [createMockFile()],
      }

      mockUseChat.input = 'Test message'
      props.createOptimisticAttachments.mockReturnValue([{
        name: 'test.txt',
        contentType: 'text/plain',
        url: 'mock-url',
      }])

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.submit()
      })

      // Should have added optimistic message
      expect(mockUseChat.setMessages).toHaveBeenCalledWith(expect.any(Function))
      
      // Should have cleaned up optimistic message after success
      expect(props.cleanupOptimisticAttachments).toHaveBeenCalled()
      expect(props.cacheAndAddMessage).toHaveBeenCalled()
      expect(props.clearDraft).toHaveBeenCalled()
    })

    it('should bump chat when there are previous messages', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
      }

      mockUseChat.messages = [{ id: '1', content: 'Previous message', role: 'user' }] as Message[]
      mockUseChat.input = 'New message'

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.submit()
      })

      expect(props.bumpChat).toHaveBeenCalledWith('test-chat-id')
    })
  })

  describe('When handling suggestions', () => {
    const { submitSuggestionScenario } = require('@/app/components/chat/chat-business-logic')

    beforeEach(() => {
      submitSuggestionScenario.mockResolvedValue({
        success: true,
        data: {
          requestOptions: { body: JSON.stringify({ suggestion: 'data' }) },
        },
      })
    })

    it('should handle successful suggestion submission', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
      }

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke')
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(submitSuggestionScenario).toHaveBeenCalledWith(
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
      )
      expect(mockUseChat.append).toHaveBeenCalledWith(
        {
          role: 'user',
          content: 'Tell me a joke',
        },
        expect.any(Object)
      )
    })

    it('should handle failed suggestion submission', async () => {
      const { toast } = require('@/components/ui/toast')
      
      submitSuggestionScenario.mockResolvedValue({
        success: false,
        error: 'Suggestion failed',
      })

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      }

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.handleSuggestion('Tell me a joke')
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(toast).toHaveBeenCalledWith({
        title: 'Suggestion failed',
        status: 'error',
      })
    })
  })

  describe('When handling reload', () => {
    const { prepareReloadScenario } = require('@/app/components/chat/chat-business-logic')

    beforeEach(() => {
      prepareReloadScenario.mockResolvedValue({
        success: true,
        data: {
          requestOptions: { body: JSON.stringify({ reload: 'data' }) },
        },
      })
    })

    it('should handle successful reload', async () => {
      const props = {
        ...defaultProps,
        user: mockUserProfile,
        chatId: 'test-chat-id',
      }

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.handleReload()
      })

      expect(prepareReloadScenario).toHaveBeenCalledWith({
        user: mockUserProfile,
        chatId: 'test-chat-id',
        selectedModel: 'test-model',
        isAuthenticated: true,
        systemPrompt: mockUserProfile.system_prompt,
        reasoningEffort: 'medium',
      })
      expect(mockUseChat.reload).toHaveBeenCalled()
    })

    it('should handle failed reload', async () => {
      const { toast } = require('@/components/ui/toast')
      
      prepareReloadScenario.mockResolvedValue({
        success: false,
        error: 'Reload failed',
      })

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      }

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.handleReload()
      })

      expect(toast).toHaveBeenCalledWith({
        title: 'Reload failed',
        status: 'error',
      })
    })
  })

  describe('When handling input changes', () => {
    it('should update both AI SDK input and draft value', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      act(() => {
        result.current.handleInputChange('New input value')
      })

      expect(mockUseChat.setInput).toHaveBeenCalledWith('New input value')
      // Draft value setting is handled by the mocked useChatDraft hook
    })
  })

  describe('When managing UI state', () => {
    it('should allow setting submission state', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      act(() => {
        result.current.setIsSubmitting(true)
      })

      expect(result.current.isSubmitting).toBe(true)

      act(() => {
        result.current.setIsSubmitting(false)
      })

      expect(result.current.isSubmitting).toBe(false)
    })

    it('should allow setting dialog auth state', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      act(() => {
        result.current.setHasDialogAuth(true)
      })

      expect(result.current.hasDialogAuth).toBe(true)
    })

    it('should allow setting search enablement', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      act(() => {
        result.current.setEnableSearch(false)
      })

      expect(result.current.enableSearch).toBe(false)
    })

    it('should allow setting reasoning effort', () => {
      const { result } = renderHook(() => useChatCore(defaultProps))

      act(() => {
        result.current.setReasoningEffort('high')
      })

      expect(result.current.reasoningEffort).toBe('high')
    })
  })

  describe('When handling errors', () => {
    it('should handle unexpected errors during submission', async () => {
      const { handleChatError } = require('@/app/components/chat/chat-business-logic')
      const { submitMessageScenario } = require('@/app/components/chat/chat-business-logic')
      
      submitMessageScenario.mockRejectedValue(new Error('Unexpected error'))

      const props = {
        ...defaultProps,
        user: mockUserProfile,
      }

      mockUseChat.input = 'Test message'

      const { result } = renderHook(() => useChatCore(props))

      await act(async () => {
        await result.current.submit()
      })

      expect(result.current.isSubmitting).toBe(false)
      expect(handleChatError).toHaveBeenCalledWith(
        expect.any(Error),
        'Message submission'
      )
    })

    it('should handle chat errors via error handler', () => {
      const { handleChatError } = require('@/app/components/chat/chat-business-logic')
      
      const props = {
        ...defaultProps,
        user: mockUserProfile,
      }

      renderHook(() => useChatCore(props))

      // Simulate error from useChat
      const mockError = new Error('Chat error')
      const onError = mockUseChat.handleSubmit.mock.calls[0]?.[1]?.onError || 
                      vi.mocked(require('@ai-sdk/react').useChat).mock.calls[0]?.[0]?.onError

      if (onError) {
        onError(mockError)
        expect(handleChatError).toHaveBeenCalledWith(mockError, 'Chat')
      }
    })
  })
})