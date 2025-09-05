#!/usr/bin/env tsx

import { chromium } from 'playwright';

async function testChatUI() {
  console.log('🚀 Starting Chat UI Test...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    console.log('📱 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Check if the page loaded
    const title = await page.title();
    console.log(`✅ Page loaded with title: ${title}`);
    
    // Look for chat input
    const chatInput = await page.locator('textarea[placeholder*="Message"], input[placeholder*="Message"], [data-testid="chat-input"]').first();
    if (await chatInput.isVisible()) {
      console.log('✅ Chat input found');
      
      // Type a test message
      await chatInput.fill('Hello, testing GPT-5 integration!');
      console.log('✅ Typed test message');
      
      // Find and click send button
      const sendButton = await page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send-button"]').first();
      if (await sendButton.isVisible()) {
        await sendButton.click();
        console.log('✅ Clicked send button');
        
        // Wait for response (look for assistant message)
        console.log('⏳ Waiting for response...');
        const response = await page.waitForSelector(
          '[data-role="assistant"], .assistant-message, [class*="assistant"]',
          { timeout: 10000 }
        ).catch(() => null);
        
        if (response) {
          const responseText = await response.textContent();
          console.log('✅ Response received:', responseText?.substring(0, 100) + '...');
          console.log('\n🎉 Chat UI Test PASSED! Responses are displaying correctly.');
        } else {
          console.log('⚠️  No response received within 10 seconds');
          
          // Check console for errors
          const consoleMessages = await page.evaluate(() => {
            return window.console.logs || [];
          });
          console.log('Console messages:', consoleMessages);
        }
      } else {
        console.log('❌ Send button not found');
      }
    } else {
      console.log('❌ Chat input not found');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'chat-ui-debug.png' });
      console.log('📸 Screenshot saved as chat-ui-debug.png');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('📸 Error screenshot saved');
  } finally {
    await browser.close();
  }
}

testChatUI().catch(console.error);