import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(_config: FullConfig) {
  // Launch browser for authentication setup if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for the app to be ready
    await page
      .waitForSelector('[data-testid="app-ready"]', {
        timeout: 30_000,
        state: 'attached',
      })
      .catch(() => {
        // If no specific ready indicator, just wait for body
        return page.waitForSelector('body');
      });

    // You can add authentication setup here if needed
    // For example, if you need to log in a test user:
    /*
    await page.goto('/auth/signin')
    await page.fill('[data-testid="email-input"]', 'test@example.com')
    await page.fill('[data-testid="password-input"]', 'test-password')
    await page.click('[data-testid="signin-button"]')
    await page.waitForURL('/dashboard')
    
    // Save authentication state
    await context.storageState({ path: './tests/e2e/auth.json' })
    */
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
