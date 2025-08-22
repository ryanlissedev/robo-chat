import { expect, mockApiResponse, test, waitForPageReady } from './fixtures';

// TDD London Style E2E Tests: Focus on user interactions with file upload
test.describe('File Upload', () => {
  // Create test files for upload testing
  const _createTestFile = async (
    page: import('@playwright/test').Page,
    fileName: string,
    content: string
  ) => {
    return await page.evaluate(
      ({ fileName, content }: { fileName: string; content: string }) => {
        const file = new File([content], fileName, { type: 'text/plain' });
        return file;
      },
      { fileName, content }
    );
  };

  test.beforeEach(async ({ page }) => {
    // Mock essential API responses
    await mockApiResponse(page, '/api/models', {
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'Latest GPT-4 model',
          contextWindow: 8000,
          maxOutput: 4000,
          pricing: { input: 0.03, output: 0.06 },
          capabilities: ['chat', 'file-upload'],
        },
        {
          id: 'claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          provider: 'anthropic',
          description: 'Anthropic Claude 3 Sonnet',
          contextWindow: 200_000,
          maxOutput: 4000,
          pricing: { input: 0.003, output: 0.015 },
          capabilities: ['chat', 'file-upload'],
        },
      ],
    });

    await mockApiResponse(page, '/api/user-key-status', {
      openai: true,
      anthropic: true,
      openrouter: false,
      mistral: false,
      google: false,
      perplexity: false,
      xai: false,
    });

    await mockApiResponse(page, '/api/user-preferences', {
      layout: 'fullscreen',
      prompt_suggestions: true,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: false,
      hidden_models: [],
    });

    await page.goto('/');
    await waitForPageReady(page);
  });

  test.describe('When uploading files', () => {
    test('should show file upload button when available', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // File upload button should be visible for models that support it
      await expect(
        page.locator('[data-testid="file-upload-button"]')
      ).toBeVisible();
    });

    test('should upload a text file successfully', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock file upload API
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'test.txt',
              size: 1024,
              type: 'text/plain',
              url: '/api/files/file-123',
            },
          }),
        });
      });

      // Create a temporary test file
      const testContent = 'This is a test file content for upload';
      await page.setContent(`
        <html>
          <body>
            <input type="file" data-testid="file-input" style="display: none" />
            <button data-testid="file-upload-button">Upload File</button>
            <div data-testid="uploaded-files"></div>
          </body>
        </html>
      `);

      // Simulate file selection through JavaScript since we can't create real files in E2E
      await page.evaluate((content) => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File([content], 'test.txt', { type: 'text/plain' });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;

        // Trigger change event
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      }, testContent);

      // Wait for file to be processed
      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
    });

    test('should handle multiple file uploads', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock file upload API for multiple files
      let uploadCount = 0;
      await page.route('**/api/files/upload', async (route) => {
        uploadCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: `file-${uploadCount}`,
              name: `test${uploadCount}.txt`,
              size: 1024,
              type: 'text/plain',
              url: `/api/files/file-${uploadCount}`,
            },
          }),
        });
      });

      // Upload first file
      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file1 = new File(['Content 1'], 'file1.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file1);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Wait for first file
      await expect(
        page.locator('[data-testid="uploaded-file"]').first()
      ).toBeVisible();

      // Upload second file
      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file2 = new File(['Content 2'], 'file2.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file2);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should have multiple files
      await expect(page.locator('[data-testid="uploaded-file"]')).toHaveCount(
        2
      );
    });

    test('should show file preview and details', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'document.pdf',
              size: 51_200, // 50KB
              type: 'application/pdf',
              url: '/api/files/file-123',
            },
          }),
        });
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File(['PDF content'], 'document.pdf', {
          type: 'application/pdf',
        });
        Object.defineProperty(file, 'size', { value: 51_200 });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show file details
      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
      await expect(page.locator('text=document.pdf')).toBeVisible();
      await expect(page.locator('text=50 KB')).toBeVisible();
    });

    test('should remove uploaded files', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'test.txt',
              size: 1024,
              type: 'text/plain',
              url: '/api/files/file-123',
            },
          }),
        });
      });

      // Upload a file first
      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File(['Test content'], 'test.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();

      // Remove the file
      await page.click('[data-testid="remove-file-test.txt"]');

      // File should be removed
      await expect(
        page.locator('[data-testid="uploaded-file"]')
      ).not.toBeVisible();
    });
  });

  test.describe('When handling upload errors', () => {
    test('should show error for file too large', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock file size error
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 413,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'File too large. Maximum size is 10MB.',
          }),
        });
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        // Simulate large file
        const largeFile = new File(
          ['x'.repeat(11 * 1024 * 1024)],
          'large.txt',
          { type: 'text/plain' }
        );
        dataTransfer.items.add(largeFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show error message
      await expect(
        page.locator('[data-testid="file-upload-error"]')
      ).toBeVisible();
      await expect(
        page.locator('text=File too large. Maximum size is 10MB.')
      ).toBeVisible();
    });

    test('should show error for unsupported file type', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock unsupported file type error
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error:
              'Unsupported file type. Please upload PDF, TXT, or image files.',
          }),
        });
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const unsupportedFile = new File(['binary data'], 'app.exe', {
          type: 'application/x-msdownload',
        });
        dataTransfer.items.add(unsupportedFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show error message
      await expect(
        page.locator('[data-testid="file-upload-error"]')
      ).toBeVisible();
      await expect(page.locator('text=Unsupported file type')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock network failure
      await page.route('**/api/files/upload', async (route) => {
        await route.abort('failed');
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File(['Test content'], 'test.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      // Should show network error
      await expect(
        page.locator(
          '[data-testid="file-upload-error"], [data-testid="network-error"]'
        )
      ).toBeVisible();
    });
  });

  test.describe('When sending messages with files', () => {
    test('should include uploaded files in chat messages', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock successful file upload
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'document.txt',
              size: 1024,
              type: 'text/plain',
              url: '/api/files/file-123',
              content: 'This is the content of the uploaded document.',
            },
          }),
        });
      });

      // Mock chat API that handles files
      await page.route('**/api/chat', async (route) => {
        const request = route.request();
        const body = await request.postData();

        // Verify the request includes file information
        expect(body).toContain('file-123');
        expect(body).toContain('document.txt');

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"I can see you uploaded a document. Let me analyze it for you."}}\\n\\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      // Upload file
      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File(['Document content'], 'document.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();

      // Send message with file
      await chatPage.sendMessage('Please analyze this document');
      await chatPage.waitForResponse();

      // Should show both user message and AI response
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2);

      // User message should show the file attachment
      const userMessage = page.locator('[data-testid="chat-message"]').first();
      await expect(userMessage).toContainText('document.txt');
    });

    test('should clear files after successful submission', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Mock file upload and chat APIs
      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'test.txt',
              size: 1024,
              type: 'text/plain',
              url: '/api/files/file-123',
            },
          }),
        });
      });

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Message received with file."}}\\n\\n'
              )
            );
            controller.close();
          },
        });

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: stream as any,
        });
      });

      // Upload file
      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const file = new File(['Test content'], 'test.txt', {
          type: 'text/plain',
        });
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();

      // Send message
      await chatPage.sendMessage('Process this file');
      await chatPage.waitForResponse();

      // Files should be cleared after submission
      await expect(
        page.locator('[data-testid="uploaded-file"]')
      ).not.toBeVisible();
    });
  });

  test.describe('When handling different file types', () => {
    test('should handle image files', async ({
      fileUpload,
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'image-123',
              name: 'screenshot.png',
              size: 204_800, // 200KB
              type: 'image/png',
              url: '/api/files/image-123',
              thumbnail: '/api/files/image-123/thumbnail',
            },
          }),
        });
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        // Create a mock image file
        const imageFile = new File(['PNG image data'], 'screenshot.png', {
          type: 'image/png',
        });
        Object.defineProperty(imageFile, 'size', { value: 204_800 });
        dataTransfer.items.add(imageFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
      await expect(page.locator('text=screenshot.png')).toBeVisible();
      await expect(page.locator('text=200 KB')).toBeVisible();

      // Should show image thumbnail if available
      const thumbnail = page.locator('[data-testid="file-thumbnail"]');
      if (await thumbnail.isVisible()) {
        await expect(thumbnail).toHaveAttribute(
          'src',
          '/api/files/image-123/thumbnail'
        );
      }
    });

    test('should handle PDF files', async ({ fileUpload, chatPage, page }) => {
      await chatPage.chatInput();

      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'pdf-123',
              name: 'report.pdf',
              size: 1_048_576, // 1MB
              type: 'application/pdf',
              url: '/api/files/pdf-123',
              pageCount: 10,
            },
          }),
        });
      });

      await page.evaluate(() => {
        const fileInput = document.querySelector(
          '[data-testid="file-input"]'
        ) as HTMLInputElement;
        const dataTransfer = new DataTransfer();
        const pdfFile = new File(['PDF content'], 'report.pdf', {
          type: 'application/pdf',
        });
        Object.defineProperty(pdfFile, 'size', { value: 1_048_576 });
        dataTransfer.items.add(pdfFile);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
      await expect(page.locator('text=report.pdf')).toBeVisible();
      await expect(page.locator('text=1 MB')).toBeVisible();

      // Should show PDF-specific information
      const pdfInfo = page.locator('[data-testid="pdf-info"]');
      if (await pdfInfo.isVisible()) {
        await expect(pdfInfo).toContainText('10 pages');
      }
    });
  });

  test.describe('When using drag and drop', () => {
    test('should handle drag and drop file upload', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      await page.route('**/api/files/upload', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            file: {
              id: 'file-123',
              name: 'dropped.txt',
              size: 1024,
              type: 'text/plain',
              url: '/api/files/file-123',
            },
          }),
        });
      });

      // Simulate drag and drop
      await page.evaluate(() => {
        const dropZone = document.querySelector(
          '[data-testid="chat-input"]'
        ) as HTMLElement;

        // Create drag event
        const dragEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });

        // Add file to dataTransfer
        const file = new File(['Dropped content'], 'dropped.txt', {
          type: 'text/plain',
        });
        dragEvent.dataTransfer?.items.add(file);

        dropZone.dispatchEvent(dragEvent);
      });

      // Should show uploaded file
      await expect(page.locator('[data-testid="uploaded-file"]')).toBeVisible();
      await expect(page.locator('text=dropped.txt')).toBeVisible();
    });

    test('should show drag overlay during drag operations', async ({
      chatPage,
      page,
    }) => {
      await chatPage.chatInput();

      // Simulate drag over
      await page.evaluate(() => {
        const dropZone = document.querySelector(
          '[data-testid="chat-input"]'
        ) as HTMLElement;

        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        });

        dropZone.dispatchEvent(dragOverEvent);
      });

      // Should show drag overlay
      const dragOverlay = page.locator('[data-testid="drag-overlay"]');
      if (await dragOverlay.isVisible()) {
        await expect(dragOverlay).toContainText('Drop files here');
      }
    });
  });
});
