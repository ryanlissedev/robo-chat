#!/usr/bin/env node

/**
 * OpenAI-Compatible Gateway Test
 *
 * This test uses the proper OpenAI-compatible API approach as documented
 * at https://vercel.com/docs/ai-gateway/openai-compat
 *
 * Usage:
 *   npx tsx tests/isolated/openai-compat-gateway-test.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import OpenAI from 'openai';

// Load environment variables
function loadEnv() {
  const envFiles = ['.env.local', '.env.test.local', '.env'];

  for (const file of envFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class OpenAICompatGatewayTester {
  async testOpenAICompatibleAPI() {
    log('\n🧪 Testing OpenAI-Compatible Gateway API', 'bold');

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseURL = process.env.AI_GATEWAY_BASE_URL;

    if (!apiKey) {
      log('❌ AI_GATEWAY_API_KEY not configured', 'red');
      return false;
    }

    if (!baseURL) {
      log('❌ AI_GATEWAY_BASE_URL not configured', 'red');
      return false;
    }

    log(`🔧 Configuration:`, 'cyan');
    log(`   Base URL: ${baseURL}`, 'blue');
    log(`   API Key: ${apiKey.substring(0, 10)}...`, 'blue');

    try {
      // Create OpenAI client pointing to the gateway
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      });

      log('\n🔄 Making chat completion request...', 'cyan');

      const completion = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'user',
            content: 'Say "OpenAI Gateway works!" in exactly 3 words.',
          },
        ],
        max_tokens: 10,
        temperature: 0,
      });

      const response = completion.choices[0]?.message?.content;

      log(`✅ SUCCESS! Response: "${response}"`, 'green');
      log(`📊 Usage: ${JSON.stringify(completion.usage)}`, 'blue');
      log(`🏁 Finish Reason: ${completion.choices[0]?.finish_reason}`, 'blue');
      log(`🤖 Model: ${completion.model}`, 'blue');

      return { success: true, response, usage: completion.usage };
    } catch (error) {
      log(`❌ OpenAI-Compatible API failed: ${error.message}`, 'red');

      // Check if it's a specific error type
      if (error.message.includes('401')) {
        log(
          '💡 This might be an authentication issue. Check your AI_GATEWAY_API_KEY.',
          'yellow'
        );
      } else if (error.message.includes('404')) {
        log(
          '💡 This might be a URL issue. Check your AI_GATEWAY_BASE_URL.',
          'yellow'
        );
      } else if (error.message.includes('405')) {
        log(
          '💡 Method not allowed - the endpoint might not support this operation.',
          'yellow'
        );
      }

      return { success: false, error: error.message };
    }
  }

  async testListModels() {
    log('\n🧪 Testing List Models Endpoint', 'bold');

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseURL = process.env.AI_GATEWAY_BASE_URL;

    if (!apiKey || !baseURL) {
      log('❌ Gateway not configured', 'red');
      return false;
    }

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      });

      log('🔄 Fetching available models...', 'cyan');

      const models = await openai.models.list();

      log(`✅ Found ${models.data.length} models:`, 'green');

      models.data.slice(0, 10).forEach((model, i) => {
        log(`   ${i + 1}. ${model.id} (${model.owned_by})`, 'blue');
      });

      if (models.data.length > 10) {
        log(`   ... and ${models.data.length - 10} more`, 'blue');
      }

      return { success: true, models: models.data };
    } catch (error) {
      log(`❌ List models failed: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }

  async testStreamingCompletion() {
    log('\n🧪 Testing Streaming Chat Completion', 'bold');

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseURL = process.env.AI_GATEWAY_BASE_URL;

    if (!apiKey || !baseURL) {
      log('❌ Gateway not configured', 'red');
      return false;
    }

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      });

      log('🔄 Starting streaming completion...', 'cyan');

      const stream = await openai.chat.completions.create({
        model: 'anthropic/claude-sonnet-4',
        messages: [
          {
            role: 'user',
            content: 'Count from 1 to 5, one number per response chunk.',
          },
        ],
        max_tokens: 20,
        temperature: 0,
        stream: true,
      });

      let fullResponse = '';
      let chunkCount = 0;

      log('📡 Streaming response:', 'cyan');
      process.stdout.write('   ');

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          process.stdout.write(content);
          chunkCount++;
        }
      }

      console.log(); // New line after streaming

      log(`✅ Streaming completed! Received ${chunkCount} chunks`, 'green');
      log(`📝 Full response: "${fullResponse.trim()}"`, 'blue');

      return {
        success: true,
        response: fullResponse.trim(),
        chunks: chunkCount,
      };
    } catch (error) {
      log(`❌ Streaming failed: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }

  async testDifferentModels() {
    log('\n🧪 Testing Different Model Formats', 'bold');

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseURL = process.env.AI_GATEWAY_BASE_URL;

    if (!apiKey || !baseURL) {
      log('❌ Gateway not configured', 'red');
      return false;
    }

    const modelsToTest = [
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4',
      'anthropic/claude-haiku-4',
    ];

    const results = [];

    for (const model of modelsToTest) {
      log(`\n🔄 Testing model: ${model}`, 'cyan');

      try {
        const openai = new OpenAI({
          apiKey: apiKey,
          baseURL: baseURL,
          dangerouslyAllowBrowser: true,
        });

        const completion = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'user',
              content: `Say "Hello from ${model.split('/')[1]}" in exactly 3 words.`,
            },
          ],
          max_tokens: 10,
          temperature: 0,
        });

        const response = completion.choices[0]?.message?.content;

        log(`   ✅ ${model}: "${response}"`, 'green');
        results.push({ model, success: true, response });
      } catch (error) {
        log(`   ❌ ${model}: ${error.message}`, 'red');
        results.push({ model, success: false, error: error.message });
      }
    }

    return results;
  }

  async runAllTests() {
    log('🚀 OpenAI-Compatible Gateway Testing Suite', 'bold');
    log('='.repeat(50), 'cyan');

    const results = {
      chatCompletion: null,
      listModels: null,
      streaming: null,
      multipleModels: null,
    };

    // Test 1: Basic chat completion
    results.chatCompletion = await this.testOpenAICompatibleAPI();

    // Test 2: List models
    results.listModels = await this.testListModels();

    // Test 3: Streaming
    results.streaming = await this.testStreamingCompletion();

    // Test 4: Different models
    results.multipleModels = await this.testDifferentModels();

    // Summary
    log('\n📋 Test Summary', 'bold');
    log('='.repeat(30), 'cyan');

    const successCount = Object.values(results).filter(
      (r) => r && (r.success || Array.isArray(r))
    ).length;
    const totalTests = Object.keys(results).length;

    log(
      `Tests Passed: ${successCount}/${totalTests}`,
      successCount === totalTests ? 'green' : 'yellow'
    );

    if (results.chatCompletion?.success) {
      log('\n🎉 SUCCESS: OpenAI-Compatible Gateway is working!', 'green');
      log(
        '✅ You can now use standard OpenAI client libraries with the gateway',
        'green'
      );
      log('✅ Chat completions are working through the gateway', 'green');

      if (results.streaming?.success) {
        log('✅ Streaming is working through the gateway', 'green');
      }

      if (results.listModels?.success) {
        log('✅ Model listing is working through the gateway', 'green');
      }
    } else {
      log('\n❌ OpenAI-Compatible Gateway is not working', 'red');
      log(
        '💡 Check your AI_GATEWAY_API_KEY and AI_GATEWAY_BASE_URL configuration',
        'blue'
      );
    }

    return results;
  }
}

async function main() {
  const tester = new OpenAICompatGatewayTester();
  await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { OpenAICompatGatewayTester };
