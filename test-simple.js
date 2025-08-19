const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console logs
  page.on('console', msg => console.log('Browser console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err));
  
  // Go to the app
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  console.log('Page loaded');
  
  // Type a message
  const input = await page.locator('textarea[placeholder="Ask anything"]');
  await input.fill('Hello, respond with a simple greeting');
  
  console.log('Message typed');
  
  // Send the message
  await input.press('Enter');
  
  console.log('Message sent, waiting for navigation...');
  
  // Wait for navigation
  try {
    await page.waitForURL(/\/c\/.+/, { timeout: 10000 });
    console.log('✅ Navigated to:', page.url());
  } catch (e) {
    console.log('❌ Navigation failed:', e.message);
  }
  
  // Wait a bit for messages to render
  await page.waitForTimeout(3000);
  
  // Check what's on the page
  const messages = await page.locator('[data-testid="messages-area"]').count();
  console.log('Messages area found:', messages > 0);
  
  // Look for any divs that might contain messages
  const allDivs = await page.locator('div').all();
  console.log('Total divs on page:', allDivs.length);
  
  // Look for text content
  const hasUserMessage = await page.locator('text=/Hello/').count();
  console.log('User message found:', hasUserMessage > 0);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug-test.png' });
  console.log('Screenshot saved as debug-test.png');
  
  // Check localStorage
  const guestUserId = await page.evaluate(() => localStorage.getItem('guestUserId'));
  const guestChatId = await page.evaluate(() => localStorage.getItem('guestChatId'));
  console.log('Guest User ID:', guestUserId);
  console.log('Guest Chat ID:', guestChatId);
  
  // Wait for any response
  await page.waitForTimeout(10000);
  
  // Check again for assistant message
  const assistantContent = await page.locator('text=/greeting|hello|hi/i').count();
  console.log('Assistant message found:', assistantContent > 0);
  
  // Get page content
  const content = await page.content();
  const hasAssistant = content.toLowerCase().includes('assistant');
  console.log('Page contains "assistant":', hasAssistant);
  
  await browser.close();
})();