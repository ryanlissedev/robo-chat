const { chromium } = require('playwright');

async function testExistingChat() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate directly to a chat that has messages in IndexedDB
    const chatId = '53685ead-c368-4f46-8866-cc4a2a7d68dd';
    console.log(`1. Navigating to existing chat: ${chatId}`);
    await page.goto(`http://localhost:3000/c/${chatId}`);
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // Check localStorage
    const localStorageData = await page.evaluate(() => {
      const result = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        result[key] = localStorage.getItem(key);
      }
      return result;
    });
    console.log('2. LocalStorage:', JSON.stringify(localStorageData, null, 2));
    
    // Check for messages in DOM
    const bodyText = await page.locator('body').textContent();
    console.log('3. Body text preview:', bodyText.substring(0, 500));
    
    // Look for specific message text
    const hasHelloMessage = bodyText.includes('Hello, test message');
    const hasAssistantMessage = bodyText.includes('RoboRail Assistant');
    
    console.log('4. Has user message:', hasHelloMessage);
    console.log('5. Has assistant message:', hasAssistantMessage);
    
    // Take screenshot
    await page.screenshot({ path: 'existing-chat.png', fullPage: true });
    console.log('6. Screenshot saved as existing-chat.png');
    
    // Check console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    console.log('\nKeeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testExistingChat();