import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MultiChatInput } from '@/app/components/multi-chat/multi-chat-input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithProviders, screen } from '@/tests/test-utils';

// Avoid provider/fetch complexity by mocking MultiModelSelector
vi.mock('@/components/common/multi-model-selector/base', () => ({
  MultiModelSelector: () => <div data-testid="mock-multi-model-selector" />,
}));

function ControlledMultiChat() {
  const [val, setVal] = useState('');
  const [models, setModels] = useState<string[]>(['m1']);
  return (
    <TooltipProvider>
      <MultiChatInput
        anyLoading={false}
        files={[]}
        isSubmitting={false}
        isUserAuthenticated={true}
        onFileRemove={() => {}}
        onFileUpload={() => {}}
        onSelectedModelIdsChange={setModels}
        onSend={() => {}}
        onValueChange={setVal}
        selectedModelIds={models}
        status="ready"
        stop={() => {}}
        value={val}
      />
    </TooltipProvider>
  );
}

describe('MultiChatInput controlled behavior', () => {
  it('updates value as user types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledMultiChat />);

    const textarea = screen.getByPlaceholderText(
      'Ask all selected models...'
    ) as HTMLTextAreaElement;
    await user.type(textarea, 'hello');

    expect(textarea.value).toBe('hello');
  });
});
