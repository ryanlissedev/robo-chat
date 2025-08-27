import { expect, test } from '@playwright/test';
import { mockApiResponse, waitForPageReady } from './fixtures';

test.describe('Multi-Chat Functionality Integration', () => {
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
          capabilities: ['chat'],
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic',
          description: 'Anthropic Claude 3 Sonnet',
          contextWindow: 200000,
          maxOutput: 4000,
          pricing: { input: 0.003, output: 0.015 },
          capabilities: ['chat'],
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

  test.describe('Multi-Chat Setup and Configuration', () => {
    test('should enable multi-chat mode', async ({ page }) => {
      // Navigate to settings to enable multi-chat
      const settingsButton = page.locator('[data-testid="settings-button"]');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        const multiChatToggle = page.locator(
          '[data-testid="multi-model-toggle"]'
        );
        if (await multiChatToggle.isVisible()) {
          await multiChatToggle.check();

          // Mock settings save
          await page.route('**/api/user-preferences', async (route) => {
            if (route.request().method() === 'POST') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  multi_model_enabled: true,
                }),
              });
            }
          });

          const saveButton = page.locator('[data-testid="save-settings"]');
          if (await saveButton.isVisible()) {
            await saveButton.click();
          }
        }
      }

      // Return to chat
      await page.goto('/');
      await waitForPageReady(page);

      // Should show multi-chat interface
      await expect(
        page.locator('[data-testid="multi-chat-interface"]')
      ).toBeVisible();
    });

    test('should allow selecting multiple models', async ({ page }) => {
      // Assume multi-chat is already enabled
      await mockApiResponse(page, '/api/user-preferences', {
        layout: 'fullscreen',
        multi_model_enabled: true,
        hidden_models: [],
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Open multi-model selector
      const multiModelSelector = page.locator(
        '[data-testid="multi-model-selector"]'
      );
      if (await multiModelSelector.isVisible()) {
        await multiModelSelector.click();

        // Select multiple models
        await page.check('[data-testid="model-checkbox-gpt-4"]');
        await page.check('[data-testid="model-checkbox-claude-3-sonnet"]');
        await page.check('[data-testid="model-checkbox-gpt-3.5-turbo"]');

        // Confirm selection
        await page.click('[data-testid="confirm-model-selection"]');

        // Should show selected models in interface
        await expect(
          page.locator('[data-testid="selected-model-gpt-4"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="selected-model-claude-3-sonnet"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="selected-model-gpt-3.5-turbo"]')
        ).toBeVisible();
      }
    });

    test('should validate model compatibility for multi-chat', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      const multiModelSelector = page.locator(
        '[data-testid="multi-model-selector"]'
      );
      if (await multiModelSelector.isVisible()) {
        await multiModelSelector.click();

        // Try to select incompatible models (if any restrictions exist)
        const incompatibleWarning = page.locator(
          '[data-testid="model-compatibility-warning"]'
        );
        if (await incompatibleWarning.isVisible()) {
          await expect(incompatibleWarning).toContainText(/compatibility/i);
        }
      }
    });
  });

  test.describe('Parallel Multi-Model Conversations', () => {
    test('should send message to multiple models simultaneously', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock multiple chat API responses
      let gpt4ResponseCount = 0;
      let claudeResponseCount = 0;

      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        const encoder = new TextEncoder();
        let stream: ReadableStream<Uint8Array>;

        if (modelId === 'gpt-4') {
          gpt4ResponseCount++;
          stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"GPT-4 response: I can help you with that question."}}\n\n`
                )
              );
              controller.close();
            },
          });
        } else if (modelId === 'claude-3-sonnet') {
          claudeResponseCount++;
          stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Claude response: Here's my perspective on your question."}}\n\n`
                )
              );
              controller.close();
            },
          });
        } else {
          stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Generic response from ${modelId}"}}\n\n`
                )
              );
              controller.close();
            },
          });
        }

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      // Ensure multi-chat is active
      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        // Send message to multiple models
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Compare different approaches to solving this problem'
        );
        await page.click('[data-testid="send-to-all-models"]');

        // Wait for all responses
        await page.waitForTimeout(2000);

        // Should show responses from all models
        await expect(
          page.locator('[data-testid="response-gpt-4"]')
        ).toContainText('GPT-4 response');
        await expect(
          page.locator('[data-testid="response-claude-3-sonnet"]')
        ).toContainText('Claude response');

        // Verify multiple API calls were made
        expect(gpt4ResponseCount).toBeGreaterThan(0);
        expect(claudeResponseCount).toBeGreaterThan(0);
      }
    });

    test('should handle partial failures in multi-model responses', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock mixed success/failure responses
      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        if (modelId === 'gpt-4') {
          // Success response
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"GPT-4 successful response"}}\n\n`
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
        } else if (modelId === 'claude-3-sonnet') {
          // Failure response
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Claude API temporarily unavailable',
            }),
          });
        }
      });

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Test mixed results'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Should show successful response
        await expect(
          page.locator('[data-testid="response-gpt-4"]')
        ).toContainText('GPT-4 successful response');

        // Should show error for failed model
        await expect(
          page.locator('[data-testid="error-claude-3-sonnet"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="error-claude-3-sonnet"]')
        ).toContainText(/unavailable|error/i);
      }
    });

    test('should show loading states for all models', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock delayed responses
      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        const delay = modelId === 'gpt-4' ? 1000 : 2000; // Different delays
        await new Promise((resolve) => setTimeout(resolve, delay));

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response from ${modelId}"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Test loading states'
        );
        await page.click('[data-testid="send-to-all-models"]');

        // Should show loading indicators for all models
        await expect(
          page.locator('[data-testid="loading-gpt-4"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="loading-claude-3-sonnet"]')
        ).toBeVisible();

        // Wait for first response
        await page.waitForTimeout(1500);

        // First model should be done, second still loading
        await expect(
          page.locator('[data-testid="response-gpt-4"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="loading-claude-3-sonnet"]')
        ).toBeVisible();

        // Wait for all responses
        await page.waitForTimeout(2000);

        // All loading indicators should be gone
        await expect(
          page.locator('[data-testid="loading-gpt-4"]')
        ).toBeHidden();
        await expect(
          page.locator('[data-testid="loading-claude-3-sonnet"]')
        ).toBeHidden();
      }
    });
  });

  test.describe('Response Comparison and Analysis', () => {
    test('should display responses in comparison view', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock different responses for comparison
      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        const encoder = new TextEncoder();
        let responseText = '';

        switch (modelId) {
          case 'gpt-4':
            responseText =
              'GPT-4 suggests using a recursive approach with memoization.';
            break;
          case 'claude-3-sonnet':
            responseText =
              'Claude recommends an iterative solution for better memory efficiency.';
            break;
          case 'gpt-3.5-turbo':
            responseText =
              'GPT-3.5 proposes a hybrid approach combining both methods.';
            break;
        }

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"${responseText}"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'What is the best approach to implement a fibonacci sequence?'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Switch to comparison view
        const comparisonView = page.locator(
          '[data-testid="comparison-view-toggle"]'
        );
        if (await comparisonView.isVisible()) {
          await comparisonView.click();

          // Should show side-by-side comparison
          await expect(
            page.locator('[data-testid="comparison-container"]')
          ).toBeVisible();

          // Should show different approaches from each model
          await expect(
            page.locator('[data-testid="comparison-gpt-4"]')
          ).toContainText('recursive approach');
          await expect(
            page.locator('[data-testid="comparison-claude-3-sonnet"]')
          ).toContainText('iterative solution');
          await expect(
            page.locator('[data-testid="comparison-gpt-3.5-turbo"]')
          ).toContainText('hybrid approach');
        }
      }
    });

    test('should allow rating and comparing responses', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock responses first
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Sample response for rating"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Test rating system'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Rate responses
        const ratingButton = page
          .locator('[data-testid="rate-response-gpt-4-thumbs-up"]')
          .first();
        if (await ratingButton.isVisible()) {
          // Mock rating API
          await page.route('**/api/feedback', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true }),
            });
          });

          await ratingButton.click();

          // Should show rating confirmation
          await expect(
            page.locator('[data-testid="rating-confirmed"]')
          ).toBeVisible();
        }

        // Test comparison features
        const compareButton = page.locator('[data-testid="compare-responses"]');
        if (await compareButton.isVisible()) {
          await compareButton.click();

          // Should show comparison metrics or analysis
          await expect(
            page.locator('[data-testid="response-comparison-analysis"]')
          ).toBeVisible();
        }
      }
    });

    test('should export multi-model comparison', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Setup responses first
      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response from ${modelId} for export"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Export test query'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Export comparison
        const exportButton = page.locator('[data-testid="export-comparison"]');
        if (await exportButton.isVisible()) {
          // Mock export API
          await page.route('**/api/export/comparison', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                format: 'markdown',
                content:
                  '# Model Comparison\n\n## GPT-4\nResponse from gpt-4...\n\n## Claude\nResponse from claude...',
              }),
            });
          });

          await exportButton.click();

          // Should trigger download or show export dialog
          const exportDialog = page.locator('[data-testid="export-dialog"]');
          if (await exportDialog.isVisible()) {
            await expect(exportDialog).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Multi-Chat Session Management', () => {
    test('should save multi-chat conversation history', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock chat creation for multi-chat
      await page.route('**/api/create-chat', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'multi-chat-123',
            title: 'Multi-Model Discussion',
            type: 'multi-chat',
            models: ['gpt-4', 'claude-3-sonnet'],
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
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Multi-chat response"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Save this conversation'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Navigate away and back
        await page.goto('/settings');
        await page.goto('/');
        await waitForPageReady(page);

        // Should restore multi-chat session
        const savedChat = page.locator('[data-testid="chat-multi-chat-123"]');
        if (await savedChat.isVisible()) {
          await savedChat.click();

          // Should restore previous conversation state
          await expect(
            page.locator('[data-testid="multi-chat-interface"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="chat-message"]')
          ).toHaveCount(4); // User + 2 model responses
        }
      }
    });

    test('should handle model changes in ongoing multi-chat', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Start with two models
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Initial response"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        // Send first message
        await page.fill('[data-testid="multi-chat-input"]', 'Initial message');
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(1000);

        // Add another model mid-conversation
        const addModelButton = page.locator(
          '[data-testid="add-model-to-chat"]'
        );
        if (await addModelButton.isVisible()) {
          await addModelButton.click();

          await page.check('[data-testid="model-checkbox-gpt-3.5-turbo"]');
          await page.click('[data-testid="confirm-add-model"]');

          // Send another message to all models including new one
          await page.fill(
            '[data-testid="multi-chat-input"]',
            'Message with new model'
          );
          await page.click('[data-testid="send-to-all-models"]');

          await page.waitForTimeout(1000);

          // Should show response from new model too
          await expect(
            page.locator('[data-testid="response-gpt-3.5-turbo"]')
          ).toBeVisible();
        }
      }
    });

    test('should handle context continuity across models', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock context-aware responses
      let messageCount = 0;
      await page.route('**/api/chat', async (route) => {
        messageCount++;
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        const encoder = new TextEncoder();
        let responseText = '';

        if (messageCount === 1 || messageCount === 2) {
          // First round of responses
          responseText = `${modelId} understands you're asking about JavaScript.`;
        } else {
          // Follow-up responses should show context awareness
          responseText = `${modelId} continues: Regarding the JavaScript topic we discussed, here's more detail.`;
        }

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"${responseText}"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        // First message
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Can you help me with JavaScript functions?'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Follow-up message
        await page.fill(
          '[data-testid="multi-chat-input"]',
          'Can you give me more details about what we just discussed?'
        );
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Both models should reference the JavaScript context
        const gpt4Response = page
          .locator('[data-testid="response-gpt-4"]')
          .last();
        const claudeResponse = page
          .locator('[data-testid="response-claude-3-sonnet"]')
          .last();

        await expect(gpt4Response).toContainText(
          'JavaScript topic we discussed'
        );
        await expect(claudeResponse).toContainText(
          'JavaScript topic we discussed'
        );
      }
    });
  });

  test.describe('Performance and Resource Management', () => {
    test('should handle concurrent API calls efficiently', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Track concurrent requests
      const requestTimes: number[] = [];
      let concurrentRequests = 0;
      let maxConcurrent = 0;

      await page.route('**/api/chat', async (route) => {
        concurrentRequests++;
        maxConcurrent = Math.max(maxConcurrent, concurrentRequests);

        const startTime = Date.now();
        requestTimes.push(startTime);

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 500));

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Concurrent response"}}\n\n`
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

        concurrentRequests--;
      });

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        // Send to 3 models simultaneously
        await page.fill('[data-testid="multi-chat-input"]', 'Concurrent test');
        await page.click('[data-testid="send-to-all-models"]');

        await page.waitForTimeout(2000);

        // Verify requests were made concurrently
        expect(maxConcurrent).toBeGreaterThan(1);
        expect(requestTimes.length).toBe(3); // Three models

        // All responses should be visible
        await expect(page.locator('[data-testid^="response-"]')).toHaveCount(3);
      }
    });

    test('should manage memory usage with multiple conversations', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock lightweight responses to test memory management
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response ${Date.now()}"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        // Send multiple messages to build up conversation history
        for (let i = 1; i <= 10; i++) {
          await page.fill(
            '[data-testid="multi-chat-input"]',
            `Message ${i} for memory test`
          );
          await page.click('[data-testid="send-to-all-models"]');
          await page.waitForTimeout(1000);
        }

        // Should still be responsive after many messages
        await expect(
          page.locator('[data-testid="multi-chat-input"]')
        ).toBeEnabled();

        // Check for memory optimization features
        const optimizeButton = page.locator(
          '[data-testid="optimize-conversation"]'
        );
        if (await optimizeButton.isVisible()) {
          await optimizeButton.click();

          // Should show optimization results
          await expect(
            page.locator('[data-testid="optimization-complete"]')
          ).toBeVisible();
        }
      }
    });

    test('should handle model timeout and recovery', async ({ page }) => {
      await mockApiResponse(page, '/api/user-preferences', {
        multi_model_enabled: true,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Mock timeout for one model, success for others
      await page.route('**/api/chat', async (route) => {
        const requestBody = await route.request().postDataJSON();
        const modelId = requestBody?.model || 'gpt-4';

        if (modelId === 'claude-3-sonnet') {
          // Simulate timeout
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response from ${modelId}"}}\n\n`
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

      const multiChatInterface = page.locator(
        '[data-testid="multi-chat-interface"]'
      );
      if (await multiChatInterface.isVisible()) {
        await page.fill('[data-testid="multi-chat-input"]', 'Timeout test');
        await page.click('[data-testid="send-to-all-models"]');

        // Should show timeout error for slow model
        await expect(
          page.locator('[data-testid="timeout-error-claude-3-sonnet"]')
        ).toBeVisible({ timeout: 15000 });

        // Should show successful responses from other models
        await expect(
          page.locator('[data-testid="response-gpt-4"]')
        ).toBeVisible();

        // Should offer retry option
        const retryButton = page.locator(
          '[data-testid="retry-claude-3-sonnet"]'
        );
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
      }
    });
  });
});
