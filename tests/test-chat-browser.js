#!/usr/bin/env node

/**
 * Browser-based chat test using Puppeteer
 * Tests the full chat flow in the browser
 */

const puppeteer = require('puppeteer');

async function testChatInBrowser() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle2',
      timeout: 30_000,
    });
    await page.waitForSelector('textarea[placeholder*="Message"]', {
      timeout: 10_000,
    });

    // Type a test message
    const testMessage = 'Hello, can you hear me?';
    await page.type('textarea[placeholder*="Message"]', testMessage);

    // Try to find and click the send button
    const sendButton = await page.$('button[type="submit"]');
    if (sendButton) {
      await sendButton.click();
    } else {
      // If no send button, try pressing Enter
      await page.keyboard.press('Enter');
    }

    // Wait for a message element that contains assistant content
    const responseReceived = await page
      .waitForFunction(
        () => {
          const messages = document.querySelectorAll(
            '[data-role="assistant"], .assistant-message, [class*="assistant"]'
          );
          return messages.length > 0 && messages.at(-1).textContent.length > 0;
        },
        { timeout: 30_000 }
      )
      .catch((_err) => {
        return false;
      });

    if (responseReceived) {
      // Get the response text
      const _responseText = await page.evaluate(() => {
        const messages = document.querySelectorAll(
          '[data-role="assistant"], .assistant-message, [class*="assistant"]'
        );
        if (messages.length > 0) {
          return messages.at(-1).textContent;
        }
        return null;
      });

      // Check console for errors
      const consoleMessages = [];
      page.on('console', (msg) => consoleMessages.push(msg.text()));

      // Wait a bit for any delayed errors
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const errors = consoleMessages.filter(
        (msg) => msg.includes('error') || msg.includes('Error')
      );
      if (errors.length > 0) {
      }
      return true;
    }

    // Try to get any error messages
    const errorMessage = await page.evaluate(() => {
      const errorElement = document.querySelector(
        '[class*="error"], .error-message, [role="alert"]'
      );
      return errorElement ? errorElement.textContent : null;
    });

    if (errorMessage) {
    }

    // Take a screenshot for debugging
    await page.screenshot({ path: 'chat-test-failure.png' });

    return false;
  } catch (_error) {
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testChatInBrowser()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((_err) => {
    process.exit(1);
  });
