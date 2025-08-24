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
        await page.waitForSelector('[data-testid="chat-input"]', {
          state: 'visible',
        });
      },

      sendMessage: async (message: string) => {
        const input = page.locator('[data-testid="chat-input"]');

        // Focus the input first
        await input.click();
        await page.waitForTimeout(100);

        // Use Playwright's native methods to avoid DOM context issues
        await input.fill(''); // Clear first
        await input.fill(message);

        // Trigger additional events to ensure React state updates
        await input.press('Space'); // Trigger any onChange handlers
        await input.press('Backspace'); // Remove the space

        // Alternative approach: use keyboard to type character by character
        // This is more reliable for React components
        await input.fill(''); // Clear again
        await input.type(message, { delay: 10 });

        // Wait for React state to update
        await page.waitForTimeout(300);

        // Verify the input has the expected value
        const inputValue = await input.inputValue();
        if (inputValue !== message) {
          // Try one more time with direct fill
          await input.fill(message);
          await page.waitForTimeout(100);
        }

        // Wait for the send button to become enabled
        await page.waitForSelector(
          '[data-testid="send-button"]:not([disabled])',
          {
            timeout: 5000,
          }
        );

        await page.click('[data-testid="send-button"]');
      },

      waitForResponse: async () => {
        // Wait for the loading indicator to appear and then disappear
        await page
          .waitForSelector('[data-testid="message-loading"]', {
            state: 'visible',
          })
          .catch(() => {}); // Might already be present
        await page
          .waitForSelector('[data-testid="message-loading"]', {
            state: 'hidden',
          })
          .catch(() => {}); // Might already be hidden
      },

      getLastMessage: async () => {
        const messages = page.locator('[data-testid="chat-message"]');
        const lastMessage = messages.last();
        return (await lastMessage.textContent()) || '';
      },

      selectModel: async (modelName: string) => {
        await page.click('[data-testid="model-selector-trigger"]');
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'visible',
        });
        await page.click(`[data-testid="model-option-${modelName}"]`);
      },

      uploadFile: async (filePath: string) => {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
      },

      clearChat: async () => {
        await page.click('[data-testid="clear-chat-button"]');
        if (await page.isVisible('[data-testid="confirm-clear-dialog"]')) {
          await page.click('[data-testid="confirm-clear-button"]');
        }
      },
    };

    await use(chatPage);
  },

  modelSelector: async ({ page }, use) => {
    const modelSelector: ModelSelectorFixture = {
      openModelSelector: async () => {
        await page.click('[data-testid="model-selector-trigger"]');
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'visible',
        });
      },

      selectModel: async (modelName: string) => {
        await page.click(`[data-testid="model-option-${modelName}"]`);
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'hidden',
        });
      },

      closeModelSelector: async () => {
        await page.keyboard.press('Escape');
        await page.waitForSelector('[data-testid="model-selector-content"]', {
          state: 'hidden',
        });
      },

      getSelectedModel: async () => {
        const selectedModel = page.locator(
          '[data-testid="selected-model-name"]'
        );
        return (await selectedModel.textContent()) || '';
      },
    };

    await use(modelSelector);
  },

  fileUpload: async ({ page }, use) => {
    const fileUpload: FileUploadFixture = {
      openFileDialog: async () => {
        await page.click('[data-testid="file-upload-button"]');
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
        });
      },

      removeFile: async (fileName: string) => {
        await page.click(`[data-testid="remove-file-${fileName}"]`);
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
}

export async function mockApiResponse(
  page: Page,
  endpoint: string,
  response: any
) {
  await page.route(`**${endpoint}`, async (route) => {
    await route.fulfill({
      status: 200,
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
    });
  });

  return requests;
}

export async function takeScreenshotOnFailure(page: Page, testInfo: TestInfo) {
  if (testInfo.status !== 'passed') {
    const screenshot = await page.screenshot();
    await testInfo.attach('screenshot', {
      body: screenshot,
      contentType: 'image/png',
    });
  }
}
