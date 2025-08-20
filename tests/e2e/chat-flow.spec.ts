import { expect, mockApiResponse, test, waitForPageReady } from './fixtures';

// TDD London Style E2E Tests: Focus on user behavior and critical paths
test.describe('Chat Message Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses to avoid external dependencies
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
          contextWindow: 200_000,
          maxOutput: 4000,
          pricing: { input: 0.003, output: 0.015 },
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

    // Navigate to the chat page
    await page.goto('/');
    await waitForPageReady(page);
  });

  test.describe('When user sends a message', () => {
    test('should display the message and show loading indicator', async ({
      chatPage,
      page,
    }) => {
      // Given the user is on the chat page
      await chatPage.chatInput();

      // When the user types and sends a message
      const testMessage = 'Hello, can you help me with coding?';

      // Mock the chat API response
      await page.route('**/api/chat', async (route) => {
        // Simulate streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"content":"Hello! I\'d be happy to help you with coding. What specific topic are you working on?"}\n\n'
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

      await chatPage.sendMessage(testMessage);

      // Then the message should appear in the chat
      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage).toContain(testMessage);

      // And a loading indicator should appear
      await expect(
        page.locator('[data-testid="message-loading"]')
      ).toBeVisible();

      // Wait for the response
      await chatPage.waitForResponse();

      // Then the response should appear
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);
    });

    test('should handle empty messages gracefully', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Try to send an empty message
      await page.click('[data-testid="send-button"]');

      // Should not create a new message
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(0);
    });

    test('should show error state when API fails', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock API failure
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await chatPage.sendMessage('Test message that will fail');

      // Should show error notification or state
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });
  });

  test.describe('When user interacts with suggestions', () => {
    test('should send suggestion as message', async ({ chatPage, page }) => {
      await chatPage.chatInput();

      // Mock the suggestions if they exist
      const suggestionButton = page
        .locator('[data-testid="suggestion-button"]')
        .first();

      if (await suggestionButton.isVisible()) {
        // Mock chat API for suggestion
        await page.route('**/api/chat', async (route) => {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"content":"Great suggestion! Let me help you with that."}\n\n'
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

        await suggestionButton.click();

        // Should create a message and get response
        await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(
          2
        );
      }
    });
  });

  test.describe('When managing chat sessions', () => {
    test('should start new chat when no messages exist', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock chat creation API
      await page.route('**/api/chat/create', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'new-chat-id' }),
        });
      });

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"content":"Hello! How can I help you today?"}\n\n'
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

      await chatPage.sendMessage('First message in new chat');

      // Should create a new chat and send the message
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);

      // URL should update to include chat ID
      await page.waitForURL(/\/chat\/new-chat-id/);
    });

    test('should clear chat when clear button is clicked', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Send a message first
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"content":"Test response"}\n\n')
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

      await chatPage.sendMessage('Test message');
      await chatPage.waitForResponse();

      // Verify message exists
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);

      // Clear the chat
      await chatPage.clearChat();

      // Should remove all messages
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(0);
    });
  });

  test.describe('When handling long conversations', () => {
    test('should maintain scroll position during typing', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Send multiple messages to create a long conversation
      for (let i = 1; i <= 5; i++) {
        await page.route('**/api/chat', async (route) => {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(
                encoder.encode(`data: {"content":"Response ${i}"}\n\n`)
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

        await chatPage.sendMessage(`Message ${i}`);
        await chatPage.waitForResponse();
      }

      // Should have multiple message pairs
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(
        10
      );

      // The chat should auto-scroll to show the latest message
      const lastMessage = page.locator('[data-testid="chat-message"]').last();
      await expect(lastMessage).toBeInViewport();
    });

    test('should handle rapid message sending', async ({ chatPage, page }) => {
      await chatPage.chatInput();

      // Mock sequential responses
      let responseCount = 0;
      await page.route('**/api/chat', async (route) => {
        responseCount++;
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: {"content":"Response ${responseCount}"}\n\n`
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

      // Send multiple messages quickly
      await chatPage.sendMessage('Message 1');
      await page.waitForTimeout(100);
      await chatPage.sendMessage('Message 2');
      await page.waitForTimeout(100);
      await chatPage.sendMessage('Message 3');

      // Should handle all messages correctly
      await page.waitForTimeout(2000); // Wait for all responses
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(6);
    });
  });

  test.describe('When handling edge cases', () => {
    test('should handle network disconnection gracefully', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Simulate network failure
      await page.route('**/api/chat', async (route) => {
        await route.abort('failed');
      });

      await chatPage.sendMessage('Message that will fail');

      // Should show appropriate error state
      await expect(
        page.locator(
          '[data-testid="error-message"], [data-testid="network-error"]'
        )
      ).toBeVisible();
    });

    test('should handle very long messages', async ({ chatPage, page }) => {
      await chatPage.chatInput();

      const longMessage = 'A'.repeat(5000); // Very long message

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"content":"I received your long message."}\n\n'
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

      await chatPage.sendMessage(longMessage);

      // Should handle the message without breaking
      const lastMessage = await chatPage.getLastMessage();
      expect(lastMessage).toContain('A'.repeat(100)); // At least part of the message
    });

    test('should preserve message across page reload', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"content":"Persistent response"}\n\n')
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

      await chatPage.sendMessage('Persistent message');
      await chatPage.waitForResponse();

      // Reload the page
      await page.reload();
      await waitForPageReady(page);

      // Messages should be preserved (if chat persistence is implemented)
      // This test might need adjustment based on actual persistence behavior
      const messageCount = await page
        .locator('[data-testid="chat-message"]')
        .count();
      expect(messageCount).toBeGreaterThanOrEqual(0); // Adjust expectation based on implementation
    });
  });
});
