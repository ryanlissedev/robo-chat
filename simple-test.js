const { chromium } = require('playwright');

async function simpleTest() {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('1. Going to app...');
    await page.goto('http://localhost:3000');
    
    console.log('2. Taking screenshot before typing...');
    await page.screenshot({ path: 'before-typing.png' });
    
    console.log('3. Typing message...');
    const input = await page.locator('textarea[placeholder*="Ask"], input[placeholder*="Ask"]');
    await input.fill('Hello, test message');
    
    console.log('4. Taking screenshot after typing...');
    await page.screenshot({ path: 'after-typing.png' });
    
    console.log('5. Pressing Enter...');
    await page.keyboard.press('Enter');
    
    console.log('6. Waiting 3 seconds...');
    await page.waitForTimeout(3000);
    
    console.log('7. Taking screenshot after submit...');
    await page.screenshot({ path: 'after-submit.png', fullPage: true });
    
    const url = page.url();
    console.log('8. Final URL:', url);
    
    // Check page content
    const pageContent = await page.content();
    const hasMessages = pageContent.includes('Hello, test message');
    console.log('9. Message found in page:', hasMessages);
    
    // Check for any visible text
    const bodyText = await page.locator('body').textContent();
    console.log('10. Page text includes:', bodyText.substring(0, 200));
    
    console.log('\nKeeping browser open for 20 seconds...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

simpleTest();