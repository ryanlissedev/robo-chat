import { expect, test } from '@playwright/test';

test.describe('Mock streaming page', () => {
  test('renders reasoning and assistant text via AI SDK v5 stream', async ({ page }) => {
    // Navigate to the mock debug page that streams UIMessage events
    await page.goto('/test-mock');

    // Sanity: page title present
    await expect(page.getByRole('heading', { name: 'Test Mock Chat - Debugging AI SDK v5' })).toBeVisible();

    // Enter a short prompt and submit
    const input = page.getByPlaceholder('Type a message...');
    await input.fill('test streaming');
    await page.getByRole('button', { name: 'Send' }).click();

    // While streaming, we should see a streaming indicator
    await expect(page.getByText('Streaming...')).toBeVisible();

    // Reasoning deltas appear in a highlighted box
    await expect(page.getByText('REASONING:')).toBeVisible();
    await expect(page.getByText(/I should provide a helpful response/i)).toBeVisible();

    // Final assistant text accumulates; assert a distinctive substring
    await expect(
      page.getByText(/This is a test response from the mock API/i)
    ).toBeVisible();

    // Streaming should finish; indicator disappears eventually
    await expect(page.getByText('Streaming...')).toBeHidden({ timeout: 10000 });
  });
});

