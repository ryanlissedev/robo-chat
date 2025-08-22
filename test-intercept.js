// Script to test the chat UI and capture the actual request
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true 
  });
  const page = await browser.newPage();

  // Enable request interception
  await page.setRequestInterception(true);

  // Log all requests to /api/chat
  page.on('request', request => {
    if (request.url().includes('/api/chat')) {
      console.log('=== CHAT API REQUEST ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', request.headers());
      console.log('Post Data:', request.postData());
      console.log('========================');
    }
    request.continue();
  });

  // Log responses
  page.on('response', response => {
    if (response.url().includes('/api/chat')) {
      console.log('=== CHAT API RESPONSE ===');
      console.log('Status:', response.status());
      console.log('Headers:', response.headers());
      response.text().then(body => {
        console.log('Body:', body);
        console.log('=========================');
      }).catch(() => {});
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
  
  console.log('Test complete. Check the console output above for request details.');
  
  // Keep browser open for inspection
  // await browser.close();
})();