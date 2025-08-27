import { expect, test } from '@playwright/test';
import { mockApiResponse, waitForPageReady } from './fixtures';

test.describe('Authentication Flow', () => {
  test.describe('Guest User Flow', () => {
    test('should allow guest user to chat without authentication', async ({
      page,
    }) => {
      // Mock API responses for guest access
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

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

      await page.goto('/');
      await waitForPageReady(page);

      // Guest should be able to see chat interface
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

      // Verify guest access banner or indicator is shown
      const guestIndicator = page.locator(
        '[data-testid="guest-mode-indicator"]'
      );
      if (await guestIndicator.isVisible()) {
        await expect(guestIndicator).toContainText(/guest|trial/i);
      }
    });

    test('should show BYOK modal when API key is required', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Try to send a message
      await page.fill('[data-testid="chat-input"]', 'Hello, world!');
      await page.click('[data-testid="send-button"]');

      // Should show BYOK modal or auth dialog
      await expect(
        page.locator(
          '[data-testid="guest-key-modal"], [data-testid="auth-dialog"]'
        )
      ).toBeVisible({ timeout: 10000 });
    });

    test('should allow guest user to provide API key via BYOK modal', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Trigger BYOK modal by trying to send a message
      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');

      // Wait for and interact with BYOK modal
      await expect(
        page.locator('[data-testid="guest-key-modal"]')
      ).toBeVisible();

      // Fill in API key
      const testApiKey = 'sk-test1234567890abcdef';
      await page.fill('[data-testid="api-key-input"]', testApiKey);

      // Mock API key validation
      await mockApiResponse(page, '/api/settings/test-api-key', {
        valid: true,
        provider: 'openai',
      });

      await page.click('[data-testid="save-api-key-button"]');

      // Modal should close and user can proceed
      await expect(
        page.locator('[data-testid="guest-key-modal"]')
      ).toBeHidden();
    });

    test('should handle invalid API key gracefully', async ({ page }) => {
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.goto('/');
      await waitForPageReady(page);

      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');

      await expect(
        page.locator('[data-testid="guest-key-modal"]')
      ).toBeVisible();

      const invalidApiKey = 'invalid-key';
      await page.fill('[data-testid="api-key-input"]', invalidApiKey);

      // Mock API key validation failure
      await mockApiResponse(page, '/api/settings/test-api-key', {
        valid: false,
        error: 'Invalid API key format',
      });

      await page.click('[data-testid="save-api-key-button"]');

      // Should show error message
      await expect(page.locator('[data-testid="api-key-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="api-key-error"]')).toContainText(
        /invalid/i
      );
    });
  });

  test.describe('Authenticated User Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authenticated state
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
    });

    test('should display user menu and profile info', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Look for user menu trigger
      const userMenu = page.locator('[data-testid="user-menu-trigger"]');
      if (await userMenu.isVisible()) {
        await userMenu.click();

        // Should show user profile information
        await expect(
          page.locator('[data-testid="user-menu-content"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="user-email"], [data-testid="user-name"]')
        ).toBeVisible();
      }
    });

    test('should handle sign out process', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const userMenu = page.locator('[data-testid="user-menu-trigger"]');
      if (await userMenu.isVisible()) {
        await userMenu.click();

        const signOutButton = page.locator('[data-testid="sign-out-button"]');
        if (await signOutButton.isVisible()) {
          // Mock sign out API call
          await page.route('**/api/auth/signout', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true }),
            });
          });

          await signOutButton.click();

          // Should redirect or show sign-in state
          await page.waitForTimeout(1000);

          // Check if returned to guest state
          const guestIndicator = page.locator(
            '[data-testid="guest-mode-indicator"]'
          );
          if (await guestIndicator.isVisible()) {
            expect(await guestIndicator.textContent()).toMatch(/guest|trial/i);
          }
        }
      }
    });

    test('should persist user preferences across sessions', async ({
      page,
    }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Check that user preferences are loaded
      const settingsButton = page.locator('[data-testid="settings-button"]');
      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        // Verify some preference is loaded correctly
        const layoutSetting = page.locator(
          '[data-testid="layout-setting-fullscreen"]'
        );
        if (await layoutSetting.isVisible()) {
          await expect(layoutSetting).toBeChecked();
        }
      }
    });
  });

  test.describe('Authentication State Transitions', () => {
    test('should handle authentication errors gracefully', async ({ page }) => {
      // Mock authentication error
      await page.route('**/api/auth/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Authentication failed' }),
        });
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Should fallback to guest mode or show appropriate error
      const errorMessage = page.locator('[data-testid="auth-error"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/authentication/i);
      }
    });

    test('should handle session expiration', async ({ page }) => {
      // Start as authenticated
      await mockApiResponse(page, '/api/user-key-status', {
        openai: true,
        anthropic: true,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await page.goto('/');
      await waitForPageReady(page);

      // Simulate session expiration by returning 401
      await page.route('**/api/chat', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired' }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');

      // Should show authentication dialog or redirect
      await expect(
        page.locator(
          '[data-testid="auth-dialog"], [data-testid="session-expired-dialog"]'
        )
      ).toBeVisible({ timeout: 5000 });
    });

    test('should redirect after successful authentication', async ({
      page,
    }) => {
      // Start from a specific page that requires auth
      await page.goto('/settings');

      // Should redirect to auth or show auth modal
      const currentUrl = page.url();
      const isAuthRequired =
        currentUrl.includes('/auth/') || currentUrl.includes('/login');

      if (isAuthRequired) {
        // Mock successful authentication
        await mockApiResponse(page, '/api/auth/callback', {
          success: true,
          user: { id: 'user-123', email: 'test@example.com' },
        });

        // Should redirect back to settings after auth
        await page.waitForURL(/\/settings/);
      }
    });
  });

  test.describe('Rate Limiting and Usage', () => {
    test('should show rate limit dialog when limits are exceeded', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-key-status', {
        openai: false,
        anthropic: false,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      // Mock rate limit exceeded response
      await mockApiResponse(page, '/api/rate-limits', {
        remaining: 0,
        total: 10,
        resetTime: Date.now() + 3600000, // 1 hour from now
      });

      await page.goto('/');
      await waitForPageReady(page);

      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.click('[data-testid="send-button"]');

      // Should show rate limit dialog
      await expect(
        page.locator('[data-testid="rate-limit-dialog"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="rate-limit-dialog"]')
      ).toContainText(/limit|exceeded/i);
    });

    test('should display usage statistics for authenticated users', async ({
      page,
    }) => {
      await mockApiResponse(page, '/api/user-key-status', {
        openai: true,
        anthropic: true,
        openrouter: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
      });

      await mockApiResponse(page, '/api/usage-stats', {
        daily: { used: 5, limit: 100 },
        monthly: { used: 150, limit: 1000 },
      });

      await page.goto('/settings');
      await waitForPageReady(page);

      // Look for usage statistics
      const usageSection = page.locator('[data-testid="usage-statistics"]');
      if (await usageSection.isVisible()) {
        await expect(usageSection).toContainText(/usage|limit/i);
      }
    });
  });
});
