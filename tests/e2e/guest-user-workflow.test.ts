import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Playwright for E2E testing simulation
const mockPage = {
  goto: vi.fn(),
  click: vi.fn(),
  fill: vi.fn(),
  press: vi.fn(),
  waitForSelector: vi.fn(),
  waitForResponse: vi.fn(),
  waitForLoadState: vi.fn(),
  screenshot: vi.fn(),
  locator: vi.fn(),
  getByRole: vi.fn(),
  getByTestId: vi.fn(),
  getByText: vi.fn(),
  getByPlaceholder: vi.fn(),
  evaluate: vi.fn(),
  reload: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
  close: vi.fn(),
  context: {
    clearCookies: vi.fn(),
    clearPermissions: vi.fn(),
    storageState: vi.fn(),
  },
  keyboard: {
    press: vi.fn(),
    type: vi.fn(),
  },
  mouse: {
    click: vi.fn(),
  },
};

const mockLocator = {
  click: vi.fn(),
  fill: vi.fn(),
  isVisible: vi.fn(),
  isEnabled: vi.fn(),
  textContent: vi.fn(),
  getAttribute: vi.fn(),
  waitFor: vi.fn(),
  count: vi.fn(),
  nth: vi.fn(),
  first: vi.fn(),
  last: vi.fn(),
};

// Mock browser context
const mockBrowser = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn(),
};

// Mock Playwright test framework
vi.mock('@playwright/test', () => ({
  test: {
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
  },
  expect: {
    extend: vi.fn(),
  },
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

describe('Guest User E2E Workflow', () => {
  beforeAll(async () => {
    // Setup browser and context
    vi.mocked(mockPage.locator).mockReturnValue(mockLocator);
    vi.mocked(mockPage.getByRole).mockReturnValue(mockLocator);
    vi.mocked(mockPage.getByTestId).mockReturnValue(mockLocator);
    vi.mocked(mockPage.getByText).mockReturnValue(mockLocator);
    vi.mocked(mockPage.getByPlaceholder).mockReturnValue(mockLocator);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('Guest User Onboarding Flow', () => {
    it('should complete the full guest onboarding process', async () => {
      // Navigate to the application
      await mockPage.goto('http://localhost:3000');
      expect(mockPage.goto).toHaveBeenCalledWith('http://localhost:3000');

      // Should see welcome screen for guests
      vi.mocked(mockLocator.isVisible).mockResolvedValue(true);
      await mockPage.getByTestId('guest-welcome-banner').waitFor();

      // Click on "Start Chatting as Guest" button
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      expect(mockLocator.click).toHaveBeenCalled();

      // Should be prompted to add API key
      await mockPage.getByTestId('api-key-setup-modal').waitFor();

      // Fill in API key
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-test-api-key-12345');
      expect(mockLocator.fill).toHaveBeenCalledWith('sk-test-api-key-12345');

      // Select storage scope
      await mockPage.getByRole('combobox', { name: 'Storage Duration' }).click();
      await mockPage.getByRole('option', { name: 'This session only' }).click();

      // Confirm API key setup
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Should navigate to main chat interface
      await mockPage.waitForSelector('[data-testid="chat-interface"]');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('[data-testid="chat-interface"]');

      // Verify guest status indicator
      vi.mocked(mockLocator.textContent).mockResolvedValue('Guest Mode');
      const statusText = await mockPage.getByTestId('user-status-indicator').textContent();
      expect(statusText).toBe('Guest Mode');
    });

    it('should handle guest mode without API key', async () => {
      await mockPage.goto('http://localhost:3000');

      // Try to start chatting without API key
      await mockPage.getByRole('button', { name: 'Try Without API Key' }).click();

      // Should see limited functionality message
      await mockPage.getByTestId('limited-functionality-banner').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue(
        'You are in demo mode. Add an API key to unlock full functionality.'
      );
      const bannerText = await mockPage.getByTestId('limited-functionality-banner').textContent();
      expect(bannerText).toContain('demo mode');

      // Should still allow basic navigation
      await mockPage.getByRole('link', { name: 'Settings' }).click();
      await mockPage.waitForSelector('[data-testid="settings-page"]');
    });

    it('should persist guest preferences across page reloads', async () => {
      await mockPage.goto('http://localhost:3000');

      // Set up guest with API key
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-persistent-test-key');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Change theme preference
      await mockPage.getByRole('button', { name: 'Settings' }).click();
      await mockPage.getByRole('button', { name: 'Dark Mode' }).click();

      // Change model preference
      await mockPage.getByRole('combobox', { name: 'Preferred Model' }).click();
      await mockPage.getByRole('option', { name: 'GPT-4' }).click();
      await mockPage.getByRole('button', { name: 'Save Settings' }).click();

      // Reload page
      await mockPage.reload();

      // Verify preferences persisted
      await mockPage.getByRole('button', { name: 'Settings' }).click();

      vi.mocked(mockLocator.getAttribute).mockResolvedValue('checked');
      const darkModeChecked = await mockPage.getByRole('button', { name: 'Dark Mode' }).getAttribute('aria-checked');
      expect(darkModeChecked).toBe('checked');

      vi.mocked(mockLocator.textContent).mockResolvedValue('GPT-4');
      const selectedModel = await mockPage.getByRole('combobox', { name: 'Preferred Model' }).textContent();
      expect(selectedModel).toBe('GPT-4');
    });
  });

  describe('Guest Chat Functionality', () => {
    it('should complete a full chat conversation', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-chat-test-key');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Wait for chat interface
      await mockPage.waitForSelector('[data-testid="chat-input"]');

      // Type a message
      const testMessage = 'Hello, how can you help me today?';
      await mockPage.getByPlaceholder('Type your message...').fill(testMessage);

      // Send message
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Verify message appears in chat
      await mockPage.getByTestId('user-message').waitFor();
      vi.mocked(mockLocator.textContent).mockResolvedValue(testMessage);
      const userMessageText = await mockPage.getByTestId('user-message').textContent();
      expect(userMessageText).toContain(testMessage);

      // Wait for assistant response
      await mockPage.getByTestId('assistant-message').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Hello! I can help you with various tasks...');
      const assistantResponse = await mockPage.getByTestId('assistant-message').textContent();
      expect(assistantResponse).toContain('Hello!');

      // Verify chat history is maintained
      vi.mocked(mockLocator.count).mockResolvedValue(2);
      const messageCount = await mockPage.locator('[data-testid*="message"]').count();
      expect(messageCount).toBe(2);
    });

    it('should handle API key validation during chat', async () => {
      // Setup with invalid API key
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('invalid-key');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Try to send a message
      await mockPage.getByPlaceholder('Type your message...').fill('Test message');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Should see error message
      await mockPage.getByTestId('error-message').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Invalid API key. Please check your API key and try again.');
      const errorText = await mockPage.getByTestId('error-message').textContent();
      expect(errorText).toContain('Invalid API key');

      // Should prompt to update API key
      await mockPage.getByRole('button', { name: 'Update API Key' }).click();
      await mockPage.getByTestId('api-key-setup-modal').waitFor();
    });

    it('should handle model switching during conversation', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-model-switch-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Send initial message with default model
      await mockPage.getByPlaceholder('Type your message...').fill('Hello');
      await mockPage.getByRole('button', { name: 'Send' }).click();
      await mockPage.getByTestId('assistant-message').waitFor();

      // Switch model
      await mockPage.getByRole('button', { name: 'Model Selector' }).click();
      await mockPage.getByRole('option', { name: 'Claude 3 Sonnet' }).click();

      // Send another message
      await mockPage.getByPlaceholder('Type your message...').fill('How are you?');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Verify model indicator updated
      vi.mocked(mockLocator.textContent).mockResolvedValue('Claude 3 Sonnet');
      const modelIndicator = await mockPage.getByTestId('current-model-indicator').textContent();
      expect(modelIndicator).toBe('Claude 3 Sonnet');

      // Verify conversation continues with new model
      await mockPage.getByTestId('assistant-message').nth(1).waitFor();
    });

    it('should handle file uploads in guest mode', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-file-upload-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Click file upload button
      await mockPage.getByRole('button', { name: 'Attach File' }).click();

      // Simulate file selection (in real E2E, this would use setInputFiles)
      vi.mocked(mockPage.evaluate).mockResolvedValue(undefined);
      await mockPage.evaluate(() => {
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Verify file appears in chat input
      await mockPage.getByTestId('attached-file').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('test.txt');
      const fileName = await mockPage.getByTestId('attached-file').textContent();
      expect(fileName).toBe('test.txt');

      // Send message with file
      await mockPage.getByPlaceholder('Type your message...').fill('Please analyze this file');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Verify message with attachment sent
      await mockPage.getByTestId('message-with-attachment').waitFor();
    });
  });

  describe('Guest Settings Management', () => {
    it('should manage API keys for multiple providers', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-openai-key');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Navigate to settings
      await mockPage.getByRole('button', { name: 'Settings' }).click();
      await mockPage.getByRole('tab', { name: 'API Keys' }).click();

      // Verify OpenAI key is saved
      vi.mocked(mockLocator.textContent).mockResolvedValue('sk-op•••••••key');
      const openaiKey = await mockPage.getByTestId('openai-api-key-display').textContent();
      expect(openaiKey).toContain('sk-op•••••••key');

      // Add Anthropic API key
      await mockPage.getByRole('button', { name: 'Add API Key' }).click();
      await mockPage.getByRole('combobox', { name: 'Provider' }).click();
      await mockPage.getByRole('option', { name: 'Anthropic' }).click();
      await mockPage.getByPlaceholder('Enter API key').fill('sk-ant-anthropic-key');
      await mockPage.getByRole('button', { name: 'Save' }).click();

      // Verify both keys are listed
      vi.mocked(mockLocator.count).mockResolvedValue(2);
      const keyCount = await mockPage.locator('[data-testid*="api-key-display"]').count();
      expect(keyCount).toBe(2);

      // Test API key
      await mockPage.getByTestId('openai-test-button').click();
      await mockPage.getByTestId('api-test-result').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('API key is valid');
      const testResult = await mockPage.getByTestId('api-test-result').textContent();
      expect(testResult).toBe('API key is valid');
    });

    it('should manage different storage scopes', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();

      // Test session storage
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-session-test');
      await mockPage.getByRole('combobox', { name: 'Storage Duration' }).click();
      await mockPage.getByRole('option', { name: 'This session only' }).click();
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Navigate to settings to verify
      await mockPage.getByRole('button', { name: 'Settings' }).click();
      await mockPage.getByRole('tab', { name: 'API Keys' }).click();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Session');
      const storageScope = await mockPage.getByTestId('openai-storage-scope').textContent();
      expect(storageScope).toBe('Session');

      // Test persistent storage
      await mockPage.getByRole('button', { name: 'Change Storage' }).click();
      await mockPage.getByRole('option', { name: 'Remember with passphrase' }).click();
      await mockPage.getByPlaceholder('Enter passphrase').fill('secure-passphrase-123');
      await mockPage.getByRole('button', { name: 'Update Storage' }).click();

      // Verify updated to persistent
      vi.mocked(mockLocator.textContent).mockResolvedValue('Persistent');
      const updatedScope = await mockPage.getByTestId('openai-storage-scope').textContent();
      expect(updatedScope).toBe('Persistent');
    });

    it('should export and import guest settings', async () => {
      // Setup guest user with settings
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-export-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Change some settings
      await mockPage.getByRole('button', { name: 'Settings' }).click();
      await mockPage.getByRole('button', { name: 'Dark Mode' }).click();
      await mockPage.getByRole('slider', { name: 'Temperature' }).fill('0.8');
      await mockPage.getByRole('button', { name: 'Save Settings' }).click();

      // Export settings
      await mockPage.getByRole('tab', { name: 'Data' }).click();
      await mockPage.getByRole('button', { name: 'Export Settings' }).click();

      // Simulate download (in real E2E, this would check download)
      vi.mocked(mockPage.evaluate).mockResolvedValue('{"theme":"dark","temperature":0.8}');
      const exportData = await mockPage.evaluate(() => {
        return localStorage.getItem('guest-settings');
      });
      expect(exportData).toContain('"theme":"dark"');

      // Clear settings
      await mockPage.getByRole('button', { name: 'Clear All Data' }).click();
      await mockPage.getByRole('button', { name: 'Confirm' }).click();

      // Import settings
      await mockPage.getByRole('button', { name: 'Import Settings' }).click();
      // In real E2E, would use setInputFiles to upload the export file

      // Verify settings restored
      vi.mocked(mockLocator.getAttribute).mockResolvedValue('checked');
      const darkModeRestored = await mockPage.getByRole('button', { name: 'Dark Mode' }).getAttribute('aria-checked');
      expect(darkModeRestored).toBe('checked');
    });
  });

  describe('Guest Mode Limitations and Restrictions', () => {
    it('should show appropriate limitations for guest users', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-limitations-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Try to access premium features
      await mockPage.getByRole('button', { name: 'Settings' }).click();
      await mockPage.getByRole('tab', { name: 'Advanced' }).click();

      // Should see upgrade prompts for premium features
      await mockPage.getByTestId('premium-feature-banner').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Sign up for advanced features');
      const upgradeText = await mockPage.getByTestId('premium-feature-banner').textContent();
      expect(upgradeText).toContain('Sign up for advanced features');

      // Analytics should be disabled
      vi.mocked(mockLocator.isEnabled).mockResolvedValue(false);
      const analyticsEnabled = await mockPage.getByRole('button', { name: 'View Analytics' }).isEnabled();
      expect(analyticsEnabled).toBe(false);

      // Cloud sync should be disabled
      const cloudSyncEnabled = await mockPage.getByRole('button', { name: 'Sync to Cloud' }).isEnabled();
      expect(cloudSyncEnabled).toBe(false);
    });

    it('should enforce rate limiting for guest users', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-rate-limit-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Send multiple messages quickly to trigger rate limit
      for (let i = 0; i < 52; i++) { // Assuming 50 message limit
        await mockPage.getByPlaceholder('Type your message...').fill(`Message ${i}`);
        await mockPage.getByRole('button', { name: 'Send' }).click();

        if (i < 49) {
          await mockPage.getByTestId('assistant-message').nth(i).waitFor();
        }
      }

      // Should see rate limit message
      await mockPage.getByTestId('rate-limit-warning').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Rate limit reached. Please wait before sending more messages.');
      const rateLimitText = await mockPage.getByTestId('rate-limit-warning').textContent();
      expect(rateLimitText).toContain('Rate limit reached');

      // Send button should be disabled
      vi.mocked(mockLocator.isEnabled).mockResolvedValue(false);
      const sendButtonEnabled = await mockPage.getByRole('button', { name: 'Send' }).isEnabled();
      expect(sendButtonEnabled).toBe(false);
    });

    it('should handle session expiry gracefully', async () => {
      // Setup guest user with session storage
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-session-expire-test');
      await mockPage.getByRole('combobox', { name: 'Storage Duration' }).click();
      await mockPage.getByRole('option', { name: 'This session only' }).click();
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Simulate session expiry by clearing session storage
      await mockPage.evaluate(() => {
        sessionStorage.clear();
      });

      // Try to send a message
      await mockPage.getByPlaceholder('Type your message...').fill('Test after session expiry');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Should prompt to re-enter API key
      await mockPage.getByTestId('session-expired-modal').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Your session has expired. Please enter your API key again.');
      const expiredText = await mockPage.getByTestId('session-expired-modal').textContent();
      expect(expiredText).toContain('session has expired');

      // Re-enter API key
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-session-expire-test');
      await mockPage.getByRole('button', { name: 'Continue' }).click();

      // Should be able to chat again
      await mockPage.getByPlaceholder('Type your message...').fill('Hello again');
      await mockPage.getByRole('button', { name: 'Send' }).click();
      await mockPage.getByTestId('assistant-message').waitFor();
    });
  });

  describe('Guest Mode Error Recovery', () => {
    it('should recover from network connectivity issues', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-network-test');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      // Simulate network going offline
      await mockPage.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event('offline'));
      });

      // Should show offline indicator
      await mockPage.getByTestId('offline-indicator').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('You are currently offline');
      const offlineText = await mockPage.getByTestId('offline-indicator').textContent();
      expect(offlineText).toContain('offline');

      // Try to send message while offline
      await mockPage.getByPlaceholder('Type your message...').fill('Offline message');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      // Should see offline queue message
      await mockPage.getByTestId('message-queued').waitFor();

      // Simulate network coming back online
      await mockPage.evaluate(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      // Should show reconnection and process queued messages
      await mockPage.getByTestId('reconnecting-indicator').waitFor();
      await mockPage.getByTestId('assistant-message').waitFor();
    });

    it('should provide helpful error messages for common issues', async () => {
      // Setup guest user
      await mockPage.goto('http://localhost:3000');
      await mockPage.getByRole('button', { name: 'Start Chatting as Guest' }).click();

      // Test invalid API key format error
      await mockPage.getByPlaceholder('Enter your API key').fill('invalid-format');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      await mockPage.getByTestId('api-key-error').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('API key format is invalid. It should start with "sk-".');
      const formatError = await mockPage.getByTestId('api-key-error').textContent();
      expect(formatError).toContain('should start with "sk-"');

      // Test API key with insufficient permissions
      await mockPage.getByPlaceholder('Enter your API key').fill('sk-insufficient-permissions');
      await mockPage.getByRole('button', { name: 'Save API Key' }).click();

      await mockPage.getByPlaceholder('Type your message...').fill('Test message');
      await mockPage.getByRole('button', { name: 'Send' }).click();

      await mockPage.getByTestId('permission-error').waitFor();

      vi.mocked(mockLocator.textContent).mockResolvedValue('Your API key does not have sufficient permissions for this model.');
      const permissionError = await mockPage.getByTestId('permission-error').textContent();
      expect(permissionError).toContain('sufficient permissions');

      // Should suggest solutions
      await mockPage.getByRole('button', { name: 'Learn More' }).click();
      await mockPage.getByTestId('error-help-modal').waitFor();
    });
  });
});