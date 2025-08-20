import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/tests/test-utils'
import userEvent from '@testing-library/user-event'

import { PromptInput, PromptInputTextarea } from '@/components/prompt-kit/prompt-input'

function ControlledPrompt() {
  const [val, setVal] = useState('')
  return (
    <PromptInput value={val} onValueChange={setVal}>
      <PromptInputTextarea placeholder="Type here" />
    </PromptInput>
  )
}

describe('PromptInput controlled behavior', () => {
  it('updates value as user types and calls onValueChange', async () => {
    const user = userEvent.setup()
    render(<ControlledPrompt />)

    const textarea = screen.getByPlaceholderText('Type here') as HTMLTextAreaElement
    await user.type(textarea, 'hello')

    expect(textarea.value).toBe('hello')
  })
})

