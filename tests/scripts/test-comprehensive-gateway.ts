#!/usr/bin/env tsx

/**
 * Comprehensive AI Gateway Integration Test
 * Tests multiple providers and scenarios to validate gateway functionality
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment variables from .env.local FIRST
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
} catch (_error) {
  console.error('Warning: Could not load .env.local file');
}

import { generateText } from 'ai';
import { openproviders } from '../../lib/openproviders';
import { getGatewayConfig } from '../../lib/openproviders/env';

// Mock fetch to capture requests
const requestLogs: Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  modelId?: string;
}> = [];

function createMockFetch() {
  return function mockFetch(url: string, options: any = {}) {
    const headers: Record<string, string> = {};
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers[key] = String(value);
      }
    }

    let body;
    try {
      body = options.body ? JSON.parse(options.body) : undefined;
    } catch {
      body = options.body;
    }

    requestLogs.push({
      url,
      method: options.method || 'GET',
      headers,
      body,
      modelId: body?.model || 'unknown',
    });

    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: () =>
        Promise.resolve({
          id: 'mock-response',
          object: 'chat.completion',
          choices: [
            {
              message: {
                content: `Mock response for ${body?.model || 'unknown'}`,
              },
              finish_reason: 'stop',
            },
          ],
        }),
      text: () =>
        Promise.resolve(`Mock response for ${body?.model || 'unknown'}`),
    });
  };
}

interface TestCase {
  name: string;
  modelId: string;
  expectedProvider: string;
  shouldUseGateway: boolean;
}

async function runComprehensiveTest() {
  console.log('=== Comprehensive AI Gateway Integration Test ===\n');

  const gatewayConfig = getGatewayConfig();
  console.log('Gateway Configuration:');
  console.log(`- enabled: ${gatewayConfig.enabled}`);
  console.log(`- baseURL: ${gatewayConfig.baseURL}`);
  console.log(`- api key set: ${!!process.env.AI_GATEWAY_API_KEY}`);
  console.log('');

  // Test cases covering different providers and scenarios
  const testCases: TestCase[] = [
    {
      name: 'OpenAI GPT-4o-mini (Gateway)',
      modelId: 'gpt-4o-mini',
      expectedProvider: 'openai',
      shouldUseGateway: true,
    },
    {
      name: 'OpenAI GPT-4o (Gateway)',
      modelId: 'gpt-4o',
      expectedProvider: 'openai',
      shouldUseGateway: true,
    },
    {
      name: 'OpenAI GPT-3.5 (Gateway)',
      modelId: 'gpt-3.5-turbo',
      expectedProvider: 'openai',
      shouldUseGateway: true,
    },
    {
      name: 'Anthropic Claude Sonnet (No Gateway Expected)',
      modelId: 'claude-3-5-sonnet-20241022',
      expectedProvider: 'anthropic',
      shouldUseGateway: false,
    },
  ];

  const originalFetch = global.fetch;
  let _currentTestName = '';

  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    _currentTestName = testCase.name;

    // Clear request logs
    requestLogs.length = 0;

    // Setup mock fetch
    global.fetch = createMockFetch();

    try {
      const model = openproviders(testCase.modelId);

      await generateText({
        model,
        prompt: 'Test message',
        maxTokens: 5,
      });

      console.log('✅ Request completed successfully');

      // Analyze the request
      if (requestLogs.length > 0) {
        const request = requestLogs[0];
        console.log(`   URL: ${request.url}`);
        console.log(`   Model: ${request.modelId}`);
        console.log(
          `   Auth: ${request.headers.Authorization?.substring(0, 20)}...`
        );

        // Check if using gateway
        const usingGateway =
          request.url.includes('gateway') || request.url.includes('ai-gateway');
        console.log(`   Using Gateway: ${usingGateway ? '✅' : '❌'}`);

        // Check API endpoint
        if (request.url.includes('/responses')) {
          console.log(
            '   API Endpoint: ❌ RESPONSES API (not supported by gateway)'
          );
        } else if (request.url.includes('/chat/completions')) {
          console.log('   API Endpoint: ✅ CHAT COMPLETIONS API');
        } else {
          console.log(`   API Endpoint: ❓ UNKNOWN (${request.url})`);
        }

        // Validate expectation
        if (testCase.shouldUseGateway && usingGateway) {
          console.log('   Result: ✅ PASSED - Gateway used as expected');
        } else if (!testCase.shouldUseGateway && !usingGateway) {
          console.log('   Result: ✅ PASSED - Direct API used as expected');
        } else {
          console.log(
            `   Result: ❌ FAILED - Expected gateway: ${testCase.shouldUseGateway}, got: ${usingGateway}`
          );
        }
      } else {
        console.log('❌ No requests captured');
      }
    } catch (error: any) {
      console.log(`⚠️ Test error (expected in mock): ${error.message}`);
    }
  }

  // Restore original fetch
  global.fetch = originalFetch;

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total test cases: ${testCases.length}`);
  console.log(
    `Gateway configuration: ${gatewayConfig.enabled ? 'ENABLED' : 'DISABLED'}`
  );

  if (gatewayConfig.enabled && requestLogs.length > 0) {
    const gatewayRequests = requestLogs.filter(
      (r) => r.url.includes('gateway') || r.url.includes('ai-gateway')
    );
    const chatCompletionRequests = requestLogs.filter((r) =>
      r.url.includes('/chat/completions')
    );
    const responsesRequests = requestLogs.filter((r) =>
      r.url.includes('/responses')
    );

    console.log(
      `Gateway requests: ${gatewayRequests.length}/${testCases.filter((t) => t.shouldUseGateway).length}`
    );
    console.log(`Chat completions API: ${chatCompletionRequests.length}`);
    console.log(
      `Responses API: ${responsesRequests.length} ${responsesRequests.length === 0 ? '✅' : '❌'}`
    );
  }

  console.log('\n=== AI Gateway Integration Test Complete ===');
}

runComprehensiveTest().catch(console.error);
