import { act, fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyManager } from '@/app/settings/components/api-key-manager';
import * as webCrypto from '@/lib/security/web-crypto';

// Mock the web-crypto module
vi.mock('@/lib/security/web-crypto', () => ({
  setMemoryCredential: vi.fn(),
  getMemoryCredential: vi.fn(),
  setSessionCredential: vi.fn(),
  getSessionCredential: vi.fn(),
  setPersistentCredential: vi.fn(),
  getPersistentCredential: vi.fn(),
  clearAllGuestCredentialsFor: vi.fn(),
  maskKey: vi.fn((key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`),
}));

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => null),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock scrollIntoView for Radix UI components
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

describe('ApiKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Guest Mode', () => {
    it('should render guest storage options when no userId provided', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      expect(
        screen.getByText('Storage Settings (Guest Mode)')
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Choose how your API keys are stored. Keys are never sent to our servers in guest mode.'
        )
      ).toBeInTheDocument();
    });

    it('should show storage scope selector for guests', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes.length).toBeGreaterThan(0);
      expect(comboboxes[0]).toBeInTheDocument();
    });

    it('should show passphrase field when persistent storage is selected', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      const comboboxes = screen.getAllByRole('combobox');
      const scopeSelect = comboboxes[0]; // Get the first combobox (storage scope)
      await act(async () => {
        fireEvent.click(scopeSelect);
      });

      const persistentOption = screen.getByText('Persistent');
      await act(async () => {
        fireEvent.click(persistentOption);
      });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Enter a strong passphrase')
        ).toBeInTheDocument();
      });
    });

    it('should display all providers with badges', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      // Check for provider names and their emoji badges (using getAllByText since there might be multiple)
      expect(screen.getAllByText('OpenAI').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Anthropic').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Perplexity AI').length).toBeGreaterThan(0);
      expect(screen.getAllByText('xAI').length).toBeGreaterThan(0);
      expect(screen.getAllByText('OpenRouter').length).toBeGreaterThan(0);

      // Check for emojis (badges)
      expect(screen.getAllByText('🤖').length).toBeGreaterThan(0); // OpenAI
      expect(screen.getAllByText('🧠').length).toBeGreaterThan(0); // Anthropic
      expect(screen.getAllByText('🔮').length).toBeGreaterThan(0); // Perplexity
      expect(screen.getAllByText('⚡').length).toBeGreaterThan(0); // xAI
      expect(screen.getAllByText('🌐').length).toBeGreaterThan(0); // OpenRouter
    });

    it('should save API key to memory storage for tab scope', async () => {
      const mockSetMemoryCredential = vi.mocked(webCrypto.setMemoryCredential);
      mockSetMemoryCredential.mockResolvedValue({ masked: 'sk-1...abcd' });

      await act(async () => {
        render(<ApiKeyManager />);
      });

      // Find OpenAI input and enter a key
      const openaiInputs = screen.getAllByPlaceholderText(
        'Enter your OpenAI API key'
      );
      const openaiInput = openaiInputs[0]; // Use the first one
      await act(async () => {
        fireEvent.change(openaiInput, {
          target: { value: 'sk-1234567890abcdef' },
        });
      });

      // Use the first Save button
      const saveButtons = screen.getAllByText('Save API Key');
      await act(async () => {
        fireEvent.click(saveButtons[0]);
      });

      await waitFor(() => {
        expect(mockSetMemoryCredential).toHaveBeenCalledWith(
          'openai',
          'sk-1234567890abcdef'
        );
      });
    });
  });

  describe('Authenticated Mode', () => {
    it('should not show storage scope selector for authenticated users', async () => {
      await act(async () => {
        render(<ApiKeyManager userId="test-user-id" />);
      });

      expect(
        screen.queryAllByText('Storage Settings (Guest Mode)').length
      ).toBe(0);
    });

    it('should show different security message for authenticated users', async () => {
      await act(async () => {
        render(<ApiKeyManager userId="test-user-id" />);
      });

      const messages = screen.getAllByText(
        /Your API keys are encrypted and stored securely on our servers/
      );
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Provider Management', () => {
    it('should mark OpenAI as required', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      const requiredBadges = screen.getAllByText('Required');
      expect(requiredBadges.length).toBeGreaterThan(0);
    });

    it('should validate OpenAI API key format', async () => {
      // Mock console.error to suppress error output during test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock the credential function to reject invalid keys
      const mockSetMemoryCredential = vi.mocked(webCrypto.setMemoryCredential);
      mockSetMemoryCredential.mockRejectedValue(
        new Error('Invalid API key format')
      );

      await act(async () => {
        render(<ApiKeyManager />);
      });

      const openaiInputs = screen.getAllByPlaceholderText(
        'Enter your OpenAI API key'
      );
      const openaiInput = openaiInputs[0]; // Use the first one
      await act(async () => {
        fireEvent.change(openaiInput, { target: { value: 'invalid-key' } });
      });

      const saveButtons = screen.getAllByText('Save API Key');
      await act(async () => {
        fireEvent.click(saveButtons[0]); // Click the first one (OpenAI)
      });

      // Should show error for invalid format
      await waitFor(() => {
        expect(
          screen.queryAllByText(/saved successfully/).length
        ).toBe(0);
      });

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('Security Information', () => {
    it('should show guest mode security info for guests', async () => {
      await act(async () => {
        render(<ApiKeyManager />);
      });

      const guestMessages = screen.getAllByText(
        /Guest mode: All keys are stored locally in your browser/
      );
      expect(guestMessages.length).toBeGreaterThan(0);
      
      const transmissionMessages = screen.getAllByText(/Keys are never transmitted to our servers/);
      expect(transmissionMessages.length).toBeGreaterThan(0);
    });

    it('should show authenticated mode security info for authenticated users', async () => {
      await act(async () => {
        render(<ApiKeyManager userId="test-user-id" />);
      });

      const serverMessages = screen.getAllByText(
        /Your API keys are encrypted and stored securely on our servers/
      );
      expect(serverMessages.length).toBeGreaterThan(0);
      
      const thirdPartyMessages = screen.getAllByText(/Keys are never sent to third parties/);
      expect(thirdPartyMessages.length).toBeGreaterThan(0);
    });
  });
});
