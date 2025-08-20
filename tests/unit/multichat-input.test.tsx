import React, { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders, screen } from '@/tests/test-utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import userEvent from '@testing-library/user-event'

import { MultiChatInput } from '@/app/components/multi-chat/multi-chat-input'

// Avoid provider/fetch complexity by mocking MultiModelSelector
vi.mock('@/components/common/multi-model-selector/base', () => ({
  MultiModelSelector: () => <div data-testid="mock-multi-model-selector" />,
}))

function ControlledMultiChat() {
  const [val, setVal] = useState('')
  const [models, setModels] = useState<string[]>(['m1'])
  return (
    <TooltipProvider>
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
    </TooltipProvider>
  )
}

describe('MultiChatInput controlled behavior', () => {
  it('updates value as user types', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ControlledMultiChat />)

    const textarea = screen.getByPlaceholderText('Ask all selected models...') as HTMLTextAreaElement
    await user.type(textarea, 'hello')

    expect(textarea.value).toBe('hello')
  })
})
