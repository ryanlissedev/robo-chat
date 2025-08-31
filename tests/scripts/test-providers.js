#!/usr/bin/env node

/**
 * Comprehensive AI Provider Test Script
 * Tests all providers with AI Gateway integration
 */

// Use CommonJS require for Node.js compatibility
const { openproviders } = require('../../lib/openproviders');
const { getGatewayConfig } = require('../../lib/openproviders/env');

// Test configuration for each provider
const providerConfigs = {
  openai: {
    models: ['gpt-5-mini', 'gpt-5', 'gpt-5-pro', 'gpt-4o', 'gpt-4o-mini'],
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

const testMessage = {
  inputFormat: 'prompt',
  mode: { type: 'regular' },
  prompt: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Respond with exactly "TEST_SUCCESS" to confirm the connection works.',
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
};

const streamTestMessage = {
  inputFormat: 'prompt',
  mode: { type: 'regular' },
  prompt: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Count from 1 to 3, one number per line.',
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
};

class ProviderTester {
  constructor() {
    this.results = {
      summary: {},
      detailed: {},
      errors: [],
      performance: {},
      gateway: {
        enabled: false,
        configured: false,
      },
    };

    // Check gateway configuration
    const gateway = getGatewayConfig();
    this.results.gateway.enabled = gateway.enabled;
    this.results.gateway.configured = !!gateway.baseURL;

    console.log('\n🚀 AI Provider Test Suite Starting...\n');
    console.log(
      `Gateway Status: ${gateway.enabled ? '✅ Enabled' : '❌ Disabled'}`
    );
    if (gateway.enabled) {
      console.log(`Gateway URL: ${gateway.baseURL}\n`);
    }
  }

  checkEnvironmentVariables() {
    console.log('📋 Environment Variable Check:');

    Object.entries(providerConfigs).forEach(([provider, config]) => {
      const hasKey = !!process.env[config.envKey];
      const keyValue = process.env[config.envKey];
      const maskedKey = keyValue ? `${keyValue.substring(0, 8)}...` : 'Not set';

      console.log(
        `   ${provider.padEnd(12)}: ${hasKey ? '✅' : '❌'} ${maskedKey}`
      );

      this.results.summary[provider] = {
        configured: hasKey,
        keyPrefix: hasKey ? keyValue.substring(0, 8) : null,
      };
    });

    // Check gateway API key
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    const maskedGateway = gatewayKey
      ? `${gatewayKey.substring(0, 8)}...`
      : 'Not set';
    console.log(
      `   gateway     : ${gatewayKey ? '✅' : '❌'} ${maskedGateway}`
    );
    console.log('');
  }

  async testProvider(provider, config) {
    console.log(`🧪 Testing ${provider.toUpperCase()}...`);

    const providerResults = {
      configured: !!process.env[config.envKey],
      models: {},
      errors: [],
      performance: {
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
      },
    };

    if (!providerResults.configured && config.requiredEnv) {
      console.log(`   ⏭️  Skipping (${config.envKey} not configured)`);
      this.results.detailed[provider] = providerResults;
      return providerResults;
    }

    // Test each model
    for (const modelName of config.models.slice(0, 2)) {
      // Test first 2 models only
      console.log(`   📊 Model: ${modelName}`);

      const modelResults = {
        initialization: null,
        generation: null,
        streaming: null,
        errorHandling: null,
        gateway: {
          directAccess: null,
          gatewayRouted: null,
        },
      };

      providerResults.performance.totalTests += 4; // 4 tests per model

      // 1. Test Initialization
      try {
        const startTime = Date.now();
        const languageModel = openproviders(modelName);
        const initTime = Date.now() - startTime;

        modelResults.initialization = {
          success: true,
          duration: initTime,
          hasDoGenerate: typeof languageModel.doGenerate === 'function',
          hasDoStream: typeof languageModel.doStream === 'function',
        };

        console.log(`      ✅ Initialization (${initTime}ms)`);
        providerResults.performance.successfulTests++;
      } catch (error) {
        modelResults.initialization = {
          success: false,
          error: error.message,
        };
        console.log(`      ❌ Initialization failed: ${error.message}`);
        providerResults.errors.push({
          model: modelName,
          type: 'initialization',
          error: error.message,
        });
        providerResults.performance.failedTests++;
      }

      // 2. Test Generation
      if (modelResults.initialization?.success) {
        try {
          const startTime = Date.now();
          const languageModel = openproviders(modelName);
          const result = await languageModel.doGenerate(testMessage);
          const genTime = Date.now() - startTime;

          modelResults.generation = {
            success: true,
            duration: genTime,
            finishReason: result.finishReason,
            promptTokens: result.usage?.promptTokens || 0,
            completionTokens: result.usage?.completionTokens || 0,
            totalTokens:
              (result.usage?.promptTokens || 0) +
              (result.usage?.completionTokens || 0),
            responseLength: result.text?.length || 0,
            containsExpected:
              result.text?.toLowerCase().includes('test_success') || false,
          };

          console.log(
            `      ✅ Generation (${genTime}ms, ${modelResults.generation.totalTokens} tokens)`
          );
          providerResults.performance.successfulTests++;
        } catch (error) {
          modelResults.generation = {
            success: false,
            error: error.message,
            statusCode: error.statusCode || null,
          };
          console.log(`      ❌ Generation failed: ${error.message}`);
          providerResults.errors.push({
            model: modelName,
            type: 'generation',
            error: error.message,
          });
          providerResults.performance.failedTests++;
        }
      }

      // 3. Test Streaming
      if (modelResults.initialization?.success) {
        try {
          const startTime = Date.now();
          const languageModel = openproviders(modelName);
          const result = await languageModel.doStream(streamTestMessage);

          let chunks = 0;
          let fullText = '';
          let finishChunk = null;

          for await (const chunk of result.stream) {
            chunks++;
            if (chunk.type === 'text-delta') {
              fullText += chunk.textDelta;
            } else if (chunk.type === 'finish') {
              finishChunk = chunk;
            }
          }

          const streamTime = Date.now() - startTime;

          modelResults.streaming = {
            success: true,
            duration: streamTime,
            chunks,
            responseLength: fullText.length,
            finishReason: finishChunk?.finishReason,
            promptTokens: finishChunk?.usage?.promptTokens || 0,
            completionTokens: finishChunk?.usage?.completionTokens || 0,
            containsNumbers: /1.*2.*3/s.test(fullText),
          };

          console.log(`      ✅ Streaming (${streamTime}ms, ${chunks} chunks)`);
          providerResults.performance.successfulTests++;
        } catch (error) {
          modelResults.streaming = {
            success: false,
            error: error.message,
            statusCode: error.statusCode || null,
          };
          console.log(`      ❌ Streaming failed: ${error.message}`);
          providerResults.errors.push({
            model: modelName,
            type: 'streaming',
            error: error.message,
          });
          providerResults.performance.failedTests++;
        }
      }

      // 4. Test Error Handling
      try {
        const languageModel = openproviders(modelName);
        await languageModel.doGenerate({
          ...testMessage,
          maxTokens: -1, // Invalid parameter
        });

        // Should not reach here
        modelResults.errorHandling = {
          success: false,
          error: 'Expected error for invalid parameters but none occurred',
        };
        console.log(`      ❌ Error handling: Expected error but got none`);
        providerResults.performance.failedTests++;
      } catch (error) {
        modelResults.errorHandling = {
          success: true,
          errorType: error.name,
          statusCode: error.statusCode,
          handled: error.statusCode >= 400 && error.statusCode < 500,
        };
        console.log(
          `      ✅ Error handling (Status: ${error.statusCode || 'N/A'})`
        );
        providerResults.performance.successfulTests++;
      }

      providerResults.models[modelName] = modelResults;
    }

    this.results.detailed[provider] = providerResults;

    const successRate = (
      (providerResults.performance.successfulTests /
        providerResults.performance.totalTests) *
      100
    ).toFixed(1);
    console.log(
      `   📈 Success Rate: ${successRate}% (${providerResults.performance.successfulTests}/${providerResults.performance.totalTests})`
    );
    console.log('');

    return providerResults;
  }

  async runAllTests() {
    const startTime = Date.now();

    this.checkEnvironmentVariables();

    console.log('🔄 Running Provider Tests...\n');

    for (const [provider, config] of Object.entries(providerConfigs)) {
      await this.testProvider(provider, config);
    }

    const totalTime = Date.now() - startTime;
    this.results.performance.totalDuration = totalTime;

    this.generateReport();
  }

  generateReport() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================\n');

    let totalProviders = 0;
    let workingProviders = 0;
    let totalTests = 0;
    let successfulTests = 0;

    Object.entries(this.results.detailed).forEach(([provider, results]) => {
      totalProviders++;
      totalTests += results.performance.totalTests;
      successfulTests += results.performance.successfulTests;

      if (results.configured && results.performance.successfulTests > 0) {
        workingProviders++;
        console.log(
          `✅ ${provider.toUpperCase()}: Working (${results.performance.successfulTests}/${results.performance.totalTests} tests passed)`
        );
      } else if (!results.configured) {
        console.log(`⏭️  ${provider.toUpperCase()}: Not configured`);
      } else {
        console.log(
          `❌ ${provider.toUpperCase()}: Failed (${results.performance.successfulTests}/${results.performance.totalTests} tests passed)`
        );
      }
    });

    console.log('\n📈 Overall Statistics:');
    console.log(`   Total Providers: ${totalProviders}`);
    console.log(`   Working Providers: ${workingProviders}`);
    console.log(
      `   Success Rate: ${((successfulTests / totalTests) * 100).toFixed(1)}%`
    );
    console.log(
      `   Total Duration: ${this.results.performance.totalDuration}ms`
    );
    console.log(
      `   Gateway: ${this.results.gateway.enabled ? 'Enabled' : 'Disabled'}`
    );

    if (this.results.errors.length > 0) {
      console.log('\n❌ Error Summary:');
      this.results.errors.forEach((error) => {
        console.log(`   ${error.provider}: ${error.error}`);
      });
    }

    console.log(
      '\n💾 Detailed results saved to: tests/results/provider-test-results.json'
    );
  }

  async saveResults() {
    const fs = require('node:fs/promises');
    const path = require('node:path');

    const resultsDir = 'tests/results';
    const resultsPath = path.join(resultsDir, 'provider-test-results.json');

    try {
      await fs.mkdir(resultsDir, { recursive: true });
      await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
    } catch (error) {
      console.error('Failed to save results:', error.message);
    }
  }
}

// Run the tests
async function main() {
  const tester = new ProviderTester();

  try {
    await tester.runAllTests();
    await tester.saveResults();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

main();
