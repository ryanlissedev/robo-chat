import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils';

// Mock streamdown early to avoid importing katex CSS in tests
vi.mock('streamdown', () => ({
  Streamdown: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

import { MessageAssistant } from '@/components/app/chat/message-assistant';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock user preferences provider used by MessageAssistant
vi.mock('@/lib/user-preference-store/provider', () => ({
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useUserPreferences: () => ({
    preferences: {
      showToolInvocations: true,
      multiModelEnabled: false,
    },
  }),
}));

// Basic stub for crypto.randomUUID if needed by components
if (!(global as any).crypto) {
  (global as any).crypto = { randomUUID: () => 'uuid' } as any;
}

describe('Reasoning summary rendering', () => {
  it('renders reasoning section while streaming (auto-open)', async () => {
    renderWithProviders(
      <TooltipProvider>
        <MessageAssistant
          messageId="m1"
          parts={[{ type: 'reasoning', text: 'Reasoning summary text' }] as any}
          status="streaming"
        >
          Assistant response
        </MessageAssistant>
      </TooltipProvider>
    );

    // Trigger should show Thinking... while streaming
    const streamingTrigger = await screen.findByRole('button', {
      name: /Thinking\.\.\./i,
    });
    expect(streamingTrigger).toBeInTheDocument();

    // Content should be visible because Reasoning auto-opens during streaming
    expect(screen.getByText('Reasoning summary text')).toBeInTheDocument();
  });

  it('renders reasoning section when not streaming and can be toggled open', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <TooltipProvider>
        <MessageAssistant
          messageId="m2"
          parts={
            [
              { type: 'reasoning', text: 'Post-stream reasoning details' },
            ] as any
          }
          status="ready"
        >
          Assistant final response
        </MessageAssistant>
      </TooltipProvider>
    );

    // Trigger is present; when duration is 0 it still shows "Thinking..."
    const trigger = await screen.findByRole('button', {
      name: /Thinking\.\.\./i,
    });
    expect(trigger).toBeInTheDocument();

    // Initially content may be collapsed; click to open
    await user.click(trigger);

    expect(
      await screen.findByText('Post-stream reasoning details')
    ).toBeInTheDocument();
  });
});
