import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, rerender } from '@/tests/test-utils'
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
    const { rerender } = render(<ChatInputHarness hasSuggestions={false} />)

    const textarea = screen.getByPlaceholderText('Ask anything…') as HTMLTextAreaElement
    await user.type(textarea, 'h')
    expect(textarea.value).toBe('h')

    // Simulate suggestions mounting
    rerender(<ChatInputHarness hasSuggestions={true} />)

    // Should still be able to type
    await user.type(textarea, 'i')
    expect(textarea.value).toBe('hi')
  })
})

