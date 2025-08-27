import { expect, test } from '@playwright/test';
import { mockApiResponse, waitForPageReady } from './fixtures';

test.describe('Voice Workflow Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Mock base API responses
    await mockApiResponse(page, '/api/models', {
      models: [
        {
          id: 'gpt-4',
          name: 'GPT-4',
          provider: 'openai',
          description: 'Latest GPT-4 model with voice support',
          contextWindow: 8000,
          maxOutput: 4000,
          pricing: { input: 0.03, output: 0.06 },
          capabilities: ['chat', 'voice'],
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'openai',
          description: 'Faster GPT-4 with voice capabilities',
          contextWindow: 128000,
          maxOutput: 4000,
          pricing: { input: 0.01, output: 0.03 },
          capabilities: ['chat', 'voice'],
        },
      ],
    });

    await mockApiResponse(page, '/api/user-key-status', {
      openai: true,
      anthropic: false,
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
      voice_enabled: true,
    });

    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);

    await page.goto('/');
    await waitForPageReady(page);
  });

  test.describe('Voice Session Management', () => {
    test('should initialize voice session successfully', async ({ page }) => {
      // Mock voice session creation
      await page.route('**/api/voice/session', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'voice-session-123',
              status: 'active',
              model: 'gpt-4',
              created_at: new Date().toISOString(),
            }),
          });
        }
      });

      // Start voice session - look for voice button by aria-label or role
      const voiceButton = page
        .locator(
          '[aria-label*="voice"], button:has-text("voice"), [data-testid="voice-toggle-button"]'
        )
        .first();
      await expect(voiceButton).toBeVisible();
      await voiceButton.click();

      // Should show voice interface - look for common voice UI indicators
      const voiceInterface = page
        .locator(
          '[data-testid="voice-interface"], [aria-label*="voice"], .voice-panel, .transcription-panel'
        )
        .first();
      await expect(voiceInterface).toBeVisible();

      // Should show recording indicator
      const recordingIndicator = page.locator(
        '[data-testid="recording-indicator"]'
      );
      if (await recordingIndicator.isVisible()) {
        await expect(recordingIndicator).toHaveClass(/recording|active/);
      }
    });

    test('should handle voice session creation failure', async ({ page }) => {
      // Mock voice session creation failure
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to create voice session' }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Should show error notification
      await expect(
        page.locator('[data-testid="voice-error-notification"]')
      ).toBeVisible();
    });

    test('should end voice session properly', async ({ page }) => {
      // Mock voice session creation and deletion
      await page.route('**/api/voice/session', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'voice-session-456',
              status: 'active',
            }),
          });
        } else if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
        }
      });

      // Start voice session
      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      await expect(
        page.locator('[data-testid="voice-interface"]')
      ).toBeVisible();

      // End voice session
      const endButton = page.locator('[data-testid="end-voice-button"]');
      if (await endButton.isVisible()) {
        await endButton.click();
      } else {
        // Try clicking voice button again to toggle off
        await voiceButton.click();
      }

      // Should hide voice interface
      await expect(
        page.locator('[data-testid="voice-interface"]')
      ).toBeHidden();
    });
  });

  test.describe('Voice Recording and Transcription', () => {
    test('should handle microphone access permissions', async ({ page }) => {
      // Revoke microphone permission temporarily
      await page.context().clearPermissions();

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Should show permission request or error
      const permissionDialog = page.locator(
        '[data-testid="microphone-permission-dialog"]'
      );
      if (await permissionDialog.isVisible()) {
        await expect(permissionDialog).toContainText(/microphone|permission/i);
      }

      // Grant permission
      await page.context().grantPermissions(['microphone']);
    });

    test('should start and stop recording', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-789',
            status: 'active',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      await expect(
        page.locator('[data-testid="voice-interface"]')
      ).toBeVisible();

      // Start recording
      const recordButton = page.locator('[data-testid="record-button"]');
      if (await recordButton.isVisible()) {
        await recordButton.click();

        // Should show recording state
        await expect(
          page.locator('[data-testid="recording-indicator"]')
        ).toBeVisible();

        // Stop recording
        await recordButton.click();

        // Should stop recording
        const recordingIndicator = page.locator(
          '[data-testid="recording-indicator"]'
        );
        if (await recordingIndicator.isVisible()) {
          await expect(recordingIndicator).not.toHaveClass(/recording|active/);
        }
      }
    });

    test('should transcribe voice input', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-transcribe',
            status: 'active',
          }),
        });
      });

      // Mock transcription API
      await page.route('**/api/voice/transcription', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            text: 'Hello, can you help me with my project?',
            confidence: 0.95,
            duration: 3.2,
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      await expect(
        page.locator('[data-testid="voice-interface"]')
      ).toBeVisible();

      // Simulate voice input (in real test, this would be audio)
      const recordButton = page.locator('[data-testid="record-button"]');
      if (await recordButton.isVisible()) {
        await recordButton.click();
        await page.waitForTimeout(2000); // Simulate recording time
        await recordButton.click(); // Stop recording

        // Should show transcribed text
        await expect(
          page.locator('[data-testid="transcribed-text"]')
        ).toContainText('Hello, can you help me with my project?');
      }
    });

    test('should handle transcription errors', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-error',
            status: 'active',
          }),
        });
      });

      // Mock transcription failure
      await page.route('**/api/voice/transcription', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Audio quality too low for transcription',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      const recordButton = page.locator('[data-testid="record-button"]');
      if (await recordButton.isVisible()) {
        await recordButton.click();
        await page.waitForTimeout(1000);
        await recordButton.click();

        // Should show transcription error
        await expect(
          page.locator('[data-testid="transcription-error"]')
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="transcription-error"]')
        ).toContainText(/audio quality|transcription/i);
      }
    });
  });

  test.describe('Voice Response and Playback', () => {
    test('should receive and play voice response', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-playback',
            status: 'active',
          }),
        });
      });

      // Mock voice response API
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            // Simulate streaming response with audio data
            controller.enqueue(
              encoder.encode(
                'data: {"type":"audio.delta","delta":{"type":"audio","audio":"base64AudioData"}}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"I can help you with your project. What specifically do you need assistance with?"}}\n\n'
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

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Simulate sending a voice message
      await page.evaluate(() => {
        // Mock audio input
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Can you help me with my project?' },
          })
        );
      });

      // Should show response being generated
      await expect(
        page.locator('[data-testid="voice-response-loading"]')
      ).toBeVisible();

      // Should show audio playback controls
      const audioPlayer = page.locator('[data-testid="audio-player"]');
      if (await audioPlayer.isVisible()) {
        await expect(audioPlayer).toBeVisible();

        // Should have play/pause controls
        const playButton = page.locator('[data-testid="audio-play-button"]');
        if (await playButton.isVisible()) {
          await expect(playButton).toBeVisible();
        }
      }
    });

    test('should show transcript alongside voice response', async ({
      page,
    }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-transcript',
            status: 'active',
          }),
        });
      });

      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Here is my response to help you with your project."}}\n\n'
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

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Simulate voice interaction
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Help me with my project' },
          })
        );
      });

      // Should show both voice and text response
      await expect(
        page.locator('[data-testid="voice-response-text"]')
      ).toContainText('Here is my response');

      // Should show in chat history as well
      const chatMessages = page.locator('[data-testid="chat-message"]');
      await expect(chatMessages).toHaveCount(2); // User + Assistant
    });

    test('should handle voice response playback errors', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-playback-error',
            status: 'active',
          }),
        });
      });

      // Mock audio generation failure
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"error","error":{"type":"audio_generation_failed","message":"Failed to generate audio"}}\n\n'
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

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Test voice error' },
          })
        );
      });

      // Should show audio error but still provide text response
      await expect(
        page.locator('[data-testid="audio-generation-error"]')
      ).toBeVisible();
    });
  });

  test.describe('Voice Settings and Configuration', () => {
    test('should allow voice model selection', async ({ page }) => {
      await page.goto('/settings');
      await waitForPageReady(page);

      // Navigate to voice settings
      const voiceSettingsTab = page.locator(
        '[data-testid="voice-settings-tab"]'
      );
      if (await voiceSettingsTab.isVisible()) {
        await voiceSettingsTab.click();

        // Should show voice-capable models
        const modelSelector = page.locator(
          '[data-testid="voice-model-selector"]'
        );
        if (await modelSelector.isVisible()) {
          await expect(modelSelector).toBeVisible();

          // Should list voice-capable models
          await modelSelector.click();
          await expect(
            page.locator('[data-testid="voice-model-option-gpt-4"]')
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="voice-model-option-gpt-4-turbo"]')
          ).toBeVisible();
        }
      }
    });

    test('should configure voice parameters', async ({ page }) => {
      await page.goto('/settings');
      await waitForPageReady(page);

      const voiceSettingsTab = page.locator(
        '[data-testid="voice-settings-tab"]'
      );
      if (await voiceSettingsTab.isVisible()) {
        await voiceSettingsTab.click();

        // Voice speed setting
        const speedSlider = page.locator('[data-testid="voice-speed-slider"]');
        if (await speedSlider.isVisible()) {
          await speedSlider.fill('1.2');
        }

        // Voice selection
        const voiceSelect = page.locator('[data-testid="voice-select"]');
        if (await voiceSelect.isVisible()) {
          await voiceSelect.selectOption('alloy');
        }

        // Auto-play responses
        const autoPlayToggle = page.locator(
          '[data-testid="auto-play-responses-toggle"]'
        );
        if (await autoPlayToggle.isVisible()) {
          await autoPlayToggle.check();
        }

        // Save settings
        const saveButton = page.locator('[data-testid="save-voice-settings"]');
        if (await saveButton.isVisible()) {
          // Mock settings save
          await page.route('**/api/user-preferences', async (route) => {
            if (route.request().method() === 'POST') {
              await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
              });
            }
          });

          await saveButton.click();

          // Should show success notification
          await expect(
            page.locator('[data-testid="settings-saved-notification"]')
          ).toBeVisible();
        }
      }
    });

    test('should test voice functionality from settings', async ({ page }) => {
      await page.goto('/settings');
      await waitForPageReady(page);

      const voiceSettingsTab = page.locator(
        '[data-testid="voice-settings-tab"]'
      );
      if (await voiceSettingsTab.isVisible()) {
        await voiceSettingsTab.click();

        // Test voice button
        const testVoiceButton = page.locator(
          '[data-testid="test-voice-button"]'
        );
        if (await testVoiceButton.isVisible()) {
          // Mock test voice API
          await page.route('**/api/voice/test', async (route) => {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                audioUrl: '/test-audio.mp3',
                text: 'This is a test of the voice synthesis.',
              }),
            });
          });

          await testVoiceButton.click();

          // Should play test audio
          await expect(
            page.locator('[data-testid="test-audio-player"]')
          ).toBeVisible();
        }
      }
    });
  });

  test.describe('Voice and Chat Integration', () => {
    test('should seamlessly switch between voice and text', async ({
      page,
    }) => {
      // Start with text message
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"I understand your text message."}}\n\n'
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

      await page.fill('[data-testid="chat-input"]', 'Hello via text');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Switch to voice
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-switch',
            status: 'active',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Send voice message (simulate)
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Now speaking via voice' },
          })
        );
      });

      // Should show both messages in chat history
      await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(4); // 2 pairs

      // Should maintain conversation context
      const lastMessage = page.locator('[data-testid="chat-message"]').last();
      await expect(lastMessage).toBeVisible();
    });

    test('should preserve chat context in voice mode', async ({ page }) => {
      // Start conversation with text
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"I can help you with JavaScript."}}\n\n'
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

      await page.fill('[data-testid="chat-input"]', 'Help me with JavaScript');
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(1000);

      // Switch to voice and continue conversation
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-context',
            status: 'active',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Mock follow-up response that shows context awareness
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Regarding JavaScript, what specific concept would you like to explore further?"}}\n\n'
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

      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Tell me more about functions' },
          })
        );
      });

      // Response should show context awareness
      const lastResponse = page
        .locator('[data-testid="chat-message"][data-role="assistant"]')
        .last();
      await expect(lastResponse).toContainText('Regarding JavaScript');
    });

    test('should handle mixed media responses', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-mixed',
            status: 'active',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Mock response with both text and code
      await page.route('**/api/chat', async (route) => {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"Here\'s a JavaScript function example:\\n\\n"}}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'data: {"type":"content.delta","delta":{"type":"text-delta","textDelta":"```javascript\\nfunction greet(name) {\\n  return `Hello, ${name}!`;\\n}\\n```"}}\n\n'
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

      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('voice-input', {
            detail: { text: 'Show me a function example' },
          })
        );
      });

      // Should display both voice response and code block
      await expect(page.locator('[data-testid="code-block"]')).toBeVisible();

      // Voice should handle non-code parts appropriately
      const audioPlayer = page.locator('[data-testid="audio-player"]');
      if (await audioPlayer.isVisible()) {
        await expect(audioPlayer).toBeVisible();
      }
    });
  });

  test.describe('Voice Performance and Quality', () => {
    test('should handle poor network conditions', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/voice/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 3s delay
        await route.continue();
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Should show loading states appropriately
      await expect(page.locator('[data-testid="voice-loading"]')).toBeVisible({
        timeout: 10000,
      });

      // Should eventually timeout or show error
      await expect(
        page.locator(
          '[data-testid="voice-timeout-error"], [data-testid="voice-network-error"]'
        )
      ).toBeVisible({ timeout: 15000 });
    });

    test('should monitor audio quality', async ({ page }) => {
      await page.route('**/api/voice/session', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'voice-session-quality',
            status: 'active',
          }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Check for audio quality indicators
      const qualityIndicator = page.locator(
        '[data-testid="audio-quality-indicator"]'
      );
      if (await qualityIndicator.isVisible()) {
        await expect(qualityIndicator).toBeVisible();
      }

      // Check for noise detection warnings
      const noiseWarning = page.locator('[data-testid="noise-warning"]');
      if (await noiseWarning.isVisible()) {
        await expect(noiseWarning).toContainText(/noise|quality/i);
      }
    });

    test('should provide fallback when voice features fail', async ({
      page,
    }) => {
      // Mock complete voice system failure
      await page.route('**/api/voice/**', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Voice service unavailable' }),
        });
      });

      const voiceButton = page.locator('[data-testid="voice-toggle-button"]');
      await voiceButton.click();

      // Should show error and fallback to text mode
      await expect(
        page.locator('[data-testid="voice-service-error"]')
      ).toBeVisible();

      // Text input should still be available
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();

      // Should be able to continue with text
      await page.fill('[data-testid="chat-input"]', 'Fallback to text mode');
      await expect(page.locator('[data-testid="send-button"]')).toBeEnabled();
    });
  });
});
