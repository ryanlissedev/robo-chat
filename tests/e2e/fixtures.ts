import type { Page } from '@playwright/test';
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
        
        // Try to directly call React's onChange handler using React's internal fiber system
        await page.evaluate((text) => {
          const inputElement = document.querySelector('[data-testid="chat-input"]') as HTMLTextAreaElement;
          if (inputElement) {
            // Find React fiber node
            const reactFiberKey = Object.keys(inputElement).find(key => key.startsWith('__reactFiber'));
            if (reactFiberKey) {
              const fiber = (inputElement as any)[reactFiberKey];
              
              // Find the onChange handler in the fiber tree
              let currentFiber = fiber;
              let onChange = null;
              
              while (currentFiber && !onChange) {
                if (currentFiber.memoizedProps?.onChange) {
                  onChange = currentFiber.memoizedProps.onChange;
                  break;
                }
                currentFiber = currentFiber.return;
              }
              
              if (onChange) {
                // Set the value directly first
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
                if (nativeInputValueSetter) {
                  nativeInputValueSetter.call(inputElement, text);
                }
                
                // Create a synthetic event that React expects
                const syntheticEvent = {
                  target: inputElement,
                  currentTarget: inputElement,
                  type: 'change',
                  bubbles: true,
                  cancelable: true,
                  preventDefault: () => {},
                  stopPropagation: () => {},
                  nativeEvent: new Event('change', { bubbles: true }),
                };
                
                // Call React's onChange handler directly
                onChange(syntheticEvent);
                console.log('Called React onChange handler directly');
              } else {
                console.log('Could not find React onChange handler');
                
                // Fallback: dispatch native events
                inputElement.value = text;
                const inputEvent = new Event('input', { bubbles: true });
                const changeEvent = new Event('change', { bubbles: true });
                inputElement.dispatchEvent(inputEvent);
                inputElement.dispatchEvent(changeEvent);
              }
            } else {
              console.log('Could not find React fiber node');
              // Fallback: simple value set and events
              inputElement.value = text;
              const inputEvent = new Event('input', { bubbles: true });
              const changeEvent = new Event('change', { bubbles: true });
              inputElement.dispatchEvent(inputEvent);
              inputElement.dispatchEvent(changeEvent);
            }
          }
        }, message);
        
        // Wait for React state to update
        await page.waitForTimeout(300);
        
        // Check if it worked
        const inputValue = await input.inputValue();
        const buttonState = await page.locator('[data-testid="send-button"]').getAttribute('disabled');
        console.log(`Fiber approach - Input value: "${inputValue}", Button disabled: ${buttonState}`);
        
        // Wait for the send button to become enabled
        await page.waitForSelector('[data-testid="send-button"]:not([disabled])', {
          timeout: 5000,
        });
        
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

export async function takeScreenshotOnFailure(page: Page, testInfo: any) {
  if (testInfo.status === 'failed') {
    const screenshot = await page.screenshot();
    await testInfo.attach('screenshot', {
      body: screenshot,
      contentType: 'image/png',
    });
  }
}
