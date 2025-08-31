import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MultiChatInput } from '@/components/app/multi-chat/multi-chat-input';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { UserProfile } from '@/lib/user/types';
import { UserProvider } from '@/lib/user-store/provider';
import { renderWithProviders, screen } from '@/tests/test-utils';

// Mock components AFTER imports but before tests
beforeAll(() => {
  vi.mock('@/components/common/multi-model-selector', () => ({
    MultiModelSelector: vi.fn(() => (
      <div data-testid="mock-multi-model-selector" />
    )),
  }));
});

const mockUser: UserProfile = {
  id: '123',
  email: 'test@example.com',
  display_name: 'Test User',
  profile_image: '',
  created_at: new Date().toISOString(),
  daily_message_count: 0,
  daily_reset: new Date().toISOString(),
  message_count: 0,
  premium: false,
  anonymous: false,
  last_active_at: new Date().toISOString(),
  daily_pro_message_count: 0,
  daily_pro_reset: new Date().toISOString(),
  system_prompt: null,
  favorite_models: [],
};

function ControlledMultiChat() {
  const [val, setVal] = useState('');
  const [models, setModels] = useState<string[]>(['m1']);
  return (
    <UserProvider initialUser={mockUser}>
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
    </UserProvider>
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
