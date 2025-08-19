const { chromium } = require('playwright');

async function testChatFlow() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);
    
    // Check localStorage for guest ID
    const guestId = await page.evaluate(() => localStorage.getItem('guestUserId'));
    console.log('2. Guest ID:', guestId);
    
    // Type a message
    console.log('3. Typing message...');
    const input = await page.locator('textarea[placeholder*="Ask"], input[placeholder*="Ask"]');
    await input.fill('Hello, can you help me test this chat?');
    
    // Submit the message
    console.log('4. Submitting message...');
    await page.keyboard.press('Enter');
    
    // Wait for navigation
    console.log('5. Waiting for navigation...');
    await page.waitForURL('**/c/**', { timeout: 5000 });
    await page.waitForTimeout(1000);
    
    // Check URL
    const url = page.url();
    console.log('6. Current URL:', url);
    
    // Check for chat ID in localStorage
    const chatId = await page.evaluate(() => localStorage.getItem('guestChatId'));
    console.log('7. Guest Chat ID:', chatId);
    
    // Check IndexedDB for messages after page loads
    await page.waitForTimeout(1000);
    const indexedDbData = await page.evaluate(async () => {
      try {
        return new Promise((resolve) => {
          const request = indexedDB.open('chat-store');
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['messages'], 'readonly');
            const store = transaction.objectStore('messages');
            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
              resolve(getAllRequest.result);
            };
          };
          request.onerror = () => resolve([]);
        });
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('8. IndexedDB messages:', JSON.stringify(indexedDbData, null, 2));
    
    // Check for messages in DOM
    const messagesArea = await page.locator('[data-testid="chat-messages"], .messages, [role="main"]');
    const messagesFound = await messagesArea.count();
    console.log('9. Messages area found:', messagesFound > 0);
    
    // Wait for response
    console.log('10. Waiting for AI response...');
    await page.waitForTimeout(5000);
    
    // Check for any message elements
    const userMessages = await page.locator('[data-role="user"], .user-message, div:has-text("Hello")').count();
    const assistantMessages = await page.locator('[data-role="assistant"], .assistant-message').count();
    
    console.log('11. User messages found:', userMessages);
    console.log('12. Assistant messages found:', assistantMessages);
    
    // Take screenshot
    await page.screenshot({ path: 'chat-flow-test.png', fullPage: true });
    console.log('13. Screenshot saved as chat-flow-test.png');
    
    // Keep browser open for inspection
    console.log('\n✅ Test complete. Browser will stay open for 30 seconds...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testChatFlow();