#!/usr/bin/env node

/**
 * Browser-based chat test using Puppeteer
 * Tests the full chat flow in the browser
 */

const puppeteer = require('puppeteer');

async function testChatInBrowser() {
  console.log('🚀 Starting browser chat test...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for the chat interface to load
    console.log('⏳ Waiting for chat interface...');
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 10000 });
    
    // Type a test message
    const testMessage = 'Hello, can you hear me?';
    console.log(`📝 Typing message: "${testMessage}"`);
    await page.type('textarea[placeholder*="Message"]', testMessage);
    
    // Submit the message (press Enter or click send button)
    console.log('📤 Submitting message...');
    
    // Try to find and click the send button
    const sendButton = await page.$('button[type="submit"]');
    if (sendButton) {
      await sendButton.click();
    } else {
      // If no send button, try pressing Enter
      await page.keyboard.press('Enter');
    }
    
    // Wait for response
    console.log('⏳ Waiting for AI response...');
    
    // Wait for a message element that contains assistant content
    const responseReceived = await page.waitForFunction(
      () => {
        const messages = document.querySelectorAll('[data-role="assistant"], .assistant-message, [class*="assistant"]');
        return messages.length > 0 && messages[messages.length - 1].textContent.length > 0;
      },
      { timeout: 30000 }
    ).catch(err => {
      console.error('❌ Timeout waiting for response:', err.message);
      return false;
    });
    
    if (responseReceived) {
      // Get the response text
      const responseText = await page.evaluate(() => {
        const messages = document.querySelectorAll('[data-role="assistant"], .assistant-message, [class*="assistant"]');
        if (messages.length > 0) {
          return messages[messages.length - 1].textContent;
        }
        return null;
      });
      
      console.log('✅ Response received:', responseText ? responseText.substring(0, 100) + '...' : 'No text');
      
      // Check console for errors
      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));
      
      // Wait a bit for any delayed errors
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const errors = consoleMessages.filter(msg => msg.includes('error') || msg.includes('Error'));
      if (errors.length > 0) {
        console.log('⚠️ Console errors detected:', errors);
      }
      
      console.log('✅ Chat test completed successfully!');
      return true;
    } else {
      console.log('❌ No response received within timeout');
      
      // Try to get any error messages
      const errorMessage = await page.evaluate(() => {
        const errorElement = document.querySelector('[class*="error"], .error-message, [role="alert"]');
        return errorElement ? errorElement.textContent : null;
      });
      
      if (errorMessage) {
        console.log('❌ Error message found:', errorMessage);
      }
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'chat-test-failure.png' });
      console.log('📸 Screenshot saved as chat-test-failure.png');
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testChatInBrowser()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });