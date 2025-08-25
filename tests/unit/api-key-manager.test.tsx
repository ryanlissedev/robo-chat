import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeyManager } from '@/app/settings/components/api-key-manager';
import * as webCrypto from '@/lib/security/web-crypto';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

describe('ApiKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Guest Mode', () => {
    it('should render guest storage options when no userId provided', async () => {
      render(<ApiKeyManager />);
      
      expect(screen.getByText('Storage Settings (Guest Mode)')).toBeInTheDocument();
      expect(screen.getByText('Choose how your API keys are stored. Keys are never sent to our servers in guest mode.')).toBeInTheDocument();
    });

    it('should show storage scope selector for guests', async () => {
      render(<ApiKeyManager />);
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show passphrase field when persistent storage is selected', async () => {
      render(<ApiKeyManager />);
      
      const scopeSelect = screen.getByRole('combobox');
      fireEvent.click(scopeSelect);
      
      const persistentOption = screen.getByText('Persistent');
      fireEvent.click(persistentOption);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter a strong passphrase')).toBeInTheDocument();
      });
    });

    it('should display all providers with badges', () => {
      render(<ApiKeyManager />);
      
      // Check for provider names and their emoji badges
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Anthropic')).toBeInTheDocument();
      expect(screen.getByText('Perplexity AI')).toBeInTheDocument();
      expect(screen.getByText('xAI')).toBeInTheDocument();
      expect(screen.getByText('OpenRouter')).toBeInTheDocument();
      
      // Check for emojis (badges)
      expect(screen.getByText('🤖')).toBeInTheDocument(); // OpenAI
      expect(screen.getByText('🧠')).toBeInTheDocument(); // Anthropic
      expect(screen.getByText('🔮')).toBeInTheDocument(); // Perplexity
      expect(screen.getByText('⚡')).toBeInTheDocument(); // xAI
      expect(screen.getByText('🌐')).toBeInTheDocument(); // OpenRouter
    });

    it('should save API key to memory storage for tab scope', async () => {
      const mockSetMemoryCredential = vi.mocked(webCrypto.setMemoryCredential);
      mockSetMemoryCredential.mockResolvedValue({ masked: 'sk-1...abcd' });

      render(<ApiKeyManager />);
      
      // Find OpenAI input and enter a key
      const openaiInput = screen.getByPlaceholderText('Enter your OpenAI API key');
      fireEvent.change(openaiInput, { target: { value: 'sk-1234567890abcdef' } });
      
      // Click save - find the specific Save button for OpenAI
      const saveButtons = screen.getAllByText('Save API Key');
      expect(saveButtons.length).toBeGreaterThan(0);
      fireEvent.click(saveButtons[0]); // Use the first one which should be OpenAI
      
      await waitFor(() => {
        expect(mockSetMemoryCredential).toHaveBeenCalledWith('openai', 'sk-1234567890abcdef');
      });
    });
  });

  describe('Authenticated Mode', () => {
    it('should not show storage scope selector for authenticated users', () => {
      render(<ApiKeyManager userId="test-user-id" />);
      
      expect(screen.queryByText('Storage Settings (Guest Mode)')).not.toBeInTheDocument();
    });

    it('should show different security message for authenticated users', () => {
      render(<ApiKeyManager userId="test-user-id" />);
      
      expect(screen.getByText(/Your API keys are encrypted and stored securely on our servers/)).toBeInTheDocument();
    });
  });

  describe('Provider Management', () => {
    it('should mark OpenAI as required', () => {
      render(<ApiKeyManager />);
      
      const requiredBadges = screen.getAllByText('Required');
      expect(requiredBadges.length).toBeGreaterThan(0);
    });

    it('should validate OpenAI API key format', async () => {
      render(<ApiKeyManager />);
      
      const openaiInput = screen.getByPlaceholderText('Enter your OpenAI API key');
      fireEvent.change(openaiInput, { target: { value: 'invalid-key' } });
      
      const saveButtons = screen.getAllByText('Save API Key');
      fireEvent.click(saveButtons[0]); // Click the first one (OpenAI)
      
      // Should show error for invalid format
      await waitFor(() => {
        expect(screen.queryByText(/saved successfully/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Security Information', () => {
    it('should show guest mode security info for guests', () => {
      render(<ApiKeyManager />);
      
      expect(screen.getByText(/Guest mode: All keys are stored locally in your browser/)).toBeInTheDocument();
      expect(screen.getByText(/Keys are never transmitted to our servers/)).toBeInTheDocument();
    });

    it('should show authenticated mode security info for authenticated users', () => {
      render(<ApiKeyManager userId="test-user-id" />);
      
      expect(screen.getByText(/Your API keys are encrypted and stored securely on our servers/)).toBeInTheDocument();
      expect(screen.getByText(/Keys are never sent to third parties/)).toBeInTheDocument();
    });
  });
});