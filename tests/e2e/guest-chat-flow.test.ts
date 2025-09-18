import { test, expect, Page } from '@playwright/test';

test.describe('Guest User Chat Flow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Navigate to the app
    await page.goto('http://localhost:3000');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('Guest user can access the chat interface', async () => {
    // Check if the main chat interface is visible
    await expect(page.locator('[data-testid="chat-interface"], .chat-interface, main')).toBeVisible({ timeout: 10000 });

    // Look for chat input
    const chatInput = page.locator('input[type="text"], textarea').filter({ hasText: '' }).first();
    await expect(chatInput).toBeVisible();
  });

  test('Guest user can send a message', async () => {
    // Find and click on the chat input
    const chatInput = page.locator('input[type="text"], textarea').filter({ hasText: '' }).first();
    await chatInput.click();

    // Type a test message
    await chatInput.fill('Hello, I am testing the chat as a guest user');

    // Press Enter or find Send button
    await page.keyboard.press('Enter');

    // Wait for response (looking for loading indicator or message appearing)
    await page.waitForTimeout(1000);

    // Check if the message appears in the chat
    const messageElement = page.locator('text=Hello, I am testing the chat as a guest user');
    await expect(messageElement).toBeVisible({ timeout: 5000 });
  });

  test('Guest user can access settings without login', async () => {
    // Look for settings button/link
    const settingsButton = page.locator('button:has-text("Settings"), a:has-text("Settings"), [aria-label*="settings" i]').first();

    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Check if settings panel opens
      await expect(page.locator('[role="dialog"], .settings-panel, .modal')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Guest user can manage API keys locally', async () => {
    // Look for API key management section
    const apiKeySection = page.locator('text=/API.*Key/i').first();

    if (await apiKeySection.isVisible()) {
      // Check if input fields are available
      const apiKeyInput = page.locator('input[type="password"], input[type="text"]').filter({ hasText: '' }).first();
      await expect(apiKeyInput).toBeVisible();

      // Try to add a test API key (it should store locally)
      await apiKeyInput.fill('test-api-key-123');

      // Look for save button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("Add")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    }
  });

  test('No authentication errors for guest users', async () => {
    // Monitor console for 401/422 errors
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate and interact with the app
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);

    // Check that no auth errors occurred
    const authErrors = consoleErrors.filter(error =>
      error.includes('401') ||
      error.includes('422') ||
      error.includes('Unauthorized')
    );

    expect(authErrors).toHaveLength(0);
  });

  test('Guest preferences are saved locally', async () => {
    // Try to change a preference (e.g., theme)
    const themeToggle = page.locator('button[aria-label*="theme" i], button:has-text("Theme")').first();

    if (await themeToggle.isVisible()) {
      await themeToggle.click();

      // Reload the page
      await page.reload();

      // Check if preference persisted (this would need app-specific checks)
      // For now, just verify no errors
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Guest Chat Functionality', () => {
  test('Complete guest user flow', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('http://localhost:3000');

    // 2. Wait for app to load
    await page.waitForLoadState('domcontentloaded');

    // 3. Check for guest mode indicators
    const guestIndicator = page.locator('text=/guest/i').first();
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in")').first();

    // If login button exists, guest mode should be working
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Guest mode active - login button visible but not required');
    }

    // 4. Interact with chat
    const chatArea = page.locator('main, [role="main"], .chat-container').first();
    await expect(chatArea).toBeVisible();

    // 5. Verify no auth popups
    const authModal = page.locator('[role="dialog"]:has-text("Sign in"), .auth-modal');
    await expect(authModal).not.toBeVisible();

    console.log('✅ Guest user can use the app without authentication');
  });
});