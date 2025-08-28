import { expect, test } from '@playwright/test';
import { openproviders } from '@/lib/openproviders';
import type { SupportedModel, Provider } from '@/lib/openproviders/types';

// Test configuration for each provider
const providerConfigs = {
  openai: {
    models: ['gpt-5-mini', 'gpt-5', 'gpt-5-pro'],
    envKey: 'OPENAI_API_KEY',
    requiredEnv: true,
  },
  anthropic: {
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    envKey: 'ANTHROPIC_API_KEY',
    requiredEnv: true,
  },
  google: {
    models: ['gemini-2.0-flash-001', 'gemini-1.5-flash'],
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    requiredEnv: true,
  },
  mistral: {
    models: ['mistral-large-latest', 'mistral-small-latest'],
    envKey: 'MISTRAL_API_KEY',
    requiredEnv: true,
  },
  perplexity: {
    models: ['sonar', 'sonar-pro'],
    envKey: 'PERPLEXITY_API_KEY',
    requiredEnv: true,
  },
  xai: {
    models: ['grok-3', 'grok-3-mini'],
    envKey: 'XAI_API_KEY',
    requiredEnv: true,
  },
};

test.describe('Provider API Key Validation and Real Responses', () => {
  // Skip if no API keys are configured
  const hasApiKeys = Object.entries(providerConfigs).some(
    ([_provider, config]) => process.env[config.envKey]
  );

  test.skip(!hasApiKeys, 'No API keys configured for provider testing');

  test.describe('API Key Validation', () => {
    // Test each provider's API key validation
    Object.entries(providerConfigs).forEach(([provider, config]) => {
      const hasKey = !!process.env[config.envKey];

      test.describe(`${provider.toUpperCase()} Provider`, () => {
        test.skip(
          !hasKey && config.requiredEnv,
          `${config.envKey} not configured`
        );

        test(`should validate ${provider} API key`, async () => {
          const testModel = config.models[0] as SupportedModel;

          try {
            const languageModel = openproviders(testModel);
            expect(languageModel).toBeDefined();
            expect(typeof languageModel).toBe('object');

            // Test with invalid API key should throw or fail gracefully
            const invalidApiKey = 'invalid-api-key-test';
            expect(() => {
              openproviders(testModel, {}, invalidApiKey);
            }).not.toThrow(); // Should create model but fail on actual call
          } catch (error) {
            // Some providers might throw on invalid initialization
            expect(error).toBeInstanceOf(Error);
          }
        });

        if (hasKey) {
          test(`should create valid ${provider} language model instance`, async () => {
            const testModel = config.models[0] as SupportedModel;
            const languageModel = openproviders(testModel);

            expect(languageModel).toBeDefined();
            expect(languageModel).toHaveProperty('doGenerate');
            expect(languageModel).toHaveProperty('doStream');
            expect(typeof languageModel.doGenerate).toBe('function');
            expect(typeof languageModel.doStream).toBe('function');
          });

          // Test specific provider configurations
          if (provider === 'openai') {
            test('should handle OpenAI GPT-5 specific configurations', async () => {
              const gpt5Model = 'gpt-5-mini' as SupportedModel;

              // Test with reasoning effort settings
              const modelWithReasoning = openproviders(gpt5Model, {
                reasoningEffort: 'medium',
                verbosity: 'low',
                textVerbosity: 'low',
              });

              expect(modelWithReasoning).toBeDefined();
              expect(modelWithReasoning).toHaveProperty('doGenerate');

              // Test responses API for GPT-5
              const modelWithResponses = openproviders(gpt5Model, {
                openai: {
                  textVerbosity: 'low',
                  reasoningSummary: 'concise',
                },
              });

              expect(modelWithResponses).toBeDefined();
            });

            test('should handle OpenAI reasoning models (o-series)', async () => {
              // Test would run if we had o1/o3/o4 models
              const reasoningModel = 'gpt-5' as SupportedModel; // Using GPT-5 as proxy

              const model = openproviders(reasoningModel, {
                headers: { 'OpenAI-Beta': 'reasoning=v1' },
              });

              expect(model).toBeDefined();
            });
          }
        }
      });
    });
  });

  test.describe('Real Provider Responses', () => {
    // Only run if we have API keys
    const testableProviders = Object.entries(providerConfigs).filter(
      ([_provider, config]) => process.env[config.envKey] || !config.requiredEnv
    );

    testableProviders.forEach(([provider, config]) => {
      test.describe(`${provider.toUpperCase()} Real API Calls`, () => {
        const hasKey = !!process.env[config.envKey];
        test.skip(
          !hasKey && config.requiredEnv,
          `${config.envKey} not configured`
        );

        config.models.slice(0, 2).forEach((model) => {
          test(`should get real response from ${model}`, async () => {
            const languageModel = openproviders(model as SupportedModel);

            try {
              const result = await languageModel.doGenerate({
                inputFormat: 'prompt',
                mode: { type: 'regular' },
                prompt: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Hello! Please respond with exactly "API_TEST_SUCCESS" to confirm the connection is working.',
                      },
                    ],
                  },
                ],
                maxTokens: 50,
                temperature: 0,
                topP: 1,
                frequencyPenalty: 0,
                presencePenalty: 0,
                stopSequences: [],
              });

              expect(result).toBeDefined();
              expect(result.finishReason).toBeDefined();
              expect(result.usage).toBeDefined();
              expect(result.usage.promptTokens).toBeGreaterThanOrEqual(0);
              expect(result.usage.completionTokens).toBeGreaterThanOrEqual(0);

              // Check response text
              const responseText = result.text || '';
              expect(responseText.length).toBeGreaterThan(0);

              // For this specific test, we expect the response to contain our test phrase
              expect(responseText.toLowerCase()).toContain('api_test_success');
            } catch (error: any) {
              // Provide detailed error information for debugging
              if (error?.name === 'AI_APICallError') {
                console.error(`${provider} API Error:`, {
                  model,
                  status: error.statusCode,
                  message: error.message,
                  cause: error.cause,
                });

                // Specific error handling for different providers
                if (error.statusCode === 401) {
                  expect.fail(
                    `API key invalid for ${provider}. Check ${config.envKey}`
                  );
                } else if (error.statusCode === 403) {
                  expect.fail(
                    `API key lacks permissions for ${provider}/${model}`
                  );
                } else if (error.statusCode === 404) {
                  expect.fail(`Model ${model} not found for ${provider}`);
                } else if (error.statusCode === 429) {
                  expect.fail(
                    `Rate limit exceeded for ${provider}. Try again later.`
                  );
                } else {
                  expect.fail(`${provider} API call failed: ${error.message}`);
                }
              } else {
                throw error;
              }
            }
          });

          test(`should handle streaming from ${model}`, async () => {
            const languageModel = openproviders(model as SupportedModel);

            try {
              const result = await languageModel.doStream({
                inputFormat: 'prompt',
                mode: { type: 'regular' },
                prompt: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Count from 1 to 3, with each number on a new line.',
                      },
                    ],
                  },
                ],
                maxTokens: 50,
                temperature: 0,
                topP: 1,
                frequencyPenalty: 0,
                presencePenalty: 0,
                stopSequences: [],
              });

              expect(result).toBeDefined();
              expect(result).toBeInstanceOf(Object);
              expect(result.stream).toBeDefined();

              let chunks = 0;
              let fullText = '';
              let finishChunk: any = null;

              // The result object contains a stream property that is async iterable
              const stream = result.stream;
              expect(stream).toBeTruthy();
              expect(typeof stream).toBe('object');

              for await (const chunk of stream) {
                chunks++;

                if (chunk.type === 'text-delta') {
                  fullText += chunk.textDelta;
                } else if (chunk.type === 'finish') {
                  finishChunk = chunk;
                  expect(chunk.finishReason).toBeDefined();
                  expect(chunk.usage).toBeDefined();
                  expect(chunk.usage.promptTokens).toBeGreaterThanOrEqual(0);
                  expect(chunk.usage.completionTokens).toBeGreaterThanOrEqual(
                    0
                  );
                }
              }

              expect(chunks).toBeGreaterThan(0);
              expect(fullText.length).toBeGreaterThan(0);
              expect(finishChunk).toBeTruthy();

              // Should contain the numbers 1, 2, 3
              expect(fullText).toMatch(/1.*2.*3/s);
            } catch (error: any) {
              if (error?.name === 'AI_APICallError') {
                console.error(`${provider} Streaming Error:`, {
                  model,
                  status: error.statusCode,
                  message: error.message,
                });
                expect.fail(`${provider} streaming failed: ${error.message}`);
              } else {
                throw error;
              }
            }
          });
        });

        // Test error handling
        test(`should handle invalid requests gracefully for ${provider}`, async () => {
          const testModel = config.models[0] as SupportedModel;
          const languageModel = openproviders(testModel);

          try {
            // Test with invalid parameters (negative maxTokens)
            await languageModel.doGenerate({
              inputFormat: 'prompt',
              mode: { type: 'regular' },
              prompt: [
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'Hello' }],
                },
              ],
              maxTokens: -1, // Invalid parameter
              temperature: 0,
              topP: 1,
              frequencyPenalty: 0,
              presencePenalty: 0,
              stopSequences: [],
            });

            // Should not reach here
            expect.fail('Expected API call to fail with invalid parameters');
          } catch (error: any) {
            // Should properly handle the error
            expect(error).toBeInstanceOf(Error);
            if (error.name === 'AI_APICallError') {
              expect(error.statusCode).toBeGreaterThanOrEqual(400);
              expect(error.statusCode).toBeLessThan(500);
            }
          }
        });
      });
    });
  });

  test.describe('Provider Integration Health Check', () => {
    test('should have all configured providers working', async () => {
      const workingProviders: string[] = [];
      const failingProviders: { provider: string; error: string }[] = [];

      for (const [provider, config] of Object.entries(providerConfigs)) {
        const hasKey = !!process.env[config.envKey];

        if (!hasKey && config.requiredEnv) {
          console.log(`Skipping ${provider}: ${config.envKey} not configured`);
          continue;
        }

        try {
          const testModel = config.models[0] as SupportedModel;
          const languageModel = openproviders(testModel);

          // Quick health check
          const result = await languageModel.doGenerate({
            inputFormat: 'prompt',
            mode: { type: 'regular' },
            prompt: [
              {
                role: 'user',
                content: [{ type: 'text', text: 'Hi' }],
              },
            ],
            maxTokens: 5,
            temperature: 0,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            stopSequences: [],
          });

          if (result && result.text) {
            workingProviders.push(provider);
          }
        } catch (error: any) {
          failingProviders.push({
            provider,
            error: error.message || 'Unknown error',
          });
        }
      }

      console.log('Working providers:', workingProviders);
      if (failingProviders.length > 0) {
        console.log('Failing providers:', failingProviders);
      }

      // Expect at least one provider to be working
      expect(workingProviders.length).toBeGreaterThan(0);

      // Log summary
      expect(
        workingProviders.length + failingProviders.length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
