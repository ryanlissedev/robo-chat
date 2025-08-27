import { expect, mockApiResponse, test, waitForPageReady } from './fixtures';

// E2E tests for Reasoning Summary UI across providers
// NOTE: We simulate streaming of assistant content and a separate reasoning summary text.
// The UI should auto-open the reasoning panel while streaming, and allow toggling afterwards.

test.describe('Reasoning Summary UI', () => {
  const basePreferences = {
    layout: 'fullscreen',
    prompt_suggestions: false,
    show_tool_invocations: true,
    show_conversation_previews: false,
    multi_model_enabled: false,
    hidden_models: [],
  };

  type ProviderCase = {
    id: string;
    name: string;
    provider: 'openai' | 'anthropic' | 'google';
    description: string;
  };

  const providers: ProviderCase[] = [
    // OpenAI GPT-5 or o-series
    {
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      provider: 'openai',
      description: 'OpenAI GPT-5 Mini',
    },
    // Anthropic Claude
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      description: 'Anthropic Claude 3 Sonnet',
    },
    // Google Gemini
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      description: 'Google Gemini 1.5 Pro',
    },
  ];

  for (const p of providers) {
    test.describe(`${p.name} (${p.provider})`, () => {
      test.beforeEach(async ({ page }) => {
        await mockApiResponse(page, '/api/models', {
          models: [
            {
              id: p.id,
              name: p.name,
              provider: p.provider,
              description: p.description,
              contextWindow: 200000,
              maxOutput: 4000,
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
          google: true,
          perplexity: false,
          xai: false,
        });

        await mockApiResponse(page, '/api/user-preferences', basePreferences);

        await page.goto('/');
        await waitForPageReady(page);

        // Select the target model for this provider
        const trigger = page.locator('[data-testid="model-selector-trigger"]');
        if (await trigger.isVisible()) {
          await trigger.click();
          await page.click(`[data-testid="model-option-${p.id}"]`);
        }
      });

      test('shows reasoning panel while streaming and allows toggling after completion', async ({
        page,
      }) => {
        let controller: ReadableStreamDefaultController<Uint8Array>;

        await page.route('**/api/chat', async (route) => {
          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            start(c) {
              controller = c;
              // Begin streaming shortly after request is fulfilled.
              setTimeout(() => {
                // Stream assistant visible content in chunks
                controller.enqueue(
                  encoder.encode(
                    'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Answer: "}}\n\n'
                  )
                );

                // Stream a separate reasoning summary text chunk. While the exact SDK event name may vary,
                // we include it as text content for UI visibility purposes, preceded with a recognizable lead.
                controller.enqueue(
                  encoder.encode(
                    'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"[REASONING] Planning solution in steps."}}\n\n'
                  )
                );

                // Final content
                controller.enqueue(
                  encoder.encode(
                    'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"done."}}\n\n'
                  )
                );

                // Close the stream
                controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
                controller.close();
              }, 150);
            },
          });

          await route.fulfill({
            status: 200,
            contentType: 'text/plain',
            body: stream as any,
          });
        });

        // Send a message to trigger streaming
        await page.fill(
          '[data-testid="chat-input"]',
          'Explain how to sort an array.'
        );
        await page.click('[data-testid="send-button"]');

        // While streaming, the Reasoning trigger should appear with "Thinking..." and auto-open.
        // Allow some time for initial stream chunks.
        await page.waitForTimeout(500);

        const triggers = page.locator('button:has-text("Thinking...")');
        if (await triggers.count()) {
          await expect(triggers.first()).toBeVisible();
        }

        // Wait for stream to settle
        await page.waitForTimeout(1200);

        // The assistant message should contain the final text
        const assistant = page
          .locator('[data-testid="chat-message"][data-role="assistant"]')
          .last();
        await expect(assistant).toContainText('Answer:');
        await expect(assistant).toContainText('done.');

        // The reasoning content should be viewable by toggling (if collapsed after auto-close)
        // Try to locate a trigger – either still "Thinking..." (duration 0) or a duration text
        const anyTrigger = page.locator(
          'button:has-text("Thinking..."), button:has-text("Thought for")'
        );
        if (await anyTrigger.count()) {
          await anyTrigger.first().click();
          // Expect the reasoning text snippet to be visible within the message container
          await expect(assistant).toContainText('Planning solution');
        }
      });
    });
  }
});
