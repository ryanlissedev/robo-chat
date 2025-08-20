import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { renderWithProviders, screen } from '@/tests/test-utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ModelProvider } from '@/lib/model-store/provider'
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider'
import userEvent from '@testing-library/user-event'

import { ChatInput } from '@/app/components/chat-input/chat-input'

function ChatInputHarness({ hasSuggestions }: { hasSuggestions: boolean }) {
  const [val, setVal] = useState('')
  return (
    <ChatInput
      value={val}
      onValueChange={setVal}
      onSend={() => {}}
      isSubmitting={false}
      files={[]}
      onFileUpload={() => {}}
      onFileRemove={() => {}}
      onSuggestion={() => {}}
      hasSuggestions={hasSuggestions}
      onSelectModel={() => {}}
      selectedModel={'gpt-5-mini'}
      isUserAuthenticated={false}
      stop={() => {}}
      status={'ready'}
      setEnableSearch={() => {}}
      enableSearch={false}
      quotedText={null}
    />
  )
}

describe('ChatInput focus resilience with suggestions', () => {
  it('retains focus and allows typing after suggestions appear', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <ChatInputHarness hasSuggestions={false} />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    )

    const textarea = screen.getByPlaceholderText('Ask anything…') as HTMLTextAreaElement
    await user.type(textarea, 'h')
    expect(textarea.value).toBe('h')

    // Simulate suggestions mounting
    rerender(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <ChatInputHarness hasSuggestions={true} />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    )

    // Should still be able to type
    await user.type(textarea, 'i')
    expect(textarea.value).toBe('hi')
  })
})
