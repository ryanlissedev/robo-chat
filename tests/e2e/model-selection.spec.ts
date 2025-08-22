import { expect, mockApiResponse, test, waitForPageReady } from './fixtures';

// TDD London Style E2E Tests: Focus on user interactions with model selection
test.describe('Model Selection', () => {
  const mockModels = [
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
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      description: 'Fast and efficient GPT-3.5',
      contextWindow: 4000,
      maxOutput: 2000,
      pricing: { input: 0.001, output: 0.002 },
      capabilities: ['chat'],
    },
  ];

  test.beforeEach(async ({ page }) => {
    // Mock essential API responses
    await mockApiResponse(page, '/api/models', {
      models: mockModels,
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
      favorite_models: ['gpt-4', 'claude-3-sonnet'],
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

  test.describe('When opening model selector', () => {
    test('should display available models', async ({ modelSelector, page }) => {
      // When user opens the model selector
      await modelSelector.openModelSelector();

      // Then all available models should be visible
      for (const model of mockModels) {
        await expect(
          page.locator(`[data-testid="model-option-${model.id}"]`)
        ).toBeVisible();
        await expect(page.locator(`text=${model.name}`)).toBeVisible();
      }
    });

    test('should show model details and pricing', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Should show model descriptions
      await expect(page.locator('text=Latest GPT-4 model')).toBeVisible();
      await expect(
        page.locator('text=Anthropic Claude 3 Sonnet')
      ).toBeVisible();

      // Should show context window information
      await expect(page.locator('text=8000')).toBeVisible(); // GPT-4 context window
      await expect(page.locator('text=200000')).toBeVisible(); // Claude context window

      // Should show provider information
      await expect(page.locator('text=openai')).toBeVisible();
      await expect(page.locator('text=anthropic')).toBeVisible();
    });

    test('should highlight favorite models', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Favorite models should have special styling or indicators
      await expect(
        page.locator(`[data-testid="model-option-gpt-4"]`)
      ).toHaveAttribute('data-favorite', 'true');
      await expect(
        page.locator(`[data-testid="model-option-claude-3-sonnet"]`)
      ).toHaveAttribute('data-favorite', 'true');
      await expect(
        page.locator(`[data-testid="model-option-gpt-3.5-turbo"]`)
      ).not.toHaveAttribute('data-favorite', 'true');
    });

    test('should filter models by search', async ({ modelSelector, page }) => {
      await modelSelector.openModelSelector();

      // Search for GPT models
      const searchInput = page.locator('[data-testid="model-search-input"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('GPT');

        // Should show only GPT models
        await expect(
          page.locator(`[data-testid="model-option-gpt-4"]`)
        ).toBeVisible();
        await expect(
          page.locator(`[data-testid="model-option-gpt-3.5-turbo"]`)
        ).toBeVisible();
        await expect(
          page.locator(`[data-testid="model-option-claude-3-sonnet"]`)
        ).not.toBeVisible();

        // Clear search
        await searchInput.fill('');

        // All models should be visible again
        for (const model of mockModels) {
          await expect(
            page.locator(`[data-testid="model-option-${model.id}"]`)
          ).toBeVisible();
        }
      }
    });

    test('should close selector with escape key', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Verify selector is open
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).toBeVisible();

      // Close with escape
      await modelSelector.closeModelSelector();

      // Verify selector is closed
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).not.toBeVisible();
    });
  });

  test.describe('When selecting a model', () => {
    test('should update selected model display', async ({
      modelSelector,
      page,
    }) => {
      // Given the model selector is open
      await modelSelector.openModelSelector();

      // When user selects a different model
      await modelSelector.selectModel('claude-3-sonnet');

      // Then the selected model should be updated
      const selectedModel = await modelSelector.getSelectedModel();
      expect(selectedModel).toContain('Claude 3 Sonnet');

      // And the selector should close
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).not.toBeVisible();
    });

    test('should persist model selection across page navigation', async ({
      modelSelector,
      page,
    }) => {
      // Select a model
      await modelSelector.openModelSelector();
      await modelSelector.selectModel('gpt-3.5-turbo');

      const initialSelection = await modelSelector.getSelectedModel();
      expect(initialSelection).toContain('GPT-3.5 Turbo');

      // Navigate to a different page and back
      await page.goto('/settings');
      await page.goto('/');
      await waitForPageReady(page);

      // Model selection should be preserved
      const persistedSelection = await modelSelector.getSelectedModel();
      expect(persistedSelection).toContain('GPT-3.5 Turbo');
    });

    test('should send messages with selected model', async ({
      modelSelector,
      chatPage,
      page,
    }) => {
      // Select a specific model
      await modelSelector.openModelSelector();
      await modelSelector.selectModel('claude-3-sonnet');

      // Send a message
      await page.route('**/api/chat', async (route) => {
        const request = route.request();
        const body = await request.postData();

        // Verify the request includes the selected model
        expect(body).toContain('claude-3-sonnet');

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Response from Claude 3 Sonnet"}}\n\n'
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

      await chatPage.chatInput();
      await chatPage.sendMessage('Test message with Claude');
      await chatPage.waitForResponse();

      // Should receive response
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);
    });

    test('should show model-specific features when available', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Select a model with specific capabilities
      await modelSelector.selectModel('gpt-4');

      // Should show model-specific UI elements or options
      const modelCapabilities = page.locator(
        '[data-testid="model-capabilities"]'
      );
      if (await modelCapabilities.isVisible()) {
        await expect(modelCapabilities).toContainText('chat');
      }
    });
  });

  test.describe('When managing favorite models', () => {
    test('should add model to favorites', async ({ modelSelector, page }) => {
      await modelSelector.openModelSelector();

      // Find a non-favorite model
      const favoriteButton = page.locator(
        `[data-testid="favorite-button-gpt-3.5-turbo"]`
      );

      if (await favoriteButton.isVisible()) {
        // Mock the API call to update favorites
        await page.route(
          '**/api/user-preferences/favorite-models',
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true }),
            });
          }
        );

        await favoriteButton.click();

        // Should update the favorite status
        await expect(
          page.locator(`[data-testid="model-option-gpt-3.5-turbo"]`)
        ).toHaveAttribute('data-favorite', 'true');
      }
    });

    test('should remove model from favorites', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Find a favorite model
      const favoriteButton = page.locator(
        `[data-testid="favorite-button-gpt-4"]`
      );

      if (await favoriteButton.isVisible()) {
        // Mock the API call to update favorites
        await page.route(
          '**/api/user-preferences/favorite-models',
          async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true }),
            });
          }
        );

        await favoriteButton.click();

        // Should update the favorite status
        await expect(
          page.locator(`[data-testid="model-option-gpt-4"]`)
        ).not.toHaveAttribute('data-favorite', 'true');
      }
    });

    test('should show favorites section at top', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Favorites should appear before other models
      const modelOptions = page.locator('[data-testid^="model-option-"]');
      const firstModel = modelOptions.first();
      const secondModel = modelOptions.nth(1);

      await expect(firstModel).toHaveAttribute('data-favorite', 'true');
      await expect(secondModel).toHaveAttribute('data-favorite', 'true');
    });
  });

  test.describe('When handling model availability', () => {
    test('should disable unavailable models', async ({ page }) => {
      // Mock limited API key access
      await mockApiResponse(page, '/api/user-key-status', {
        openai: true,
        anthropic: false, // No access to Anthropic
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.reload();
      await waitForPageReady(page);

      const modelSelectorResult: any = await page.evaluate(() => {
        return new Promise((resolve) => {
          const button = document.querySelector(
            '[data-testid="model-selector-trigger"]'
          ) as HTMLElement;
          if (button) {
            button.click();
          }
          setTimeout(() => resolve({ result: 'opened' }), 500);
        });
      });

      // Anthropic models should be disabled
      await expect(
        page.locator(`[data-testid="model-option-claude-3-sonnet"]`)
      ).toHaveAttribute('data-disabled', 'true');

      // OpenAI models should be enabled
      await expect(
        page.locator(`[data-testid="model-option-gpt-4"]`)
      ).not.toHaveAttribute('data-disabled', 'true');
    });

    test('should show API key setup prompt for disabled models', async ({
      modelSelector,
      page,
    }) => {
      // Mock limited API key access
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.reload();
      await waitForPageReady(page);

      await modelSelector.openModelSelector();

      // Should show setup prompt for disabled models
      const setupPrompt = page.locator('[data-testid="api-key-setup-prompt"]');
      if (await setupPrompt.isVisible()) {
        await expect(setupPrompt).toContainText('API key');
      }
    });

    test('should handle model loading errors gracefully', async ({
      modelSelector,
      page,
    }) => {
      // Mock API failure
      await page.route('**/api/models', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to load models' }),
        });
      });

      await page.reload();
      await waitForPageReady(page);

      await modelSelector.openModelSelector();

      // Should show error state
      await expect(
        page.locator('[data-testid="models-error-state"]')
      ).toBeVisible();
    });
  });

  test.describe('When using keyboard navigation', () => {
    test('should navigate models with arrow keys', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Focus on first model
      await page.keyboard.press('ArrowDown');

      // Should highlight first model
      await expect(
        page.locator(`[data-testid="model-option-gpt-4"]`)
      ).toHaveClass(/highlighted|focused/);

      // Navigate to next model
      await page.keyboard.press('ArrowDown');

      // Should highlight second model
      await expect(
        page.locator(`[data-testid="model-option-claude-3-sonnet"]`)
      ).toHaveClass(/highlighted|focused/);
    });

    test('should select model with enter key', async ({
      modelSelector,
      page,
    }) => {
      await modelSelector.openModelSelector();

      // Navigate to a model
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown'); // Claude 3 Sonnet

      // Select with enter
      await page.keyboard.press('Enter');

      // Should close selector and update selection
      await expect(
        page.locator('[data-testid="model-selector-content"]')
      ).not.toBeVisible();

      const selectedModel = await modelSelector.getSelectedModel();
      expect(selectedModel).toContain('Claude 3 Sonnet');
    });
  });
});
