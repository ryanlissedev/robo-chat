import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ChatInput } from '@/app/components/chat-input/chat-input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ModelProvider } from '@/lib/model-store/provider';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';
import { renderWithProviders, screen } from '@/tests/test-utils';

function ChatInputHarness({ hasSuggestions }: { hasSuggestions: boolean }) {
  const [val, setVal] = useState('');
  return (
    <ChatInput
      enableSearch={false}
      files={[]}
      hasSuggestions={hasSuggestions}
      isSubmitting={false}
      isUserAuthenticated={false}
      onFileRemove={() => {}}
      onFileUpload={() => {}}
      onSelectModel={() => {}}
      onSend={() => {}}
      onSuggestion={() => {}}
      onValueChange={setVal}
      quotedText={null}
      selectedModel={'gpt-5-mini'}
      setEnableSearch={() => {}}
      status={'ready'}
      stop={() => {}}
      value={val}
    />
  );
}

describe('ChatInput focus resilience with suggestions', () => {
  it('retains focus and allows typing after suggestions appear', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <ChatInputHarness hasSuggestions={false} />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    );

    const textarea = screen.getByPlaceholderText(
      'Ask anything…'
    ) as HTMLTextAreaElement;
    await user.type(textarea, 'h');
    expect(textarea.value).toBe('h');

    // Simulate suggestions mounting
    rerender(
      <ModelProvider>
        <UserPreferencesProvider>
          <TooltipProvider>
            <ChatInputHarness hasSuggestions={true} />
          </TooltipProvider>
        </UserPreferencesProvider>
      </ModelProvider>
    );

    // Should still be able to type
    await user.type(textarea, 'i');
    expect(textarea.value).toBe('hi');
  });
});
