import type { Page, TestInfo } from '@playwright/test';
import { test as base } from '@playwright/test';

// Define page object models and fixtures for E2E tests
export type ChatPageFixture = {
  chatInput: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  waitForResponse: () => Promise<void>;
  getLastMessage: () => Promise<string>;
  selectModel: (modelName: string) => Promise<void>;
  uploadFile: (filePath: string) => Promise<void>;
  clearChat: () => Promise<void>;
};

export type ModelSelectorFixture = {
  openModelSelector: () => Promise<void>;
  selectModel: (modelName: string) => Promise<void>;
  closeModelSelector: () => Promise<void>;
  getSelectedModel: () => Promise<string>;
};

export type FileUploadFixture = {
  openFileDialog: () => Promise<void>;
  selectFile: (filePath: string) => Promise<void>;
  uploadFile: (filePath: string) => Promise<void>;
  removeFile: (fileName: string) => Promise<void>;
  getUploadedFiles: () => Promise<string[]>;
};

// Helper function for retry logic
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 500
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  throw new Error('Retry logic failed unexpectedly');
}

// Extend the base test with our custom fixtures
export const test = base.extend<{
  chatPage: ChatPageFixture;
  modelSelector: ModelSelectorFixture;
  fileUpload: FileUploadFixture;
}>({
  chatPage: async ({ page }, use) => {
    const chatPage: ChatPageFixture = {
      chatInput: async () => {
        await page.goto('/');
        // Wait for page to be fully loaded and interactive
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="chat-input"]', {
          state: 'visible',
          timeout: 15_000,
        });
      },

      sendMessage: async (message: string) => {
        const input = page.locator('[data-testid="chat-input"]');
        const sendButton = page.locator('[data-testid="send-button"]');

        // Reliable input filling with retry mechanism
        await withRetry(async () => {
          // Focus and clear the input
          await input.click();
          await input.clear();

          // Fill the message
          await input.fill(message);

          // Verify the input value
          const inputValue = await input.inputValue();
          if (inputValue !== message) {
            throw new Error(
              `Failed to fill input. Expected: "${message}", Got: "${inputValue}"`
            );
          }
        });

        // Wait for send button to be enabled
        await sendButton.waitFor({ state: 'visible', timeout: 10_000 });
        await page.waitForFunction(
          (button) => button && !button.disabled,
          sendButton.elementHandle(),
          { timeout: 10_000 }
        );

        await sendButton.click();
      },

      waitForResponse: async () => {
        // More robust response waiting with multiple fallback strategies
        try {
          // Strategy 1: Wait for loading indicator lifecycle
          await page.waitForSelector('[data-testid="message-loading"]', {
            state: 'visible',
            timeout: 5_000,
          });

          await page.waitForSelector('[data-testid="message-loading"]', {
            state: 'hidden',
            timeout: 45_000,
          });
        } catch (_error) {
          // Strategy 2: Wait for message count to increase
          const initialCount = await page
            .locator('[data-testid="chat-message"]')
            .count();
          await page.waitForFunction(
            (count) => {
              const messages = document.querySelectorAll(
                '[data-testid="chat-message"]'
              );
              return messages.length > count;
            },
            initialCount,
            { timeout: 45_000 }
          );
        }
      },

      getLastMessage: async () => {
        const messages = page.locator('[data-testid="chat-message"]');
        await messages.last().waitFor({ state: 'visible', timeout: 10_000 });
        return (await messages.last().textContent()) || '';
      },

      selectModel: async (modelName: string) => {
        const trigger = page.locator('[data-testid="model-selector-trigger"]');
        await trigger.click();

        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'visible',
          timeout: 10_000,
        });

        const option = page.locator(
          `[data-testid="model-option-${modelName}"]`
        );
        await option.waitFor({ state: 'visible', timeout: 10_000 });
        await option.click();
      },

      uploadFile: async (filePath: string) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
      },

      clearChat: async () => {
        const clearButton = page.locator('[data-testid="clear-chat-button"]');

        if (await clearButton.isVisible({ timeout: 2_000 })) {
          await clearButton.click();

          // Handle confirmation dialog if it appears
          try {
            const confirmDialog = page.locator(
              '[data-testid="confirm-clear-dialog"]'
            );
            await confirmDialog.waitFor({ state: 'visible', timeout: 3_000 });
            await page.click('[data-testid="confirm-clear-button"]');
          } catch {
            // No confirmation dialog appeared, that's fine
          }
        }
      },
    };

    await use(chatPage);
  },

  modelSelector: async ({ page }, use) => {
    const modelSelector: ModelSelectorFixture = {
      openModelSelector: async () => {
        const trigger = page.locator('[data-testid="model-selector-trigger"]');
        await trigger.click();
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'visible',
          timeout: 10_000,
        });
      },

      selectModel: async (modelName: string) => {
        const option = page.locator(
          `[data-testid="model-option-${modelName}"]`
        );
        await option.waitFor({ state: 'visible', timeout: 10_000 });
        await option.click();

        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'hidden',
          timeout: 10_000,
        });
      },

      closeModelSelector: async () => {
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'hidden',
          timeout: 10_000,
        });
      },

      getSelectedModel: async () => {
        const selectedModel = page.locator(
          '[data-testid="selected-model-name"]'
        );
        await selectedModel.waitFor({ state: 'visible', timeout: 10_000 });
        return (await selectedModel.textContent()) || '';
      },
    };

    await use(modelSelector);
  },

  fileUpload: async ({ page }, use) => {
    const fileUpload: FileUploadFixture = {
      openFileDialog: async () => {
        const uploadButton = page.locator('[data-testid="file-upload-button"]');
        await uploadButton.click();
      },

      selectFile: async (filePath: string) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
      },

      uploadFile: async (filePath: string) => {
        await page.click('[data-testid="file-upload-button"]');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);

        // Wait for the file to be processed and appear in the UI
        await page.waitForSelector('[data-testid="uploaded-file"]', {
          state: 'visible',
          timeout: 15_000,
        });
      },

      removeFile: async (fileName: string) => {
        const removeButton = page.locator(
          `[data-testid="remove-file-${fileName}"]`
        );
        await removeButton.click();
      },

      getUploadedFiles: async () => {
        const files = page.locator('[data-testid="uploaded-file"]');
        const fileNames: string[] = [];
        const count = await files.count();

        for (let i = 0; i < count; i++) {
          const fileName = await files.nth(i).getAttribute('data-filename');
          if (fileName) {
            fileNames.push(fileName);
          }
        }

        return fileNames;
      },
    };

    await use(fileUpload);
  },
});

// Custom expect assertions for E2E tests
export { expect } from '@playwright/test';

// Helper functions for common E2E test patterns
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('body', { state: 'visible' });

  // Additional check for app-specific readiness
  try {
    await page.waitForSelector('[data-testid="app-ready"]', {
      timeout: 10_000,
      state: 'attached',
    });
  } catch {
    // Fallback: just ensure basic elements are loaded
    await page.waitForSelector('main, #root, [data-testid="chat-input"]', {
      timeout: 10_000,
    });
  }
}

export async function mockApiResponse(
  page: Page,
  endpoint: string,
  response: any,
  options: { status?: number; delay?: number } = {}
) {
  const { status = 200, delay = 0 } = options;

  await page.route(`**${endpoint}`, async (route) => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

export async function interceptNetworkRequests(page: Page) {
  const requests: any[] = [];

  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
      timestamp: Date.now(),
    });
  });

  return requests;
}

export async function takeScreenshotOnFailure(page: Page, testInfo: TestInfo) {
  if (testInfo.status !== 'passed') {
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach('screenshot', {
      body: screenshot,
      contentType: 'image/png',
    });

    // Also capture HTML for debugging
    const html = await page.content();
    await testInfo.attach('page-source', {
      body: html,
      contentType: 'text/html',
    });
  }
}

// Optimized API mocking patterns
export async function mockApiRoutes(page: Page) {
  // Mock authentication endpoints
  await mockApiResponse(page, '/api/auth/**', { success: true });

  // Mock user settings endpoints
  await page.route('**/api/user/settings', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          theme: 'light',
          defaultModel: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 1000,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });

  // Mock chat endpoints with realistic streaming
  await page.route('**/api/chat', async (route) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Simulate realistic streaming response
        controller.enqueue(
          encoder.encode(
            'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Test response"}}\n\n'
          )
        );
        setTimeout(() => controller.close(), 100);
      },
    });

    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: stream as any,
    });
  });
}

// Create test user for authentication tests
export function createTestUser() {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
    createdAt: new Date().toISOString(),
  };
}

// Setup optimized test chat environment
export async function setupTestChat(page: Page) {
  // Navigate to chat page
  await page.goto('/');

  // Wait for full page load
  await waitForPageReady(page);

  // Setup comprehensive mocking
  await mockApiRoutes(page);

  return { ready: true };
}
