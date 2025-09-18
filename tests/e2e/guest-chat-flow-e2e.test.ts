import { expect, test } from '@playwright/test';

/**
 * E2E Test for Guest User Chat Flow
 * Tests the complete guest user experience from initial access to chat functionality
 */
test.describe('Guest User Chat Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing cookies/state to simulate a new guest user
    await page.context().clearCookies();
    await page.context().clearPermissions();

    // Set up console error monitoring
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Make console errors available to tests
    page.addInitScript(() => {
      (window as any).testConsoleErrors = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        (window as any).testConsoleErrors.push(args.join(' '));
        originalConsoleError.apply(console, args);
      };
    });
  });

  test('should allow guest users to access and use chat without authentication errors', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify no authentication errors in console
    const consoleErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);
    const authErrors = consoleErrors.filter((error: string) =>
      error.includes('Failed to get user ID') ||
      error.includes('Unauthorized') ||
      error.includes('authentication')
    );

    expect(authErrors.length).toBe(0);

    // Verify chat input is available (no auth barriers)
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible();

    // Verify guest welcome message or no auth prompts
    const authPrompts = page.locator('[data-testid*="auth"], [data-testid*="login"], [data-testid*="sign-in"]');
    await expect(authPrompts).toHaveCount(0);

    // Test sending a message as guest
    await chatInput.fill('Hello, I am a guest user testing the chat functionality.');

    const sendButton = page.locator('[data-testid="send-button"]');
    await expect(sendButton).toBeEnabled();

    await sendButton.click();

    // Wait for response or loading state
    await page.waitForTimeout(2000); // Allow time for processing

    // Verify no errors occurred during message sending
    const postSendErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);
    const newAuthErrors = postSendErrors.filter((error: string) =>
      error.includes('Failed to get user ID') ||
      error.includes('Unauthorized') ||
      error.includes('authentication')
    );

    expect(newAuthErrors.length).toBe(0);

    // Verify the message was sent (check for user message in chat)
    const userMessages = page.locator('[data-testid*="message-user"]');
    await expect(userMessages).toHaveCount(1);

    // Verify the message content is correct
    const messageContent = userMessages.locator('[data-testid*="message-content"]');
    await expect(messageContent).toContainText('Hello, I am a guest user');
  });

  test('should handle guest user preferences correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Check if user preferences are accessible (should not require auth)
    const settingsButton = page.locator('[data-testid*="settings"], [aria-label*="settings"]').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Look for favorite models selector (should be accessible to guests)
      const modelSelector = page.locator('[data-testid*="model-selector"], [data-testid*="favorite-models"]');
      if (await modelSelector.isVisible()) {
        // Guest should be able to interact with preferences
        await expect(modelSelector).toBeEnabled();
      }
    }

    // Verify no preference-related auth errors
    const consoleErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);
    const preferenceErrors = consoleErrors.filter((error: string) =>
      error.includes('favorite-models') && error.includes('401')
    );

    expect(preferenceErrors.length).toBe(0);
  });

  test('should persist guest user state across page reloads', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Send a message as guest
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('Testing guest persistence');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for message to appear
    await page.waitForSelector('[data-testid*="message-user"]');
    const initialMessageCount = await page.locator('[data-testid*="message-user"]').count();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the message is still there (guest state persisted)
    const reloadedMessageCount = await page.locator('[data-testid*="message-user"]').count();
    expect(reloadedMessageCount).toBe(initialMessageCount);

    // Verify no auth errors on reload
    const consoleErrors = await page.evaluate(() => (window as any).testConsoleErrors || []);
    const reloadAuthErrors = consoleErrors.filter((error: string) =>
      error.includes('Failed to get user ID')
    );

    expect(reloadAuthErrors.length).toBe(0);
  });

  test('should handle network failures gracefully for guest users', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Simulate network issues by blocking API calls
    await page.route('**/api/**', route => route.abort());

    // Try to send a message
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('Testing offline functionality');

    const sendButton = page.locator('[data-testid="send-button"]');

    // Button should still be clickable (no auth blocking offline functionality)
    await expect(sendButton).toBeEnabled();

    // Verify graceful error handling (no crashes)
    await sendButton.click();

    // Wait for error handling
    await page.waitForTimeout(2000);

    // Verify app doesn't crash and shows appropriate error message
    const errorMessages = page.locator('[data-testid*="error"], [data-testid*="toast"]').filter({ hasText: /error|failed/i });
    if (await errorMessages.count() > 0) {
      // Should show user-friendly error, not auth error
      await expect(errorMessages.first()).not.toContainText('Failed to get user ID');
      await expect(errorMessages.first()).not.toContainText('Unauthorized');
    }
  });
});
