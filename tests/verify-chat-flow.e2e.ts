import { test, expect } from '@playwright/test';

test.describe('Guest User Chat Flow Verification', () => {
  test('should allow guest user to send message and receive AI response', async ({ page }) => {
    // Listen for console messages
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', err => console.log('Page error:', err.message));
    
    // Navigate to the app (use base URL from config)
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Find and type in the chat input
    const chatInput = page.locator('textarea[placeholder*="Ask anything"]').first();
    await chatInput.waitFor({ state: 'visible', timeout: 10000 });
    
    // Type a simple test message
    const testMessage = 'Hello, can you respond with a simple greeting?';
    await chatInput.fill(testMessage);
    
    // Press Enter to send the message
    await chatInput.press('Enter');
    
    // Wait for navigation to chat page
    await page.waitForURL(/\/c\/.+/, { timeout: 10000 });
    console.log('✅ Navigated to chat page:', page.url());
    
    // Wait a bit for messages to load
    await page.waitForTimeout(2000);
    
    // Check for user message first
    const userMessage = page.locator('[data-role="user"], .user-message, div:has-text("Hello")').first();
    await expect(userMessage).toBeVisible({ timeout: 10000 });
    console.log('✅ User message is visible');
    
    // Wait for the AI response to appear
    // Look for assistant message container
    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message, div[role="article"]:has-text("greeting")').last();
    
    // Wait for response with longer timeout as AI can take time
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    
    // Verify the response contains some text
    const responseText = await assistantMessage.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText?.length).toBeGreaterThan(0);
    
    console.log('✅ Guest user successfully sent message and received response');
    console.log('Response:', responseText?.substring(0, 100) + '...');
  });

  test('should allow guest user to select different AI models', async ({ page }) => {
    // Navigate to the app (use base URL from config)
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Look for model selector button/dropdown
    const modelSelector = page.locator('button:has-text("Model"), button[aria-label*="model"], [data-testid="model-selector"]').first();
    
    if (await modelSelector.isVisible()) {
      await modelSelector.click();
      
      // Wait for model dropdown to open
      await page.waitForTimeout(500);
      
      // Try to select a different model (e.g., Claude)
      const claudeModel = page.locator('text=/claude|Claude/i').first();
      if (await claudeModel.isVisible()) {
        await claudeModel.click();
        console.log('✅ Successfully changed to Claude model');
      }
    }
    
    // Send a test message with the selected model
    const chatInput = page.locator('textarea[placeholder*="Ask anything"]').first();
    await chatInput.waitFor({ state: 'visible' });
    await chatInput.fill('Hi, what model are you?');
    await chatInput.press('Enter');
    
    // Wait for response
    const assistantMessage = page.locator('[data-role="assistant"], .assistant-message').last();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });
    
    console.log('✅ Guest user can interact with different models');
  });

  test('should maintain conversation context', async ({ page }) => {
    // Navigate to the app (use base URL from config)
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    const chatInput = page.locator('textarea[placeholder*="Ask anything"]').first();
    await chatInput.waitFor({ state: 'visible' });
    
    // Send first message
    await chatInput.fill('My name is TestUser');
    await chatInput.press('Enter');
    
    // Wait for first response
    await page.waitForTimeout(3000);
    
    // Send follow-up message
    await chatInput.fill('What is my name?');
    await chatInput.press('Enter');
    
    // Wait for second response
    const assistantMessages = page.locator('[data-role="assistant"], .assistant-message');
    await expect(assistantMessages).toHaveCount(2, { timeout: 30000 });
    
    // Check if the AI remembers the context
    const lastResponse = await assistantMessages.last().textContent();
    expect(lastResponse?.toLowerCase()).toContain('testuser');
    
    console.log('✅ Conversation context is maintained');
  });
});