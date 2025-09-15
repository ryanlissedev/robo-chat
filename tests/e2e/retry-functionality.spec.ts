import { expect, mockApiResponse, test, waitForPageReady } from './fixtures';

test.describe('Retry Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock standard API responses
    await mockApiResponse(page, '/api/models', {
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'Latest GPT-4 model',
          contextWindow: 8000,
          maxOutput: 4000,
          pricing: { input: 0.03, output: 0.06 },
          capabilities: ['chat'],
        },
      ],
    });

    await mockApiResponse(page, '/api/user-key-status', {
      openai: true,
      anthropic: false,
      openrouter: false,
      mistral: false,
      google: false,
      perplexity: false,
      xai: false,
    });

    await mockApiResponse(page, '/api/user-preferences/favorite-models', {
      favorite_models: ['gpt-4'],
    });

    await mockApiResponse(page, '/api/user-preferences', {
      layout: 'fullscreen',
      prompt_suggestions: true,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: false,
      hidden_models: [],
    });

    await page.goto('/');
    await waitForPageReady(page);
  });

  test('should show retry button when message fails', async ({ page }) => {
    // Mock a failed API response
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Failed to process request'
        }),
      });
    });

    // Send a message
    await page.fill('[data-testid="chat-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    // Wait for error state to appear
    await page.waitForTimeout(2000);

    // Check for error indicators (multiple possible selectors)
    const errorSelectors = [
      '[data-testid="message-error"]',
      '[data-testid="error-message"]',
      '[data-testid="network-error"]',
      '.error-message',
      '[role="alert"]'
    ];

    let errorFound = false;
    for (const selector of errorSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        errorFound = true;
        break;
      }
    }

    expect(errorFound).toBeTruthy();
  });

  test('should successfully retry failed message', async ({ page }) => {
    let attemptCount = 0;

    // Mock responses - fail first, succeed on retry
    await page.route('**/api/chat', async (route) => {
      attemptCount++;

      if (attemptCount === 1) {
        // First attempt fails
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Server error',
            message: 'Temporary failure'
          }),
        });
      } else {
        // Retry succeeds with streaming response
        const encoder = new TextEncoder();
        const chunks = [
          'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Hello! "}}\n\n',
          'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Your message "}}\n\n',
          'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"was successfully "}}\n\n',
          'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"processed!"}}\n\n',
        ];

        const stream = new ReadableStream({
          async start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: stream as any,
        });
      }
    });

    // Send initial message
    await page.fill('[data-testid="chat-input"]', 'Test retry functionality');
    await page.click('[data-testid="send-button"]');

    // Wait for error to appear
    await page.waitForTimeout(2000);

    // Look for retry action (could be in toast, message actions, or error display)
    const retrySelectors = [
      '[data-testid="retry-message"]',
      '[data-testid="retry-button"]',
      'button:has-text("Retry")',
      'button:has-text("Try again")',
      '[aria-label="Retry"]'
    ];

    let retryClicked = false;
    for (const selector of retrySelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        await element.click();
        retryClicked = true;
        break;
      }
    }

    if (!retryClicked) {
      // If no retry button found, try reloading the message via keyboard or other means
      await page.keyboard.press('r'); // Some apps use keyboard shortcuts
    }

    // Wait for successful response
    await page.waitForTimeout(3000);

    // Verify success message appears
    const successMessage = page.locator('[data-testid="chat-message"][data-role="assistant"]').last();
    await expect(successMessage).toBeVisible();

    // Check if message contains expected text
    const messageText = await successMessage.textContent();
    expect(messageText).toContain('processed');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/chat', async (route) => {
      await route.abort('failed');
    });

    await page.fill('[data-testid="chat-input"]', 'Network test');
    await page.click('[data-testid="send-button"]');

    // Should show network error indication
    await page.waitForTimeout(2000);

    const networkErrorSelectors = [
      '[data-testid="network-error"]',
      '[data-testid="error-message"]',
      'text=/network|connection|offline/i'
    ];

    let networkErrorFound = false;
    for (const selector of networkErrorSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        networkErrorFound = true;
        break;
      }
    }

    expect(networkErrorFound).toBeTruthy();
  });

  test('should handle rate limit errors with retry after', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 429,
        headers: {
          'Retry-After': '60',
        },
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: 60,
          message: 'Too many requests. Please wait 60 seconds.'
        }),
      });
    });

    await page.fill('[data-testid="chat-input"]', 'Rate limit test');
    await page.click('[data-testid="send-button"]');

    // Should show rate limit error
    await page.waitForTimeout(2000);

    const rateLimitSelectors = [
      '[data-testid="quota-error-dialog"]',
      '[data-testid="rate-limit-error"]',
      'text=/rate limit|quota|too many/i'
    ];

    let rateLimitFound = false;
    for (const selector of rateLimitSelectors) {
      if (await page.locator(selector).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        rateLimitFound = true;
        break;
      }
    }

    expect(rateLimitFound).toBeTruthy();
  });

  test('should preserve user message after error', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/chat', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    const testMessage = 'This message should be preserved';
    await page.fill('[data-testid="chat-input"]', testMessage);
    await page.click('[data-testid="send-button"]');

    // Wait for error
    await page.waitForTimeout(2000);

    // User message should still be visible
    const userMessage = page.locator('[data-testid="chat-message"][data-role="user"]').last();
    await expect(userMessage).toBeVisible();
    await expect(userMessage).toContainText(testMessage);
  });

  test('should handle partial stream failures', async ({ page }) => {
    await page.route('**/api/chat', async (route) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send partial data then error
          controller.enqueue(
            encoder.encode(
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Partial resp"}}\n\n'
            )
          );
          // Simulate stream error
          controller.error(new Error('Stream interrupted'));
        },
      });

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: stream as any,
      });
    });

    await page.fill('[data-testid="chat-input"]', 'Stream failure test');
    await page.click('[data-testid="send-button"]');

    // Should show partial message and error indication
    await page.waitForTimeout(3000);

    // Check if partial message was rendered
    const assistantMessage = page.locator('[data-testid="chat-message"][data-role="assistant"]').last();
    const messageContent = await assistantMessage.textContent().catch(() => '');

    // Should have received at least partial content or show error
    const hasContent = messageContent.includes('Partial');
    const hasError = await page.locator('[data-testid="message-error"], [data-testid="error-message"]')
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    expect(hasContent || hasError).toBeTruthy();
  });
});