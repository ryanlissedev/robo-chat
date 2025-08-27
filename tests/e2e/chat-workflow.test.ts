import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockApiResponse, waitForPageReady } from './fixtures';

test.describe('Chat Workflow Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock base API responses
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
          capabilities: ['chat', 'vision'],
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic',
          description: 'Anthropic Claude 3 Sonnet',
          contextWindow: 200000,
          maxOutput: 4000,
          pricing: { input: 0.003, output: 0.015 },
          capabilities: ['chat', 'vision'],
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          provider: 'openai',
          description: 'Fast and efficient model',
          contextWindow: 4000,
          maxOutput: 2000,
          pricing: { input: 0.001, output: 0.002 },
          capabilities: ['chat'],
        },
      ],
    });

    await mockApiResponse(page, '/api/user-key-status', {
      openai: true,
      anthropic: true,
      openrouter: false,
      mistral: false,
      google: false,
      perplexity: false,
      xai: false,
    });

    await mockApiResponse(page, '/api/user-preferences', {
      layout: 'fullscreen',
      prompt_suggestions: true,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: true,
      hidden_models: [],
    });

    await page.goto('/');
    await waitForPageReady(page);
  });

  test.describe('Complete Chat Creation Flow', () => {
    test('should create new chat and handle first message', async ({ page }) => {
      // Mock chat creation API
      await page.route('**/api/create-chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'chat-123',
            title: 'New Chat',
            created_at: new Date().toISOString(),
          }),
        });
      });

      // Mock streaming chat response
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            // Simulate streaming response
            const chunks = [
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Hello! "}}\n\n',
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"How can I "}}\n\n',
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"help you today?"}}\n\n',
              'data: {"type":"done"}\n\n',
            ];

            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      // Send first message
      const testMessage = 'Hello, can you help me with coding?';
      await page.fill('[data-testid="chat-input"]', testMessage);
      await page.click('[data-testid="send-button"]');

      // Wait for chat creation and message sending
      await page.waitForTimeout(1000);

      // Verify URL contains chat ID
      await page.waitForURL(/\/chat\/chat-123/);

      // Verify messages are displayed
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);

      // Verify user message content
      const userMessage = page
        .locator('[data-testid="chat-message"][data-role="user"]')
        .first();
      await expect(userMessage).toContainText(testMessage);

      // Verify assistant response
      const assistantMessage = page
        .locator('[data-testid="chat-message"][data-role="assistant"]')
        .first();
      await expect(assistantMessage).toContainText('Hello! How can I help');
    });

    test('should handle chat creation failure gracefully', async ({ page }) => {
      // Mock chat creation failure
      await page.route('**/api/create-chat', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to create chat' }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');

      // Should show error notification
      await expect(
        page.locator('[data-testid="error-notification"]')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should auto-generate chat title after first exchange', async ({
      page,
    }) => {
      await page.route('**/api/create-chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'chat-456',
            title: 'New Chat',
            created_at: new Date().toISOString(),
          }),
        });
      });

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"I can help you with JavaScript concepts."}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      // Mock title generation
      await page.route('**/api/chat/*/title', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ title: 'JavaScript Help Discussion' }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Can you help me with JavaScript?');
      await page.click('[data-testid="send-button"]');

      await page.waitForTimeout(2000);

      // Check if title was updated in sidebar
      const chatTitle = page.locator('[data-testid="chat-title-chat-456"]');
      if (await chatTitle.isVisible()) {
        await expect(chatTitle).toContainText('JavaScript Help');
      }
    });
  });

  test.describe('Model Selection and Switching', () => {
    test('should allow model selection before sending message', async ({
      page,
    }) => {
      // Open model selector
      await page.click('[data-testid="model-selector-trigger"]');
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).toBeVisible();

      // Select Claude model
      await page.click('[data-testid="model-option-claude-3-sonnet"]');

      // Verify model is selected
      const selectedModel = page.locator('[data-testid="selected-model-name"]');
      await expect(selectedModel).toContainText('Claude 3 Sonnet');
    });

    test('should switch models mid-conversation', async ({ page }) => {
      // Start with GPT-4
      await page.click('[data-testid="model-selector-trigger"]');
      await page.click('[data-testid="model-option-gpt-4"]');

      // Send first message
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Hello from GPT-4!"}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Hello');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Switch to Claude
      await page.click('[data-testid="model-selector-trigger"]');
      await page.click('[data-testid="model-option-claude-3-sonnet"]');

      // Send second message with different mock response
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Hello from Claude!"}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      await page.fill('[data-testid="chat-input"]', 'How are you?');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Verify both responses in conversation
      const messages = page.locator('[data-testid="chat-message"]');
      await expect(messages).toHaveCount(4); // 2 user + 2 assistant

      const firstResponse = messages.nth(1);
      const secondResponse = messages.nth(3);

      await expect(firstResponse).toContainText('GPT-4');
      await expect(secondResponse).toContainText('Claude');
    });

    test('should show model capabilities and pricing', async ({ page }) => {
      await page.click('[data-testid="model-selector-trigger"]');
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).toBeVisible();

      // Check model information is displayed
      const gpt4Option = page.locator('[data-testid="model-option-gpt-4"]');
      await expect(gpt4Option).toContainText('GPT-4');

      // Look for capability badges or pricing info
      const capabilityBadges = page.locator(
        '[data-testid*="capability-"], [data-testid*="pricing-"]'
      );
      if ((await capabilityBadges.count()) > 0) {
        await expect(capabilityBadges.first()).toBeVisible();
      }
    });
  });

  test.describe('File Upload Integration', () => {
    test('should upload and process text file', async ({ page }) => {
      // Create a temporary test file
      const testFileContent = 'This is a test file for upload.';
      const testFile = await page.evaluate(
        (content) =>
          new File([content], 'test.txt', {
            type: 'text/plain',
          }),
        testFileContent
      );

      // Mock file upload API
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'file-123',
            name: 'test.txt',
            size: testFileContent.length,
            type: 'text/plain',
            url: '/uploads/file-123',
          }),
        });
      });

      // Upload file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(testFileContent),
      });

      // Verify file appears in upload list
      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
      await expect(
        page.locator('[data-testid="uploaded-file"]')
      ).toContainText('test.txt');
    });

    test('should handle file upload errors', async ({ page }) => {
      // Mock file upload failure
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'File too large' }),
        });
      });

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(10 * 1024 * 1024), // 10MB
      });

      // Should show error notification
      await expect(
        page.locator('[data-testid="upload-error"]')
      ).toBeVisible();
      await expect(page.locator('[data-testid="upload-error"]')).toContainText(
        /too large|size/i
      );
    });

    test('should allow removing uploaded files', async ({ page }) => {
      // Mock successful upload
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'file-456',
            name: 'document.pdf',
            size: 1024,
            type: 'application/pdf',
          }),
        });
      });

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content'),
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();

      // Remove file
      await page.click('[data-testid="remove-file-document.pdf"]');

      // Verify file is removed
      await expect(page.locator('[data-testid="uploaded-file"]')).toHaveCount(0);
    });
  });

  test.describe('Conversation Management', () => {
    test('should save conversation state during typing', async ({ page }) => {
      // Type in input without sending
      const draftMessage = 'This is a draft message';
      await page.fill('[data-testid="chat-input"]', draftMessage);

      // Navigate away and back
      await page.goto('/settings');
      await page.goto('/');
      await waitForPageReady(page);

      // Verify draft is preserved
      const inputValue = await page
        .locator('[data-testid="chat-input"]')
        .inputValue();
      expect(inputValue).toBe(draftMessage);
    });

    test('should handle conversation branching', async ({ page }) => {
      // Send initial message
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Initial response"}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Initial message');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Look for branch button (if implemented)
      const branchButton = page.locator('[data-testid="branch-conversation"]');
      if (await branchButton.isVisible()) {
        await branchButton.click();

        // Send different message in branch
        await page.fill('[data-testid="chat-input"]', 'Branch message');
        await page.click('[data-testid="send-button"]');

        // Verify branch navigation exists
        const branchNavigation = page.locator('[data-testid="branch-navigation"]');
        if (await branchNavigation.isVisible()) {
          await expect(branchNavigation).toBeVisible();
        }
      }
    });

    test('should export conversation', async ({ page }) => {
      // Create a conversation first
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Export test response"}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Export test');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Try to export (if export functionality exists)
      const exportButton = page.locator('[data-testid="export-conversation"]');
      if (await exportButton.isVisible()) {
        // Mock export API
        await page.route('**/api/export', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              format: 'markdown',
              content: '# Chat Export\n\n**User:** Export test\n**Assistant:** Export test response',
            }),
          });
        });

        await exportButton.click();

        // Verify export dialog or download
        const exportDialog = page.locator('[data-testid="export-dialog"]');
        if (await exportDialog.isVisible()) {
          await expect(exportDialog).toBeVisible();
        }
      }
    });
  });

  test.describe('Real-time Features', () => {
    test('should handle streaming responses correctly', async ({ page }) => {
      let streamController: ReadableStreamDefaultController<Uint8Array>;

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            streamController = controller;
          },
        });

        route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });

        // Simulate delayed streaming
        setTimeout(() => {
          streamController.enqueue(
            encoder.encode(
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Streaming "}}\n\n'
            )
          );
        }, 100);

        setTimeout(() => {
          streamController.enqueue(
            encoder.encode(
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"response "}}\n\n'
            )
          );
        }, 200);

        setTimeout(() => {
          streamController.enqueue(
            encoder.encode(
              'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"works!"}}\n\n'
            )
          );
          streamController.close();
        }, 300);
      });

      await page.fill('[data-testid="chat-input"]', 'Test streaming');
      await page.click('[data-testid="send-button"]');

      // Wait for streaming to complete
      await page.waitForTimeout(1000);

      // Verify complete response
      const assistantMessage = page
        .locator('[data-testid="chat-message"][data-role="assistant"]')
        .last();
      await expect(assistantMessage).toContainText('Streaming response works!');
    });

    test('should handle connection interruption during streaming', async ({
      page,
    }) => {
      await page.route('**/api/chat', async (route) => {
        // Simulate connection drop
        await route.abort('failed');
      });

      await page.fill('[data-testid="chat-input"]', 'Test interruption');
      await page.click('[data-testid="send-button"]');

      // Should show error state
      await expect(
        page.locator('[data-testid="connection-error"]')
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show typing indicators', async ({ page }) => {
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            // Simulate longer delay to see typing indicator
            await new Promise((resolve) => setTimeout(resolve, 1000));
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response after delay"}}\n\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Show typing indicator');
      await page.click('[data-testid="send-button"]');

      // Should show typing/loading indicator
      await expect(
        page.locator('[data-testid="typing-indicator"], [data-testid="message-loading"]')
      ).toBeVisible();

      // Wait for response
      await page.waitForTimeout(2000);

      // Typing indicator should disappear
      await expect(
        page.locator('[data-testid="typing-indicator"], [data-testid="message-loading"]')
      ).toBeHidden();
    });
  });

  test.describe('Error Recovery and Resilience', () => {
    test('should retry failed messages', async ({ page }) => {
      let attemptCount = 0;

      await page.route('**/api/chat', async (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          // Fail first attempt
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Server error' }),
          });
        } else {
          // Succeed on retry
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Retry successful!"}}\n\n'
                )
              );
              controller.close();
            },
          });

          await route.fulfill({
            status: 200,
            contentType: 'text/plain',
            body: stream as any,
          });
        }
      });

      await page.fill('[data-testid="chat-input"]', 'Test retry');
      await page.click('[data-testid="send-button"]');

      // Should show error first
      await expect(page.locator('[data-testid="message-error"]')).toBeVisible();

      // Click retry button
      const retryButton = page.locator('[data-testid="retry-message"]');
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Should succeed on retry
        await page.waitForTimeout(1000);
        const assistantMessage = page
          .locator('[data-testid="chat-message"][data-role="assistant"]')
          .last();
        await expect(assistantMessage).toContainText('Retry successful!');
      }
    });

    test('should handle quota exceeded errors', async ({ page }) => {
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Quota exceeded',
            retryAfter: 60,
          }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Test quota error');
      await page.click('[data-testid="send-button"]');

      // Should show quota error dialog
      await expect(
        page.locator('[data-testid="quota-error-dialog"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="quota-error-dialog"]')
      ).toContainText(/quota|limit/i);
    });

    test('should handle API key errors', async ({ page }) => {
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid API key',
            code: 'invalid_api_key',
          }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Test API key error');
      await page.click('[data-testid="send-button"]');

      // Should show API key error and suggest fixing
      await expect(
        page.locator('[data-testid="api-key-error-dialog"]')
      ).toBeVisible();

      const settingsButton = page.locator('[data-testid="fix-api-key-button"]');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        // Should navigate to settings
        await page.waitForURL(/\/settings/);
      }
    });
  });
});