// Script to test the chat UI and capture the actual request
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
  });
  const page = await browser.newPage();

  // Enable request interception
  await page.setRequestInterception(true);

  // Log all requests to /api/chat
  page.on('request', (request) => {
    if (request.url().includes('/api/chat')) {
    }
    request.continue();
  });

  // Log responses
  page.on('response', (response) => {
    if (response.url().includes('/api/chat')) {
      response
        .text()
        .then((_body) => {})
        .catch(() => {});
    }
  });

  // Navigate to the app
  await page.goto('http://localhost:3000');

  // Wait for the page to load
  await page.waitForSelector('textarea', { timeout: 5000 });

  // Type a message
  await page.type('textarea', 'Hello, tell me about RoboRail');

  // Press Enter or click send button
  await page.keyboard.press('Enter');

  // Wait a bit to see the response
  await page.waitForTimeout(5000);

  // Keep browser open for inspection
  // await browser.close();
})();
