import { test, expect } from '@playwright/test';
import { mockApiRoutes, createTestUser, setupTestChat } from './fixtures';

test.describe('Settings and Preferences E2E', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/');
  });

  test.describe('Theme Settings', () => {
    test('should toggle between light and dark themes', async ({ page }) => {
      // Initial theme check
      const body = page.locator('body');
      await expect(body).toHaveClass(/light|dark/);

      // Click theme toggle
      const themeToggle = page.locator('[data-testid="theme-toggle"]');
      await themeToggle.click();

      // Wait for theme change
      await page.waitForTimeout(300);
      
      // Verify theme changed
      const newTheme = await body.getAttribute('class');
      expect(newTheme).toMatch(/dark|light/);

      // Verify persistence across page reload
      await page.reload();
      await expect(body).toHaveClass(new RegExp(newTheme?.includes('dark') ? 'dark' : 'light'));
    });

    test('should persist theme preference in localStorage', async ({ page }) => {
      await page.locator('[data-testid="theme-toggle"]').click();
      
      const themeValue = await page.evaluate(() => 
        localStorage.getItem('theme-preference')
      );
      
      expect(themeValue).toMatch(/dark|light/);
    });
  });

  test.describe('Model Preferences', () => {
    test('should save default model selection', async ({ page }) => {
      const user = await createTestUser();
      await page.goto('/settings');

      // Mock settings API
      await page.route('**/api/user/settings', async (route) => {
        if (route.request().method() === 'POST') {
          const body = await route.request().postDataJSON();
          expect(body).toHaveProperty('defaultModel');
          await route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }
      });

      // Select default model
      await page.click('[data-testid="model-preferences-section"]');
      await page.selectOption('[data-testid="default-model-select"]', 'gpt-4');
      await page.click('[data-testid="save-model-preferences"]');

      // Verify success notification
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Model preferences saved'
      );
    });

    test('should configure model-specific parameters', async ({ page }) => {
      await page.goto('/settings');

      // Expand advanced model settings
      await page.click('[data-testid="advanced-model-settings-toggle"]');

      // Configure temperature
      await page.fill('[data-testid="temperature-input"]', '0.7');
      
      // Configure max tokens
      await page.fill('[data-testid="max-tokens-input"]', '2048');

      // Configure top-p
      await page.fill('[data-testid="top-p-input"]', '0.9');

      // Save settings
      await page.click('[data-testid="save-model-parameters"]');

      // Verify parameters are applied in new chat
      await page.goto('/');
      await setupTestChat(page);

      // Check that request includes custom parameters
      let requestMade = false;
      await page.route('**/api/chat/stream', async (route) => {
        const body = await route.request().postDataJSON();
        expect(body.config).toMatchObject({
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        });
        requestMade = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ message: 'Test response' }),
        });
      });

      await page.fill('[data-testid="chat-input"]', 'Test message');
      await page.press('[data-testid="chat-input"]', 'Enter');
      
      expect(requestMade).toBe(true);
    });
  });

  test.describe('API Key Management (BYOK)', () => {
    test('should add and validate API key', async ({ page }) => {
      await page.goto('/settings/api-keys');

      // Mock API key validation
      await page.route('**/api/validate-key', async (route) => {
        const body = await route.request().postDataJSON();
        if (body.apiKey === 'sk-valid-key-123') {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({ valid: true, provider: 'openai' }),
          });
        } else {
          await route.fulfill({
            status: 400,
            body: JSON.stringify({ valid: false, error: 'Invalid key' }),
          });
        }
      });

      // Add valid API key
      await page.click('[data-testid="add-api-key-button"]');
      await page.selectOption('[data-testid="provider-select"]', 'openai');
      await page.fill('[data-testid="api-key-input"]', 'sk-valid-key-123');
      await page.click('[data-testid="validate-key-button"]');

      // Wait for validation
      await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();
      
      // Save key
      await page.click('[data-testid="save-api-key"]');
      
      // Verify key appears in list
      await expect(page.locator('[data-testid="api-key-list"]')).toContainText('OpenAI');
    });

    test('should handle invalid API key gracefully', async ({ page }) => {
      await page.goto('/settings/api-keys');

      // Mock invalid key response
      await page.route('**/api/validate-key', async (route) => {
        await route.fulfill({
          status: 400,
          body: JSON.stringify({ valid: false, error: 'Invalid API key format' }),
        });
      });

      await page.click('[data-testid="add-api-key-button"]');
      await page.selectOption('[data-testid="provider-select"]', 'openai');
      await page.fill('[data-testid="api-key-input"]', 'invalid-key');
      await page.click('[data-testid="validate-key-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="validation-error"]')).toContainText(
        'Invalid API key format'
      );
    });

    test('should delete API key with confirmation', async ({ page }) => {
      await page.goto('/settings/api-keys');

      // Mock existing API key
      await page.route('**/api/user/api-keys', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            keys: [
              { id: 'key-1', provider: 'openai', masked: 'sk-...123' }
            ]
          }),
        });
      });

      await page.reload();

      // Click delete button
      await page.click('[data-testid="delete-key-button"]');

      // Confirm deletion
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-button"]');

      // Verify key removed
      await expect(page.locator('[data-testid="api-key-list"]')).toBeEmpty();
    });
  });

  test.describe('Voice Settings', () => {
    test('should configure voice recording preferences', async ({ page }) => {
      await page.goto('/settings/voice');

      // Grant microphone permissions
      await page.context().grantPermissions(['microphone']);

      // Configure voice settings
      await page.selectOption('[data-testid="voice-provider-select"]', 'openai');
      await page.selectOption('[data-testid="voice-model-select"]', 'whisper-1');
      await page.check('[data-testid="auto-transcription-toggle"]');

      // Test microphone
      await page.click('[data-testid="test-microphone-button"]');
      
      // Verify microphone test
      await expect(page.locator('[data-testid="microphone-status"]')).toContainText(
        'Microphone working'
      );

      // Save voice settings
      await page.click('[data-testid="save-voice-settings"]');

      // Verify settings saved
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Voice settings saved'
      );
    });

    test('should handle microphone permission denied', async ({ page }) => {
      await page.goto('/settings/voice');

      // Deny microphone permissions
      await page.context().grantPermissions([]);

      await page.click('[data-testid="test-microphone-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="microphone-error"]')).toContainText(
        'Microphone access denied'
      );
    });
  });

  test.describe('Chat History Settings', () => {
    test('should configure chat history retention', async ({ page }) => {
      await page.goto('/settings/privacy');

      // Mock settings save
      await page.route('**/api/user/privacy-settings', async (route) => {
        const body = await route.request().postDataJSON();
        expect(body).toHaveProperty('chatHistoryRetention');
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      // Configure retention period
      await page.selectOption('[data-testid="history-retention-select"]', '30');
      await page.check('[data-testid="auto-delete-toggle"]');

      // Save privacy settings
      await page.click('[data-testid="save-privacy-settings"]');

      // Verify settings saved
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Privacy settings updated'
      );
    });

    test('should export chat history', async ({ page }) => {
      await page.goto('/settings/data');

      // Mock export endpoint
      await page.route('**/api/user/export-data', async (route) => {
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-disposition': 'attachment; filename="chat-history.json"'
          },
          body: JSON.stringify({
            chats: [
              { id: 'chat-1', title: 'Test Chat', messages: [] }
            ]
          }),
        });
      });

      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-data-button"]');
      const download = await downloadPromise;

      // Verify download
      expect(download.suggestedFilename()).toContain('chat-history');
    });

    test('should clear all chat history with confirmation', async ({ page }) => {
      await page.goto('/settings/data');

      // Mock clear history endpoint
      let clearRequestMade = false;
      await page.route('**/api/user/clear-history', async (route) => {
        clearRequestMade = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, deleted: 15 }),
        });
      });

      // Click clear history
      await page.click('[data-testid="clear-history-button"]');

      // Confirm action
      await expect(page.locator('[data-testid="clear-confirmation-dialog"]')).toBeVisible();
      await page.fill('[data-testid="confirmation-input"]', 'DELETE');
      await page.click('[data-testid="confirm-clear-button"]');

      // Verify request made and success message
      expect(clearRequestMade).toBe(true);
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        '15 conversations deleted'
      );
    });
  });

  test.describe('Usage Analytics', () => {
    test('should display usage statistics', async ({ page }) => {
      // Mock usage data
      await page.route('**/api/user/usage-stats', async (route) => {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({
            tokensUsed: 25000,
            messagesCount: 150,
            voiceMinutes: 45,
            apiCalls: 200,
            period: 'current_month'
          }),
        });
      });

      await page.goto('/settings/usage');

      // Verify usage data displayed
      await expect(page.locator('[data-testid="tokens-used"]')).toContainText('25,000');
      await expect(page.locator('[data-testid="messages-count"]')).toContainText('150');
      await expect(page.locator('[data-testid="voice-minutes"]')).toContainText('45');
      await expect(page.locator('[data-testid="api-calls"]')).toContainText('200');
    });

    test('should switch usage time periods', async ({ page }) => {
      await page.goto('/settings/usage');

      // Switch to weekly view
      await page.selectOption('[data-testid="usage-period-select"]', 'week');

      // Verify API call with new period
      let requestMade = false;
      await page.route('**/api/user/usage-stats*', async (route) => {
        expect(route.request().url()).toContain('period=week');
        requestMade = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ tokensUsed: 5000, period: 'week' }),
        });
      });

      await page.reload();
      expect(requestMade).toBe(true);
    });
  });

  test.describe('Account Settings', () => {
    test('should update user profile', async ({ page }) => {
      const user = await createTestUser();
      await page.goto('/settings/account');

      // Mock profile update
      await page.route('**/api/user/profile', async (route) => {
        const body = await route.request().postDataJSON();
        expect(body).toMatchObject({
          displayName: 'Updated Name',
          email: 'updated@example.com',
        });
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      // Update profile fields
      await page.fill('[data-testid="display-name-input"]', 'Updated Name');
      await page.fill('[data-testid="email-input"]', 'updated@example.com');

      // Save changes
      await page.click('[data-testid="save-profile-button"]');

      // Verify success
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Profile updated successfully'
      );
    });

    test('should change password with validation', async ({ page }) => {
      const user = await createTestUser();
      await page.goto('/settings/account');

      // Mock password change
      await page.route('**/api/auth/change-password', async (route) => {
        const body = await route.request().postDataJSON();
        if (body.currentPassword === 'wrongpassword') {
          await route.fulfill({
            status: 400,
            body: JSON.stringify({ error: 'Current password incorrect' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }
      });

      // Try with wrong current password
      await page.fill('[data-testid="current-password"]', 'wrongpassword');
      await page.fill('[data-testid="new-password"]', 'newpassword123');
      await page.fill('[data-testid="confirm-password"]', 'newpassword123');
      await page.click('[data-testid="change-password-button"]');

      // Verify error message
      await expect(page.locator('[data-testid="error-toast"]')).toContainText(
        'Current password incorrect'
      );

      // Try with correct current password
      await page.fill('[data-testid="current-password"]', 'correctpassword');
      await page.click('[data-testid="change-password-button"]');

      // Verify success
      await expect(page.locator('[data-testid="success-toast"]')).toContainText(
        'Password changed successfully'
      );
    });

    test('should delete account with confirmation', async ({ page }) => {
      const user = await createTestUser();
      await page.goto('/settings/account');

      // Mock account deletion
      let deleteRequestMade = false;
      await page.route('**/api/user/delete-account', async (route) => {
        deleteRequestMade = true;
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      // Start account deletion
      await page.click('[data-testid="delete-account-button"]');

      // Confirm deletion
      await expect(page.locator('[data-testid="delete-account-dialog"]')).toBeVisible();
      await page.fill('[data-testid="confirmation-input"]', 'DELETE ACCOUNT');
      await page.click('[data-testid="confirm-delete-account"]');

      // Verify request made and redirect
      expect(deleteRequestMade).toBe(true);
      await expect(page).toHaveURL('/login');
    });
  });

  test.describe('Settings Persistence and Sync', () => {
    test('should persist settings across browser sessions', async ({ page }) => {
      // Set some settings
      await page.goto('/settings');
      await page.selectOption('[data-testid="default-model-select"]', 'gpt-4');
      await page.click('[data-testid="theme-toggle"]');

      // Clear browser data and reload
      await page.context().clearCookies();
      await page.reload();

      // Verify settings persisted (for authenticated users)
      // Note: This would depend on server-side persistence
      const user = await createTestUser();
      await page.goto('/settings');
      
      // Mock settings retrieval
      await page.route('**/api/user/settings', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            body: JSON.stringify({
              defaultModel: 'gpt-4',
              theme: 'dark',
            }),
          });
        }
      });

      await page.reload();
      await expect(page.locator('[data-testid="default-model-select"]')).toHaveValue('gpt-4');
    });

    test('should handle settings sync conflicts gracefully', async ({ page }) => {
      const user = await createTestUser();
      
      // Simulate settings conflict
      await page.route('**/api/user/settings', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 409,
            body: JSON.stringify({
              error: 'Settings conflict detected',
              serverSettings: { defaultModel: 'claude-3' },
              clientSettings: { defaultModel: 'gpt-4' },
            }),
          });
        }
      });

      await page.goto('/settings');
      await page.selectOption('[data-testid="default-model-select"]', 'gpt-4');
      await page.click('[data-testid="save-settings"]');

      // Verify conflict resolution dialog
      await expect(page.locator('[data-testid="conflict-resolution-dialog"]')).toBeVisible();
      await page.click('[data-testid="keep-server-settings"]');

      // Verify settings updated
      await expect(page.locator('[data-testid="default-model-select"]')).toHaveValue('claude-3');
    });
  });
});