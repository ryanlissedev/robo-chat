import { expect, test } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main chat page - use port 3001 if 3000 is busy
    const port = process.env.PORT || '3001';
    await page.goto(`http://localhost:${port}`);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display onboarding message', async ({ page }) => {
    // Check for the onboarding heading
    const heading = page.locator('h1:has-text("How can we help you today")');
    await expect(heading).toBeVisible();
  });

  test('should have functional chat input', async ({ page }) => {
    // Find the chat input textarea
    const chatInput = page.locator('textarea[placeholder*="How can we help"]');
    await expect(chatInput).toBeVisible();

    // Type a message
    await chatInput.fill('Test message');
    await expect(chatInput).toHaveValue('Test message');

    // Clear the input
    await chatInput.clear();
    await expect(chatInput).toHaveValue('');
  });

  test('should send a message and receive response', async ({ page }) => {
    // Type a message
    const chatInput = page.locator('textarea[placeholder*="How can we help"]');
    await chatInput.fill('Hello, can you help me?');

    // Send the message (either by clicking send button or pressing Enter)
    await page.keyboard.press('Enter');

    // Wait for the user message to appear
    await expect(page.locator('text=Hello, can you help me?')).toBeVisible({
      timeout: 5000,
    });

    // Wait for assistant response (or loader)
    // The assistant response should appear or at least show a loading state
    const assistantResponse = page.locator(
      '[role="status"], .assistant-message, [data-role="assistant"]'
    );
    await expect(assistantResponse.first()).toBeVisible({ timeout: 10000 });

    // Verify input was cleared after sending
    await expect(chatInput).toHaveValue('');
  });

  test('should not show verbosity controls', async ({ page }) => {
    // Verbosity controls should be removed from the UI
    const verbositySelector = page.locator(
      '[aria-label*="verbosity"], [data-testid*="verbosity"]'
    );
    await expect(verbositySelector).not.toBeVisible();

    // Reasoning summary controls should also be removed
    const summarySelector = page.locator(
      '[aria-label*="summary"], [data-testid*="reasoning-summary"]'
    );
    await expect(summarySelector).not.toBeVisible();
  });

  test('should handle model selection', async ({ page }) => {
    // Look for model selector
    const modelSelector = page
      .locator(
        'button:has-text("GPT"), button:has-text("Claude"), [role="combobox"]'
      )
      .first();

    if (await modelSelector.isVisible()) {
      await modelSelector.click();

      // Should show model options
      const modelOption = page
        .locator('[role="option"], [role="menuitem"]')
        .first();
      await expect(modelOption).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle file uploads', async ({ page }) => {
    // Look for file upload button
    const fileUploadButton = page.locator(
      'button[aria-label*="file"], button[aria-label*="upload"], button:has(svg[class*="paperclip"])'
    );

    if (await fileUploadButton.isVisible()) {
      // File upload functionality should be present
      await expect(fileUploadButton).toBeEnabled();
    }
  });

  test('should display messages correctly with AI SDK v5 format', async ({
    page,
  }) => {
    // Mock a response to test message display
    await page.route('**/api/chat', async (route) => {
      // Simulate AI SDK v5 response format
      const response = {
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: [
              { type: 'text', text: 'I can definitely help you with that!' },
            ],
          },
        ],
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Send a message
    const chatInput = page.locator('textarea[placeholder*="How can we help"]');
    await chatInput.fill('Help me with coding');
    await page.keyboard.press('Enter');

    // Should display the assistant response
    await expect(
      page.locator('text=I can definitely help you with that!')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty responses gracefully', async ({ page }) => {
    // Mock an empty response
    await page.route('**/api/chat', async (route) => {
      const response = {
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: [],
          },
        ],
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    // Send a message
    const chatInput = page.locator('textarea[placeholder*="How can we help"]');
    await chatInput.fill('Test empty response');
    await page.keyboard.press('Enter');

    // Should handle empty response without crashing
    await page.waitForTimeout(2000);

    // Page should still be functional
    await expect(chatInput).toBeEnabled();
  });

  test('should maintain chat history', async ({ page }) => {
    // Send first message
    const chatInput = page.locator('textarea[placeholder*="How can we help"]');
    await chatInput.fill('First message');
    await page.keyboard.press('Enter');

    // Wait for message to appear
    await expect(page.locator('text=First message')).toBeVisible({
      timeout: 5000,
    });

    // Send second message
    await chatInput.fill('Second message');
    await page.keyboard.press('Enter');

    // Both messages should be visible
    await expect(page.locator('text=First message')).toBeVisible();
    await expect(page.locator('text=Second message')).toBeVisible({
      timeout: 5000,
    });
  });
});
