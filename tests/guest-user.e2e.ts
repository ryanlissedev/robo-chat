import { test, expect } from '@playwright/test';

test.describe('Guest User Functionality', () => {
  test('should allow guest user to send messages without login', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the chat interface to load
    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 10000 });
    
    // Type a message
    const testMessage = 'Hello, I am a guest user testing the chat';
    await page.getByTestId('message-input').fill(testMessage);
    
    // Wait for send button to be enabled
    await expect(page.getByTestId('send-button')).toBeEnabled({ timeout: 5000 });
    
    // Send the message
    await page.getByTestId('send-button').click();
    
    // Wait for the message to appear in the chat (with longer timeout for guest processing)
    await expect(page.locator('[data-testid="user-message"]').filter({ hasText: testMessage }))
      .toBeVisible({ timeout: 15000 });
    
    // Wait for AI response to start (loading indicator or response)
    await expect(page.locator('[data-testid="assistant-message"], [data-testid="loading-indicator"]').first())
      .toBeVisible({ timeout: 15000 });
    
    console.log('✅ Guest user can send messages successfully');
  });

  test('should create guest user session automatically', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Check that no login is required
    await expect(page.getByTestId('message-input')).toBeVisible({ timeout: 10000 });
    
    // Verify guest user ID is created in localStorage
    await page.waitForTimeout(2000); // Wait for guest user creation
    
    const guestUserId = await page.evaluate(() => {
      return localStorage.getItem('userId');
    });
    
    expect(guestUserId).toBeTruthy();
    expect(guestUserId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    console.log('✅ Guest user session created with ID:', guestUserId);
  });
  
  test('should persist guest chat across page reload', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Send a message
    const testMessage = 'Testing persistence for guest user';
    await page.getByTestId('message-input').fill(testMessage);
    await page.getByTestId('send-button').click();
    
    // Wait for message to appear
    await expect(page.locator('[data-testid="user-message"]').filter({ hasText: testMessage }))
      .toBeVisible({ timeout: 15000 });
    
    // Get the chat ID from localStorage
    const chatId = await page.evaluate(() => {
      return localStorage.getItem('guestChatId');
    });
    
    // Reload the page
    await page.reload();
    
    // Check if the message is still visible
    await expect(page.locator('[data-testid="user-message"]').filter({ hasText: testMessage }))
      .toBeVisible({ timeout: 10000 });
    
    // Verify the chat ID is the same
    const chatIdAfterReload = await page.evaluate(() => {
      return localStorage.getItem('guestChatId');
    });
    
    expect(chatIdAfterReload).toBe(chatId);
    
    console.log('✅ Guest chat persists across page reload');
  });
});