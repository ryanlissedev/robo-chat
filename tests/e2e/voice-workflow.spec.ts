import { expect } from '@playwright/test';
import {
  interceptNetworkRequests,
  mockApiResponse,
  takeScreenshotOnFailure,
  test,
} from './fixtures';

// Mock audio/media APIs for E2E testing
async function mockMediaAPIs(page: any) {
  await page.addInitScript(() => {
    // Mock MediaRecorder
    class MockMediaRecorder extends EventTarget {
      state = 'inactive';
      stream: MediaStream;

      constructor(stream: MediaStream) {
        super();
        this.stream = stream;
      }

      start() {
        this.state = 'recording';
        setTimeout(() => {
          this.dispatchEvent(new Event('start'));
          // Simulate data available after 1 second
          setTimeout(() => {
            this.dispatchEvent(new Event('dataavailable'));
          }, 1000);
        }, 100);
      }

      stop() {
        this.state = 'inactive';
        setTimeout(() => {
          this.dispatchEvent(new Event('stop'));
        }, 100);
      }
    }

    (window as any).MediaRecorder = MockMediaRecorder;

    // Mock getUserMedia
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        const mockStream = {
          getTracks: () => [{ stop: () => {}, kind: 'audio' }],
          getAudioTracks: () => [{ stop: () => {}, kind: 'audio' }],
        } as MediaStream;
        return mockStream;
      };
    }

    // Mock AudioContext
    (window as any).AudioContext = class MockAudioContext {
      state = 'running';

      createAnalyser() {
        return {
          connect: () => {},
          disconnect: () => {},
          fftSize: 256,
          frequencyBinCount: 128,
          getByteFrequencyData: () => {},
        };
      }

      createMediaStreamSource() {
        return {
          connect: () => {},
        };
      }

      close() {
        this.state = 'closed';
      }
    };
  });
}

test.describe('Voice Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock media APIs
    await mockMediaAPIs(page);

    // Mock voice transcripts API endpoints
    await mockApiResponse(page, '/api/voice/transcripts', {
      success: true,
      vectorStoreId: 'vs-e2e-test',
      fileId: 'file-e2e-test',
      message: 'Transcript indexed successfully',
      metadata: {
        filename: 'transcript_e2e-session_20241224.txt',
        vectorStoreFileId: 'vs-file-e2e-test',
      },
    });

    // Mock chat API endpoints
    await mockApiResponse(page, '/api/chat', {
      content: 'This is a mock AI response to the voice transcript.',
      usage: { total_tokens: 100 },
    });
  });

  test('should complete full voice workflow - record, transcribe, edit, index, and send to chat', async ({
    page,
    chatPage,
  }, testInfo) => {
    // Navigate to the chat page
    await chatPage.chatInput();

    // Intercept network requests for verification
    const requests = await interceptNetworkRequests(page);

    // Step 1: Start voice recording
    await page.click('[data-testid="voice-button"]');

    // Verify recording started
    await page.waitForSelector(
      '[data-testid="voice-button"][data-recording="true"]',
      {
        timeout: 5000,
      }
    );

    // Verify audio visualizer is active
    await expect(
      page.locator('[data-testid="audio-visualizer"]')
    ).toBeVisible();

    // Wait for recording to establish
    await page.waitForTimeout(2000);

    // Step 2: Stop recording
    await page.click('[data-testid="voice-button"]');

    // Verify recording stopped
    await page.waitForSelector(
      '[data-testid="voice-button"][data-recording="false"]',
      {
        timeout: 5000,
      }
    );

    // Step 3: Wait for transcription panel to appear with mock transcript
    await page.evaluate(() => {
      // Simulate receiving transcript from WebRTC/voice processing
      window.postMessage(
        {
          type: 'voice-transcript',
          data: {
            transcript: 'This is a test voice transcript from E2E testing',
            sessionId: 'e2e-test-session',
            personalityMode: 'safety-focused',
            timestamp: new Date().toISOString(),
          },
        },
        '*'
      );
    });

    await page.waitForSelector('[data-testid="transcription-panel"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify transcript content
    await expect(page.locator('[data-testid="transcript-text"]')).toContainText(
      'This is a test voice transcript from E2E testing'
    );

    // Step 4: Edit the transcript
    await page.click('[data-testid="edit-transcript-button"]');

    // Wait for edit mode
    await page.waitForSelector('[data-testid="transcript-textarea"]', {
      state: 'visible',
    });

    // Clear and type new content
    const textarea = page.locator('[data-testid="transcript-textarea"]');
    await textarea.fill(
      'Edited transcript: Hello, this is my voice message for testing.'
    );

    // Save the edit
    await page.click('[data-testid="save-transcript-button"]');

    // Verify edit was saved
    await expect(page.locator('[data-testid="transcript-text"]')).toContainText(
      'Edited transcript: Hello, this is my voice message for testing.'
    );

    // Step 5: Index the transcript to vector store
    await page.click('[data-testid="index-transcript-button"]');

    // Wait for indexing to complete
    await page.waitForSelector(
      '[data-testid="indexing-status"][data-status="completed"]',
      {
        timeout: 10000,
      }
    );

    // Verify indexing success message
    await expect(
      page.locator('[data-testid="indexing-message"]')
    ).toContainText('Transcript indexed successfully');

    // Step 6: Send transcript to chat
    await page.click('[data-testid="send-to-chat-button"]');

    // Verify transcript appears in chat input
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toHaveValue(
      'Edited transcript: Hello, this is my voice message for testing.'
    );

    // Step 7: Send the message to AI
    await chatPage.sendMessage(
      'Edited transcript: Hello, this is my voice message for testing.'
    );

    // Wait for AI response
    await chatPage.waitForResponse();

    // Verify AI response appears
    const lastMessage = await chatPage.getLastMessage();
    expect(lastMessage).toContain('This is a mock AI response');

    // Step 8: Verify API calls were made correctly
    const transcriptRequest = requests.find(
      (req) =>
        req.url.includes('/api/voice/transcripts') && req.method === 'POST'
    );
    expect(transcriptRequest).toBeTruthy();

    const chatRequest = requests.find(
      (req) => req.url.includes('/api/chat') && req.method === 'POST'
    );
    expect(chatRequest).toBeTruthy();

    // Take screenshot on failure for debugging
    await takeScreenshotOnFailure(page, testInfo);
  });

  test('should handle voice recording errors gracefully', async ({
    page,
    chatPage,
  }, testInfo) => {
    await chatPage.chatInput();

    // Mock getUserMedia to fail
    await page.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new Error('Permission denied');
        };
      }
    });

    // Try to start recording
    await page.click('[data-testid="voice-button"]');

    // Should show error message
    await page.waitForSelector('[data-testid="voice-error"]', {
      state: 'visible',
      timeout: 5000,
    });

    await expect(page.locator('[data-testid="voice-error"]')).toContainText(
      'Permission denied'
    );

    // Voice button should remain in inactive state
    await expect(page.locator('[data-testid="voice-button"]')).toHaveAttribute(
      'data-recording',
      'false'
    );

    await takeScreenshotOnFailure(page, testInfo);
  });

  test('should handle transcript indexing failures', async ({
    page,
    chatPage,
  }, testInfo) => {
    await chatPage.chatInput();

    // Mock API to return error
    await page.route('**/api/voice/transcripts', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to index transcript',
          details: 'OpenAI API Error: Rate limit exceeded',
        }),
      });
    });

    await mockMediaAPIs(page);

    // Record and generate transcript
    await page.click('[data-testid="voice-button"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="voice-button"]');

    // Simulate transcript
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'voice-transcript',
          data: {
            transcript: 'Test transcript for error handling',
            sessionId: 'error-test-session',
          },
        },
        '*'
      );
    });

    await page.waitForSelector('[data-testid="transcription-panel"]');

    // Try to index transcript
    await page.click('[data-testid="index-transcript-button"]');

    // Should show error state
    await page.waitForSelector(
      '[data-testid="indexing-status"][data-status="failed"]',
      {
        timeout: 10000,
      }
    );

    await expect(page.locator('[data-testid="indexing-error"]')).toContainText(
      'Failed to index transcript'
    );

    await takeScreenshotOnFailure(page, testInfo);
  });

  test('should maintain voice session state across component interactions', async ({
    page,
    chatPage,
  }, testInfo) => {
    await chatPage.chatInput();
    await mockMediaAPIs(page);

    // Start recording
    await page.click('[data-testid="voice-button"]');
    await page.waitForTimeout(1000);

    // Verify session is active
    await expect(
      page.locator('[data-testid="voice-session-status"]')
    ).toHaveText('Recording');

    // Check if personality selector is visible and working
    await page.click('[data-testid="personality-selector"]');
    await page.waitForSelector('[data-testid="personality-options"]', {
      state: 'visible',
    });

    // Select different personality
    await page.click('[data-testid="personality-option-technical-expert"]');

    // Verify personality changed
    await expect(
      page.locator('[data-testid="selected-personality"]')
    ).toContainText('Technical Expert');

    // Stop recording
    await page.click('[data-testid="voice-button"]');

    // Verify session completed with correct personality
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'voice-transcript',
          data: {
            transcript: 'Technical discussion about software architecture',
            sessionId: 'state-test-session',
            personalityMode: 'technical-expert',
          },
        },
        '*'
      );
    });

    await page.waitForSelector('[data-testid="transcription-panel"]');

    // Verify personality is reflected in the panel
    await expect(
      page.locator('[data-testid="session-personality"]')
    ).toContainText('Technical Expert');

    await takeScreenshotOnFailure(page, testInfo);
  });

  test('should support voice transcript search functionality', async ({
    page,
    chatPage,
  }, testInfo) => {
    await chatPage.chatInput();

    // Mock search API
    await page.route('**/api/voice/transcripts?*', async (route) => {
      const url = route.request().url();
      if (url.includes('query=')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            vectorStoreId: 'vs-search-test',
            fileCount: 5,
            totalUsageBytes: 8192,
            query: 'technical discussion',
            message:
              'Vector store found. Use OpenAI Assistants API for semantic search.',
          }),
        });
      }
    });

    // Navigate to voice search interface
    await page.click('[data-testid="voice-search-button"]');

    // Wait for search panel
    await page.waitForSelector('[data-testid="voice-search-panel"]', {
      state: 'visible',
    });

    // Enter search query
    const searchInput = page.locator('[data-testid="voice-search-input"]');
    await searchInput.fill('technical discussion');

    // Execute search
    await page.click('[data-testid="execute-search-button"]');

    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify search results
    await expect(
      page.locator('[data-testid="search-results-count"]')
    ).toContainText('5 files');
    await expect(
      page.locator('[data-testid="search-vector-store"]')
    ).toContainText('vs-search-test');

    await takeScreenshotOnFailure(page, testInfo);
  });

  test('should integrate voice workflow with multi-model chat', async ({
    page,
    chatPage,
    modelSelector,
  }, testInfo) => {
    await chatPage.chatInput();
    await mockMediaAPIs(page);

    // Select specific model for voice interaction
    await modelSelector.openModelSelector();
    await modelSelector.selectModel('gpt-4');

    // Verify model selection
    const selectedModel = await modelSelector.getSelectedModel();
    expect(selectedModel).toContain('GPT-4');

    // Record voice message
    await page.click('[data-testid="voice-button"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="voice-button"]');

    // Generate transcript
    await page.evaluate(() => {
      window.postMessage(
        {
          type: 'voice-transcript',
          data: {
            transcript:
              'Please analyze this data using advanced reasoning capabilities',
            sessionId: 'multimodel-test-session',
          },
        },
        '*'
      );
    });

    await page.waitForSelector('[data-testid="transcription-panel"]');

    // Send to chat with selected model
    await page.click('[data-testid="send-to-chat-button"]');

    // Verify the model is still selected for the voice-generated message
    const currentModel = await modelSelector.getSelectedModel();
    expect(currentModel).toContain('GPT-4');

    // Send the message
    await chatPage.sendMessage(
      'Please analyze this data using advanced reasoning capabilities'
    );
    await chatPage.waitForResponse();

    // Verify response received
    const response = await chatPage.getLastMessage();
    expect(response).toContain('mock AI response');

    await takeScreenshotOnFailure(page, testInfo);
  });
});
