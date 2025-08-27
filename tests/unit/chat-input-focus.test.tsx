import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock the ReasoningEffortSelector to a simple stub for this focus test
vi.mock('@/components/app/chat/reasoning-effort-selector', () => ({
  ReasoningEffortSelector: ({ children, ...props }: any) => {
    // Filter out component-specific props that shouldn't be passed to DOM
    const { onReasoningEffortChange, reasoningEffort, ...domProps } = props;
    return (
      <div data-testid="reasoning-effort-selector" {...domProps}>
        {children}
      </div>
    );
  },
}));
vi.mock('@/components/app/suggestions/prompt-system', () => ({
  PromptSystem: ({ children, ...props }: any) => {
    // Filter out component-specific props that shouldn't be passed to DOM
    const { onSelect, prompts, ...domProps } = props;
    return (
      <div data-testid="prompt-system" {...domProps}>
        {children}
      </div>
    );
  },
}));

import { ChatInput } from '@/components/app/chat-input/chat-input';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ModelProvider } from '@/lib/model-store/provider';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';
import { UserProvider } from '@/lib/user-store/provider';
import {
  mockUserProfile,
  renderWithProviders,
  screen,
} from '@/tests/test-utils';

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
      <UserProvider initialUser={mockUserProfile}>
        <ModelProvider>
          <UserPreferencesProvider>
            <TooltipProvider>
              <ChatInputHarness hasSuggestions={false} />
            </TooltipProvider>
          </UserPreferencesProvider>
        </ModelProvider>
      </UserProvider>
    );

    const textarea = screen.getByPlaceholderText(
      'Ask anything…'
    ) as HTMLInputElement;

    // Use global act function
    await (global as any).act(async () => {
      await user.type(textarea, 'h');
    });
    expect(textarea.value).toBe('h');

    // Simulate suggestions mounting
    (global as any).act(() => {
      rerender(
        <UserProvider initialUser={mockUserProfile}>
          <ModelProvider>
            <UserPreferencesProvider>
              <TooltipProvider>
                <ChatInputHarness hasSuggestions={true} />
              </TooltipProvider>
            </UserPreferencesProvider>
          </ModelProvider>
        </UserProvider>
      );
    });

    // Should still be able to type - need to get the element again after rerender
    const textareaAfterRerender = screen.getByPlaceholderText(
      'Ask anything…'
    ) as HTMLInputElement;
    await (global as any).act(async () => {
      await user.type(textareaAfterRerender, 'i');
    });
    expect(textareaAfterRerender.value).toBe('hi');
  });
});
