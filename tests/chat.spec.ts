import { test, expect } from '@playwright/test';
import { ChatPage } from './pages/chat-page';

test.describe('RoboRail Assistant Chat Interface', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.goto();
  });

  test.describe('Basic Chat Functionality', () => {
    test('should load chat interface correctly', async () => {
      await expect(chatPage.page.locator('[data-testid="chat-container"]')).toBeVisible();
      await expect(chatPage.page.locator('[data-testid="message-input"]')).toBeVisible();
      await expect(chatPage.page.locator('[data-testid="send-button"]')).toBeVisible();
    });

    test('should send a user message and receive response', async () => {
      const userMessage = 'What is RoboRail?';
      
      await chatPage.sendUserMessage(userMessage);
      await chatPage.waitForMessageToAppear('user', userMessage);
      
      // Wait for assistant response
      await chatPage.isGenerationComplete();
      const assistantMessage = await chatPage.getRecentAssistantMessage();
      
      expect(assistantMessage.content).toContain('RoboRail');
      expect(assistantMessage.content.length).toBeGreaterThan(10);
    });

    test('should handle multiple message exchange', async () => {
      // First message
      await chatPage.sendUserMessage('Hello');
      await chatPage.isGenerationComplete();
      
      // Second message
      await chatPage.sendUserMessage('What are the RoboRail specifications?');
      await chatPage.isGenerationComplete();
      
      const messages = await chatPage.getAllMessages();
      expect(messages).toHaveLength(4); // 2 user + 2 assistant
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    test('should show loading indicator during generation', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');
      const loadingIndicator = page.locator('[data-testid="loading-indicator"]');

      await messageInput.fill('Tell me about plasma cutting troubleshooting');
      await sendButton.click();

      // Loading indicator should appear
      await expect(loadingIndicator).toBeVisible();
      
      // Wait for completion
      await chatPage.isGenerationComplete();
      
      // Loading indicator should disappear
      await expect(loadingIndicator).not.toBeVisible();
    });

    test('should be able to stop generation', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');
      const stopButton = page.locator('[data-testid="stop-button"]');

      await messageInput.fill('Long response test');
      await sendButton.click();

      // Wait for stop button to appear and click it
      await expect(stopButton).toBeVisible();
      await stopButton.click();

      // Stop button should disappear
      await expect(stopButton).not.toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should send message with Enter key', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      
      await messageInput.fill('Test message');
      await chatPage.sendWithEnter();
      
      await chatPage.waitForMessageToAppear('user', 'Test message');
    });

    test('should create new line with Shift+Enter', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      
      await messageInput.fill('First line');
      await chatPage.newLineWithShiftEnter();
      await messageInput.type('Second line');
      
      const content = await messageInput.textContent();
      expect(content).toContain('\n');
    });
  });

  test.describe('Error Handling', () => {
    test('should display error message on failure', async ({ page }) => {
      // Mock network failure
      await page.route('/api/chat', route => {
        route.abort('failed');
      });

      await chatPage.sendUserMessage('This should fail');
      
      // Check for error message
      const hasError = await chatPage.hasError();
      expect(hasError).toBe(true);
    });

    test('should show offline status when network is down', async ({ page }) => {
      await chatPage.setNetworkOffline();
      
      const status = await chatPage.getConnectionStatus();
      expect(status.toLowerCase()).toContain('offline');
      
      await chatPage.setNetworkOnline();
    });
  });

  test.describe('Resumable Streams', () => {
    test('should show resume button on connection error', async ({ page }) => {
      // Simulate connection interruption
      await page.route('/api/chat', route => {
        route.abort('connectionreset');
      });

      await chatPage.sendUserMessage('Test resumable stream');
      
      // Resume button should appear
      const resumeButton = page.locator('[data-testid="resume-button"]');
      await expect(resumeButton).toBeVisible();
    });

    test('should resume interrupted conversation', async ({ page }) => {
      const chatId = 'test-resume-chat';
      await chatPage.goto(chatId);
      
      // Mock interrupted stream
      let requestCount = 0;
      await page.route('/api/chat', route => {
        requestCount++;
        if (requestCount === 1) {
          route.abort('connectionreset');
        } else {
          route.continue();
        }
      });

      await chatPage.sendUserMessage('Resume test message');
      
      // Should show resume option
      const resumeButton = page.locator('[data-testid="resume-button"]');
      await expect(resumeButton).toBeVisible();
      
      // Resume the stream
      await chatPage.resumeStream();
      
      // Should complete successfully
      await chatPage.isGenerationComplete();
      const response = await chatPage.getRecentAssistantMessage();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  test.describe('Theme System', () => {
    test('should switch between themes', async () => {
      // Test HGG Professional theme
      await chatPage.selectTheme('hgg-professional');
      const htmlClass = await chatPage.page.locator('html').getAttribute('class');
      expect(htmlClass).toContain('theme-hgg-professional');
      
      // Test Technical Industrial theme
      await chatPage.selectTheme('technical-industrial');
      const htmlClass2 = await chatPage.page.locator('html').getAttribute('class');
      expect(htmlClass2).toContain('theme-technical-industrial');
    });

    test('should toggle dark mode with day/night switch', async ({ page }) => {
      await page.goto('/themes');
      
      const initialDarkMode = await chatPage.isDarkMode();
      await chatPage.toggleDarkMode();
      
      const newDarkMode = await chatPage.isDarkMode();
      expect(newDarkMode).not.toBe(initialDarkMode);
    });

    test('should persist theme selection', async ({ page, context }) => {
      await chatPage.selectTheme('modern-minimalist');
      
      // Create new page in same context
      const newPage = await context.newPage();
      const newChatPage = new ChatPage(newPage);
      await newChatPage.goto();
      
      const htmlClass = await newPage.locator('html').getAttribute('class');
      expect(htmlClass).toContain('theme-modern-minimalist');
      
      await newPage.close();
    });
  });

  test.describe('Accessibility', () => {
    test('should be accessible with keyboard navigation', async ({ page }) => {
      // Tab through interface
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Message input should be focused
      const messageInput = page.locator('[data-testid="message-input"]');
      await expect(messageInput).toBeFocused();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const messageInput = page.locator('[data-testid="message-input"]');
      const sendButton = page.locator('[data-testid="send-button"]');
      
      await expect(messageInput).toHaveAttribute('aria-label');
      await expect(sendButton).toHaveAttribute('aria-label');
    });

    test('should maintain focus management', async ({ page }) => {
      await chatPage.sendUserMessage('Focus test');
      
      // After sending, input should be focused again
      const messageInput = page.locator('[data-testid="message-input"]');
      await expect(messageInput).toBeFocused();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

    test('should work on mobile viewport', async ({ page }) => {
      const chatContainer = page.locator('[data-testid="chat-container"]');
      await expect(chatContainer).toBeVisible();
      
      // Test mobile-specific interactions
      await chatPage.sendUserMessage('Mobile test');
      await chatPage.isGenerationComplete();
      
      const response = await chatPage.getRecentAssistantMessage();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid message sending', async () => {
      const messages = ['First', 'Second', 'Third'];
      
      for (const message of messages) {
        await chatPage.sendUserMessage(message);
        await chatPage.isGenerationComplete();
      }
      
      const allMessages = await chatPage.getAllMessages();
      expect(allMessages.length).toBe(6); // 3 user + 3 assistant
    });

    test('should handle long conversations', async () => {
      // Send 10 messages
      for (let i = 1; i <= 10; i++) {
        await chatPage.sendUserMessage(`Message ${i}`);
        await chatPage.isGenerationComplete();
      }
      
      const messages = await chatPage.getAllMessages();
      expect(messages.length).toBe(20); // 10 user + 10 assistant
    });
  });
});