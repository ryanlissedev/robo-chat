/**
 * Critical User Journey End-to-End Tests
 * Testing complete user workflows in production-like environment
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Critical User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    // Set up any necessary authentication or initial state
    await page.goto('/');
  });

  test.describe('New User Onboarding Journey', () => {
    test('should guide new user through first chat experience', async ({ page }) => {
      // Step 1: New user lands on homepage
      await expect(page).toHaveTitle(/Roborail Assistant/);
      
      // Step 2: User sees welcome interface
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
      
      // Step 3: User enters first message
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Hello, how can you help me?');
      
      // Step 4: User sends message
      await page.keyboard.press('Enter');
      
      // Step 5: User sees response loading
      await expect(page.locator('[data-testid="message-loading"]')).toBeVisible();
      
      // Step 6: User receives welcome response
      await expect(page.locator('[role="assistant"]')).toBeVisible({ timeout: 30000 });
      
      // Step 7: Verify conversation history is created
      await expect(page.locator('[data-testid="chat-history"]')).toBeVisible();
    });

    test('should handle unauthenticated user limitations gracefully', async ({ page }) => {
      // Test guest user experience
      await page.goto('/');
      
      // User should be able to chat without authentication
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Test message as guest');
      await page.keyboard.press('Enter');
      
      // Should see guest indicator or limitations
      await expect(
        page.locator('[data-testid="guest-indicator"]').or(
          page.locator('text=sign in for more features')
        )
      ).toBeVisible();
    });

    test('should show model selection for new users', async ({ page }) => {
      // User should see model selector
      await expect(page.locator('[data-testid="model-selector"]')).toBeVisible();
      
      // User can change model
      await page.click('[data-testid="model-selector"]');
      await expect(page.locator('[role="menu"]')).toBeVisible();
      
      // Select different model
      await page.click('[data-testid="model-gpt-4o-mini"]');
      
      // Verify model changed
      await expect(page.locator('[data-testid="model-selector"]')).toContainText('gpt-4o-mini');
    });
  });

  test.describe('Authenticated User Journey', () => {
    test('should complete full authenticated user workflow', async ({ page }) => {
      // Step 1: User signs in
      await page.goto('/auth');
      
      // Step 2: Complete authentication flow
      await page.click('[data-testid="auth-github"]');
      
      // Step 3: Return to chat after auth
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      // Step 4: Access premium features
      await page.click('[data-testid="model-selector"]');
      await expect(page.locator('[data-testid="model-claude-3-opus"]')).toBeVisible();
      
      // Step 5: Start conversation with premium model
      await page.click('[data-testid="model-claude-3-opus"]');
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Complex analysis task');
      await page.keyboard.press('Enter');
      
      // Step 6: Verify access to advanced features
      await expect(page.locator('[data-testid="reasoning-panel"]')).toBeVisible();
    });

    test('should handle API key configuration journey', async ({ page }) => {
      // Assume authenticated user
      await page.goto('/settings');
      
      // Navigate to API keys section
      await page.click('[data-testid="api-keys-tab"]');
      
      // Add OpenAI key
      await page.click('[data-testid="add-openai-key"]');
      await page.fill('[data-testid="api-key-input"]', 'sk-test-key-12345');
      await page.click('[data-testid="save-api-key"]');
      
      // Verify key was saved
      await expect(page.locator('[data-testid="key-status-success"]')).toBeVisible();
      
      // Return to chat and verify access
      await page.goto('/');
      await page.click('[data-testid="model-selector"]');
      await expect(page.locator('[data-testid="model-gpt-4"]')).toBeVisible();
    });
  });

  test.describe('Chat Interaction Journey', () => {
    test('should complete full conversation cycle', async ({ page }) => {
      await page.goto('/');
      
      // Send first message
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('What is machine learning?');
      await page.keyboard.press('Enter');
      
      // Wait for response
      await expect(page.locator('[role="assistant"]')).toBeVisible({ timeout: 30000 });
      
      // Send follow-up question
      await chatInput.fill('Can you give me an example?');
      await page.keyboard.press('Enter');
      
      // Verify conversation continues
      await expect(page.locator('[role="assistant"]:nth-child(2)')).toBeVisible({ timeout: 30000 });
      
      // Test message actions
      await page.hover('[data-testid="message-assistant"]:last-child');
      await expect(page.locator('[data-testid="copy-button"]')).toBeVisible();
      
      // Copy message
      await page.click('[data-testid="copy-button"]');
      await expect(page.locator('[data-testid="copy-success"]')).toBeVisible();
    });

    test('should handle file upload workflow', async ({ page }) => {
      await page.goto('/');
      
      // Click file upload button
      await page.click('[data-testid="file-upload-button"]');
      
      // Upload test file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Test file content')
      });
      
      // Verify file appears in chat
      await expect(page.locator('[data-testid="file-attachment"]')).toBeVisible();
      
      // Send message with file
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Please analyze this file');
      await page.keyboard.press('Enter');
      
      // Verify file is included in message
      await expect(page.locator('[data-testid="message-with-file"]')).toBeVisible();
    });

    test('should handle reasoning display workflow', async ({ page }) => {
      await page.goto('/');
      
      // Send complex query that triggers reasoning
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Solve this step by step: What is 15% of 240?');
      await page.keyboard.press('Enter');
      
      // Wait for reasoning to appear
      await expect(page.locator('[data-testid="reasoning-trigger"]')).toBeVisible({ timeout: 30000 });
      
      // Click to expand reasoning
      await page.click('[data-testid="reasoning-trigger"]');
      
      // Verify reasoning content is visible
      await expect(page.locator('[data-testid="reasoning-content"]')).toBeVisible();
      
      // Verify reasoning shows steps
      await expect(page.locator('[data-testid="reasoning-content"]')).toContainText('step');
    });
  });

  test.describe('Multi-Model Comparison Journey', () => {
    test('should enable and use multi-model comparison', async ({ page }) => {
      await page.goto('/settings');
      
      // Enable multi-model mode
      await page.click('[data-testid="multi-model-toggle"]');
      await expect(page.locator('[data-testid="multi-model-enabled"]')).toBeChecked();
      
      // Return to chat
      await page.goto('/');
      
      // Verify multi-model interface
      await expect(page.locator('[data-testid="multi-chat-container"]')).toBeVisible();
      
      // Send message to multiple models
      const chatInput = page.locator('[data-testid="multi-chat-input"]');
      await chatInput.fill('Compare approaches to solve climate change');
      await page.click('[data-testid="send-to-all"]');
      
      // Verify responses from multiple models
      await expect(page.locator('[data-testid="model-response-gpt-4"]')).toBeVisible({ timeout: 45000 });
      await expect(page.locator('[data-testid="model-response-claude-3"]')).toBeVisible({ timeout: 45000 });
    });

    test('should handle individual model selection in multi-mode', async ({ page }) => {
      // Assume multi-model is enabled
      await page.goto('/?multiModel=true');
      
      // Select specific models
      await page.click('[data-testid="model-selector-1"]');
      await page.click('[data-testid="model-gpt-4o-mini"]');
      
      await page.click('[data-testid="model-selector-2"]');
      await page.click('[data-testid="model-claude-3-haiku"]');
      
      // Send comparison query
      const chatInput = page.locator('[data-testid="multi-chat-input"]');
      await chatInput.fill('Explain quantum computing in simple terms');
      await page.keyboard.press('Enter');
      
      // Verify different responses
      await expect(page.locator('[data-testid="response-gpt-4o-mini"]')).toBeVisible({ timeout: 30000 });
      await expect(page.locator('[data-testid="response-claude-3-haiku"]')).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Settings and Personalization Journey', () => {
    test('should complete settings configuration journey', async ({ page }) => {
      await page.goto('/settings');
      
      // Appearance settings
      await page.click('[data-testid="appearance-tab"]');
      await page.click('[data-testid="theme-dark"]');
      await expect(page.locator('html')).toHaveClass(/dark/);
      
      // Model preferences
      await page.click('[data-testid="models-tab"]');
      await page.click('[data-testid="favorite-model-gpt-4"]');
      await expect(page.locator('[data-testid="favorite-models"]')).toContainText('gpt-4');
      
      // Interaction preferences
      await page.click('[data-testid="interaction-tab"]');
      await page.selectOption('[data-testid="temperature-slider"]', '0.8');
      
      // Save settings
      await page.click('[data-testid="save-settings"]');
      await expect(page.locator('[data-testid="settings-saved"]')).toBeVisible();
      
      // Verify settings persist
      await page.reload();
      await expect(page.locator('html')).toHaveClass(/dark/);
    });

    test('should handle system prompt customization', async ({ page }) => {
      await page.goto('/settings');
      
      // Navigate to system prompt
      await page.click('[data-testid="general-tab"]');
      
      // Edit system prompt
      const promptEditor = page.locator('[data-testid="system-prompt-editor"]');
      await promptEditor.clear();
      await promptEditor.fill('You are a helpful coding assistant specializing in Python.');
      
      // Save custom prompt
      await page.click('[data-testid="save-system-prompt"]');
      await expect(page.locator('[data-testid="prompt-saved"]')).toBeVisible();
      
      // Test custom prompt in chat
      await page.goto('/');
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Help me with Python');
      await page.keyboard.press('Enter');
      
      // Verify response reflects custom prompt
      await expect(page.locator('[role="assistant"]')).toContainText('Python');
    });
  });

  test.describe('Error Recovery Journey', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await page.goto('/');
      
      // Simulate network interruption
      await page.context().setOffline(true);
      
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('This will fail due to no network');
      await page.keyboard.press('Enter');
      
      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
      
      // Restore network and retry
      await page.context().setOffline(false);
      await page.click('[data-testid="retry-button"]');
      
      // Verify retry works
      await expect(page.locator('[role="assistant"]')).toBeVisible({ timeout: 30000 });
    });

    test('should handle API key errors', async ({ page }) => {
      await page.goto('/settings');
      
      // Add invalid API key
      await page.click('[data-testid="api-keys-tab"]');
      await page.click('[data-testid="add-openai-key"]');
      await page.fill('[data-testid="api-key-input"]', 'invalid-key');
      await page.click('[data-testid="save-api-key"]');
      
      // Try to use model with invalid key
      await page.goto('/');
      await page.click('[data-testid="model-selector"]');
      await page.click('[data-testid="model-gpt-4"]');
      
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('Test with invalid key');
      await page.keyboard.press('Enter');
      
      // Verify error handling
      await expect(page.locator('[data-testid="api-key-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="fix-api-key-link"]')).toBeVisible();
      
      // Click to fix API key
      await page.click('[data-testid="fix-api-key-link"]');
      await expect(page.url()).toContain('/settings');
    });

    test('should handle quota exceeded gracefully', async ({ page }) => {
      // This would typically require mocking the API response
      await page.route('/api/chat', route => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ error: 'Rate limit exceeded' })
        });
      });
      
      await page.goto('/');
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.fill('This should hit rate limit');
      await page.keyboard.press('Enter');
      
      // Verify rate limit handling
      await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="upgrade-suggestion"]')).toBeVisible();
    });
  });

  test.describe('Performance and Accessibility Journey', () => {
    test('should maintain performance under load', async ({ page }) => {
      await page.goto('/');
      
      // Send multiple messages rapidly
      const chatInput = page.locator('[data-testid="chat-input"]');
      
      for (let i = 0; i < 5; i++) {
        await chatInput.fill(`Message ${i + 1}`);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000); // Brief pause between messages
      }
      
      // Verify all messages are handled
      await expect(page.locator('[data-testid="message-user"]')).toHaveCount(5);
      
      // Verify page remains responsive
      await expect(page.locator('[data-testid="chat-input"]')).toBeEnabled();
    });

    test('should be fully keyboard accessible', async ({ page }) => {
      await page.goto('/');
      
      // Navigate using keyboard only
      await page.keyboard.press('Tab'); // Focus chat input
      await expect(page.locator('[data-testid="chat-input"]')).toBeFocused();
      
      // Type message
      await page.keyboard.type('Testing keyboard navigation');
      await page.keyboard.press('Enter');
      
      // Navigate to model selector with keyboard
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="model-selector"]')).toBeFocused();
      
      // Open model selector
      await page.keyboard.press('Enter');
      await expect(page.locator('[role="menu"]')).toBeVisible();
      
      // Navigate menu with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      
      // Verify model changed
      await expect(page.locator('[data-testid="model-selector"]')).not.toContainText('Loading');
    });

    test('should meet accessibility standards', async ({ page }) => {
      await page.goto('/');
      
      // Check for proper ARIA labels
      await expect(page.locator('[data-testid="chat-input"]')).toHaveAttribute('aria-label');
      await expect(page.locator('[data-testid="send-button"]')).toHaveAttribute('aria-label');
      
      // Check for proper heading structure
      await expect(page.locator('h1, h2, h3')).toHaveCount({ greaterThan: 0 });
      
      // Check color contrast (this would typically use axe-core)
      await expect(page.locator('body')).toHaveCSS('color', /rgb\(/);
      
      // Check focus management
      const chatInput = page.locator('[data-testid="chat-input"]');
      await chatInput.focus();
      await expect(chatInput).toBeFocused();
    });
  });
});