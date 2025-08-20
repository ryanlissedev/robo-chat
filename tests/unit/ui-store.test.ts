import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { 
  useUIStore, 
  useDialogState, 
  useChatUIState, 
  useFormState, 
  useExpandableState, 
  useLoadingState, 
  useErrorState,
  useDialogActions,
  useChatUIActions,
  useFormActions,
  useExpandableActions,
  useLoadingActions,
  useErrorActions,
  useDialogToggle,
  useOptimisticState
} from '@/lib/ui-store/store'

// TDD London Style: Focus on behavior, test from outside-in
describe('UI Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useUIStore.getState().reset()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dialog State Management', () => {
    it('should open and close dialogs correctly', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openDialog('auth')
      })

      expect(result.current.dialogs.auth).toBe(true)

      act(() => {
        result.current.closeDialog('auth')
      })

      expect(result.current.dialogs.auth).toBe(false)
    })

    it('should close all dialogs at once', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openDialog('auth')
        result.current.openDialog('settings')
        result.current.openDialog('feedback')
      })

      expect(result.current.dialogs.auth).toBe(true)
      expect(result.current.dialogs.settings).toBe(true)
      expect(result.current.dialogs.feedback).toBe(true)

      act(() => {
        result.current.closeAllDialogs()
      })

      expect(result.current.dialogs.auth).toBe(false)
      expect(result.current.dialogs.settings).toBe(false)
      expect(result.current.dialogs.feedback).toBe(false)
    })

    it('should reset specific dialog state', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.openDialog('auth')
        result.current.setError('googleSignIn', 'Test error')
        result.current.setLoading('googleSignIn', true)
      })

      expect(result.current.dialogs.auth).toBe(true)
      expect(result.current.errors.googleSignIn).toBe('Test error')
      expect(result.current.loading.googleSignIn).toBe(true)

      act(() => {
        result.current.resetDialog('auth')
      })

      expect(result.current.dialogs.auth).toBe(false)
      expect(result.current.errors.googleSignIn).toBe(null)
      expect(result.current.loading.googleSignIn).toBe(false)
    })
  })

  describe('Chat UI State Management', () => {
    it('should manage search enablement', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.chatUI.enableSearch).toBe(true)

      act(() => {
        result.current.setEnableSearch(false)
      })

      expect(result.current.chatUI.enableSearch).toBe(false)
    })

    it('should manage reasoning effort levels', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.chatUI.reasoningEffort).toBe('medium')

      act(() => {
        result.current.setReasoningEffort('high')
      })

      expect(result.current.chatUI.reasoningEffort).toBe('high')
    })

    it('should manage submission state', () => {
      const { result } = renderHook(() => useUIStore())

      expect(result.current.chatUI.isSubmitting).toBe(false)

      act(() => {
        result.current.setIsSubmitting(true)
      })

      expect(result.current.chatUI.isSubmitting).toBe(true)
    })

    it('should manage quoted text', () => {
      const { result } = renderHook(() => useUIStore())
      const quotedText = { text: 'Hello world', messageId: 'msg-123' }

      expect(result.current.chatUI.quotedText).toBe(null)

      act(() => {
        result.current.setQuotedText(quotedText)
      })

      expect(result.current.chatUI.quotedText).toEqual(quotedText)

      act(() => {
        result.current.clearQuotedText()
      })

      expect(result.current.chatUI.quotedText).toBe(null)
    })
  })

  describe('Form State Management', () => {
    it('should set and clear form fields', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setFormField('createProjectName', 'My Project')
        result.current.setFormField('feedbackComment', 'Great feature!')
      })

      expect(result.current.forms.createProjectName).toBe('My Project')
      expect(result.current.forms.feedbackComment).toBe('Great feature!')

      act(() => {
        result.current.clearFormField('createProjectName')
      })

      expect(result.current.forms.createProjectName).toBe('')
      expect(result.current.forms.feedbackComment).toBe('Great feature!')

      act(() => {
        result.current.clearForm()
      })

      expect(result.current.forms.createProjectName).toBe('')
      expect(result.current.forms.feedbackComment).toBe('')
    })

    it('should handle editing state', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setFormField('editingMessageId', 'msg-456')
        result.current.setFormField('editingContent', 'Updated content')
      })

      expect(result.current.forms.editingMessageId).toBe('msg-456')
      expect(result.current.forms.editingContent).toBe('Updated content')
    })
  })

  describe('Expandable State Management', () => {
    it('should set and toggle expandable states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setExpanded('toolInvocations', 'tool-1', true)
      })

      expect(result.current.expandable.toolInvocations['tool-1']).toBe(true)

      act(() => {
        result.current.toggleExpanded('toolInvocations', 'tool-1')
      })

      expect(result.current.expandable.toolInvocations['tool-1']).toBe(false)

      act(() => {
        result.current.toggleExpanded('toolInvocations', 'tool-2')
      })

      expect(result.current.expandable.toolInvocations['tool-2']).toBe(true)
    })

    it('should clear expandable states', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setExpanded('toolInvocations', 'tool-1', true)
        result.current.setExpanded('sourcesList', 'source-1', true)
        result.current.setExpanded('reasoning', 'reason-1', true)
      })

      expect(result.current.expandable.toolInvocations['tool-1']).toBe(true)
      expect(result.current.expandable.sourcesList['source-1']).toBe(true)
      expect(result.current.expandable.reasoning['reason-1']).toBe(true)

      act(() => {
        result.current.clearExpandedStates('toolInvocations')
      })

      expect(result.current.expandable.toolInvocations).toEqual({})
      expect(result.current.expandable.sourcesList['source-1']).toBe(true)
      expect(result.current.expandable.reasoning['reason-1']).toBe(true)

      act(() => {
        result.current.clearExpandedStates()
      })

      expect(result.current.expandable.sourcesList).toEqual({})
      expect(result.current.expandable.reasoning).toEqual({})
    })
  })

  describe('Loading State Management', () => {
    it('should manage loading states for different operations', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setLoading('googleSignIn', true)
        result.current.setLoading('fileUpload', true)
      })

      expect(result.current.loading.googleSignIn).toBe(true)
      expect(result.current.loading.fileUpload).toBe(true)
      expect(result.current.loading.messageEdit).toBe(false)

      act(() => {
        result.current.setLoading('googleSignIn', false)
      })

      expect(result.current.loading.googleSignIn).toBe(false)
      expect(result.current.loading.fileUpload).toBe(true)

      act(() => {
        result.current.clearAllLoading()
      })

      expect(result.current.loading.googleSignIn).toBe(false)
      expect(result.current.loading.fileUpload).toBe(false)
    })
  })

  describe('Error State Management', () => {
    it('should manage error states for different operations', () => {
      const { result } = renderHook(() => useUIStore())

      act(() => {
        result.current.setError('googleSignIn', 'Authentication failed')
        result.current.setError('fileUpload', 'File too large')
      })

      expect(result.current.errors.googleSignIn).toBe('Authentication failed')
      expect(result.current.errors.fileUpload).toBe('File too large')
      expect(result.current.errors.messageEdit).toBe(null)

      act(() => {
        result.current.clearError('googleSignIn')
      })

      expect(result.current.errors.googleSignIn).toBe(null)
      expect(result.current.errors.fileUpload).toBe('File too large')

      act(() => {
        result.current.clearAllErrors()
      })

      expect(result.current.errors.fileUpload).toBe(null)
    })
  })

  describe('Selector Hooks', () => {
    it('should provide specific dialog state', () => {
      const { result: storeResult } = renderHook(() => useUIStore())
      const { result: selectorResult } = renderHook(() => useDialogState('auth'))

      expect(selectorResult.current).toBe(false)

      act(() => {
        storeResult.current.openDialog('auth')
      })

      expect(selectorResult.current).toBe(true)
    })

    it('should provide expandable state with default false', () => {
      const { result } = renderHook(() => useExpandableState('toolInvocations', 'tool-1'))

      expect(result.current).toBe(false)
    })
  })

  describe('Action Hooks', () => {
    it('should provide dialog actions', () => {
      const { result } = renderHook(() => useDialogActions())

      expect(typeof result.current.openDialog).toBe('function')
      expect(typeof result.current.closeDialog).toBe('function')
      expect(typeof result.current.closeAllDialogs).toBe('function')
      expect(typeof result.current.resetDialog).toBe('function')
    })

    it('should provide chat UI actions', () => {
      const { result } = renderHook(() => useChatUIActions())

      expect(typeof result.current.setEnableSearch).toBe('function')
      expect(typeof result.current.setReasoningEffort).toBe('function')
      expect(typeof result.current.setIsSubmitting).toBe('function')
      expect(typeof result.current.setQuotedText).toBe('function')
      expect(typeof result.current.clearQuotedText).toBe('function')
    })
  })

  describe('Utility Hooks', () => {
    it('should provide dialog toggle functionality', () => {
      const { result } = renderHook(() => useDialogToggle('settings'))

      expect(result.current.isOpen).toBe(false)

      act(() => {
        result.current.open()
      })

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.toggle()
      })

      expect(result.current.isOpen).toBe(false)

      act(() => {
        result.current.toggle()
      })

      expect(result.current.isOpen).toBe(true)

      act(() => {
        result.current.close()
      })

      expect(result.current.isOpen).toBe(false)
    })

    it('should provide optimistic state management', async () => {
      const { result } = renderHook(() => useOptimisticState('initial', 'fileUpload'))

      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)

      const mockAsyncFn = vi.fn().mockResolvedValue('success')

      let resultPromise: Promise<any>
      act(() => {
        resultPromise = result.current.execute(mockAsyncFn)
      })

      expect(result.current.isLoading).toBe(true)

      const executionResult = await resultPromise

      expect(executionResult).toBe('success')
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('should handle optimistic state errors', async () => {
      const { result } = renderHook(() => useOptimisticState('initial', 'fileUpload'))

      const mockAsyncFn = vi.fn().mockRejectedValue(new Error('Upload failed'))

      let resultPromise: Promise<any>
      act(() => {
        resultPromise = result.current.execute(mockAsyncFn)
      })

      const executionResult = await resultPromise

      expect(executionResult).toBe(null)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe('Upload failed')
    })
  })

  describe('Store Reset', () => {
    it('should reset entire store to initial state', () => {
      const { result } = renderHook(() => useUIStore())

      // Make some changes
      act(() => {
        result.current.openDialog('auth')
        result.current.setEnableSearch(false)
        result.current.setFormField('createProjectName', 'Test Project')
        result.current.setExpanded('toolInvocations', 'tool-1', true)
        result.current.setLoading('googleSignIn', true)
        result.current.setError('fileUpload', 'Error message')
      })

      // Verify changes were made
      expect(result.current.dialogs.auth).toBe(true)
      expect(result.current.chatUI.enableSearch).toBe(false)
      expect(result.current.forms.createProjectName).toBe('Test Project')
      expect(result.current.expandable.toolInvocations['tool-1']).toBe(true)
      expect(result.current.loading.googleSignIn).toBe(true)
      expect(result.current.errors.fileUpload).toBe('Error message')

      // Reset store
      act(() => {
        result.current.reset()
      })

      // Verify everything is back to initial state
      expect(result.current.dialogs.auth).toBe(false)
      expect(result.current.chatUI.enableSearch).toBe(true)
      expect(result.current.forms.createProjectName).toBe('')
      expect(result.current.expandable.toolInvocations).toEqual({})
      expect(result.current.loading.googleSignIn).toBe(false)
      expect(result.current.errors.fileUpload).toBe(null)
    })
  })
})