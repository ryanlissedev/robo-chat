import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@/tests/test-utils'
import userEvent from '@testing-library/user-event'

import { MultiChatInput } from '@/app/components/multi-chat/multi-chat-input'

function ControlledMultiChat() {
  const [val, setVal] = useState('')
  const [models, setModels] = useState<string[]>(['m1'])
  return (
    <MultiChatInput
      value={val}
      onValueChange={setVal}
      onSend={() => {}}
      isSubmitting={false}
      files={[]}
      onFileUpload={() => {}}
      onFileRemove={() => {}}
      selectedModelIds={models}
      onSelectedModelIdsChange={setModels}
      isUserAuthenticated={true}
      stop={() => {}}
      status="ready"
      anyLoading={false}
    />
  )
}

describe('MultiChatInput controlled behavior', () => {
  it('updates value as user types', async () => {
    const user = userEvent.setup()
    render(<ControlledMultiChat />)

    const textarea = screen.getByPlaceholderText('Ask all selected models...') as HTMLTextAreaElement
    await user.type(textarea, 'hello')

    expect(textarea.value).toBe('hello')
  })
})

