import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@/tests/test-utils'

// Under test
import { Chat } from '@/app/components/chat/chat'

// Mocks for dependent hooks
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/chat-store/session/provider', () => ({
  useChatSession: () => ({ chatId: 'non-existent-id' }),
}))

vi.mock('@/lib/chat-store/chats/provider', () => ({
  useChats: () => ({
    createNewChat: vi.fn(),
    getChatById: vi.fn(() => undefined),
    updateChatModel: vi.fn(),
    bumpChat: vi.fn(),
    isLoading: false,
    hasFetched: false, // toggled per test
  }),
}))

vi.mock('@/lib/chat-store/messages/provider', () => ({
  useMessages: () => ({ messages: [], cacheAndAddMessage: vi.fn() }),
}))

vi.mock('@/lib/user-store/provider', () => ({
  useUser: () => ({ user: null }),
}))

vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({ preferences: { promptSuggestions: false } }),
}))

vi.mock('@/app/hooks/use-chat-draft', () => ({
  useChatDraft: () => ({ draftValue: '', clearDraft: vi.fn() }),
}))

vi.mock('@/app/components/chat/use-model', () => ({
  useModel: () => ({ selectedModel: 'test', handleModelChange: vi.fn() }),
}))

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
}))

vi.mock('@/app/components/chat/use-chat-operations', () => ({
  useChatOperations: () => ({
    checkLimitsAndNotify: vi.fn(),
    ensureChatExists: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
  }),
}))

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
}))

describe('Chat redirect gating', () => {
  const { redirect } = require('next/navigation')

  beforeEach(() => {
    redirect.mockClear()
  })

  it('does not redirect before chats have fetched', () => {
    // useChats is mocked with hasFetched: false above
    render(<Chat />)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects when chats have fetched and chat is missing', async () => {
    // Override useChats mock to set hasFetched: true for this test
    vi.doMock('@/lib/chat-store/chats/provider', () => ({
      useChats: () => ({
        createNewChat: vi.fn(),
        getChatById: vi.fn(() => undefined),
        updateChatModel: vi.fn(),
        bumpChat: vi.fn(),
        isLoading: false,
        hasFetched: true,
      }),
    }))

    // Re-require after doMock
    const { Chat: FreshChat } = await import('@/app/components/chat/chat')
    render(<FreshChat />)
    expect(redirect).toHaveBeenCalledWith('/')
  })
})

