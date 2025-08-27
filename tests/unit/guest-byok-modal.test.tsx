import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestKeyModal } from '@/components/common/credentials/GuestKeyModal';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/lib/security/web-crypto', () => ({
  setMemoryCredential: vi.fn().mockResolvedValue({ masked: 'sk-…abcd' }),
  setSessionCredential: vi.fn().mockResolvedValue({ masked: 'sk-…abcd' }),
  setPersistentCredential: vi.fn().mockResolvedValue({ masked: 'sk-…abcd' }),
  maskKey: vi.fn((k: string) => `masked(${k.slice(-4)})`),
}));

vi.mock('@/lib/providers', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', icon: () => null },
    { id: 'anthropic', name: 'Anthropic', icon: () => null },
  ],
}));

describe('GuestKeyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and handles user interaction', async () => {
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <TooltipProvider>
        <GuestKeyModal
          open
          onOpenChange={onOpenChange}
          onSaved={onSaved}
          defaultProviderId="openai"
        />
      </TooltipProvider>
    );

    // Verify the modal is open and displays correctly
    expect(screen.getByText('Provide Provider API Key')).toBeInTheDocument();
    expect(screen.getByText('Session (encrypted)')).toBeInTheDocument();

    const keyInput = screen.getByPlaceholderText('Enter your provider API key');
    expect(keyInput).toBeInTheDocument();

    // Verify we can type in the input
    fireEvent.change(keyInput, { target: { value: 'sk-test-1234' } });
    expect(keyInput).toHaveValue('sk-test-1234');

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeInTheDocument();

    // Verify cancel button works
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
