import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  PromptInput,
  PromptInputTextarea,
} from '@/components/prompt-kit/prompt-input';
import { renderWithProviders, screen } from '@/tests/test-utils';

function ControlledPrompt() {
  const [val, setVal] = useState('');
  return (
    <PromptInput onValueChange={setVal} value={val}>
      <PromptInputTextarea placeholder="Type here" />
    </PromptInput>
  );
}

describe('PromptInput controlled behavior', () => {
  it('updates value as user types and calls onValueChange', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlledPrompt />);

    const textarea = screen.getByPlaceholderText(
      'Type here'
    ) as HTMLTextAreaElement;
    await user.type(textarea, 'hello');

    expect(textarea.value).toBe('hello');
  });
});
