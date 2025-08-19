import { expect, test } from '@playwright/test';

// Constants for timeouts
const HYDRATION_WAIT = 3000;
const API_WAIT = 5000;

// Regex patterns
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_PATTERN = /GPT|gpt|Mini|mini/i;

// HTTP status codes
const HTTP_OK = 200;

interface ApiRequest {
  url: string;
  status: number;
}

test.describe('Guest User Functionality', () => {
  test('should allow guest users to access and use the chat interface', async ({
    page,
  }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');

    // Wait for the application to load completely
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(HYDRATION_WAIT);

    // Verify no authentication is required
    await expect(page.locator('text=Sign in')).not.toBeVisible();

    // Check that the chat interface is accessible
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 15_000 });

    // Verify model selector is accessible - look for any button with model names
    const modelSelector = page
      .locator('button')
      .filter({ hasText: MODEL_PATTERN })
      .first();
    await expect(modelSelector).toBeVisible({ timeout: 10_000 });

    console.log('✅ Guest user can access chat interface and model selector');
  });

  test('should verify models API is accessible to guest users', async ({
    page,
  }) => {
    // Set up response listener before navigation
    const modelRequests: ApiRequest[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/models')) {
        modelRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(HYDRATION_WAIT);

    // Wait for models API call to complete (should happen automatically on page load)
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/models') && response.status() === HTTP_OK,
      { timeout: 15_000 }
    );

    // Verify models API was called successfully
    expect(modelRequests.length).toBeGreaterThan(0);
    expect(modelRequests[0].status).toBe(HTTP_OK);

    console.log('✅ Guest user model access verified');
  });

  test('should verify guest user can interact with the interface', async ({
    page,
  }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(HYDRATION_WAIT);

    // Check that the chat interface is accessible
    const messageInput = page.locator('textarea').first();
    await expect(messageInput).toBeVisible({ timeout: 15_000 });

    // Verify we can type in the input
    await messageInput.fill('Test message');
    const inputValue = await messageInput.inputValue();
    expect(inputValue).toBe('Test message');

    // Verify model selector is accessible
    const modelSelector = page
      .locator('button')
      .filter({ hasText: MODEL_PATTERN })
      .first();
    await expect(modelSelector).toBeVisible({ timeout: 10_000 });

    console.log('✅ Guest user interface interaction verified');
  });
});
