#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment variables from .env.local
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
import { openproviders } from '../../lib/openproviders/index';

// Mock fetch to intercept HTTP requests
const originalFetch = global.fetch;
const requestLogs: Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
  test: string;
}> = [];

function mockFetch(url: string, options: any = {}) {
  const headers: Record<string, string> = {};
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers[key] = String(value);
    }
  }

  requestLogs.push({
    url,
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.parse(options.body) : undefined,
    test: currentTest,
  });

  // Return mock response to prevent actual API calls
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        id: 'mock-response',
        object: 'chat.completion',
        choices: [
          {
            message: { content: 'Mock response' },
            finish_reason: 'stop',
          },
        ],
      }),
    text: () => Promise.resolve('Mock response'),
  });
}

let currentTest = '';

async function testActualEndpoints() {
  console.log('=== Testing Actual API Endpoints ===\n');

  // Replace global fetch with our mock
  global.fetch = mockFetch as any;

  // Clear logs
  requestLogs.length = 0;

  // Test 1: Direct OpenAI without gateway
  currentTest = 'Direct OpenAI (no gateway)';
  console.log('1. Testing direct OpenAI without gateway...');
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;

  try {
    const model = openproviders('gpt-4o-mini');
    await generateText({
      model,
      prompt: 'Test',
      maxTokens: 5,
    });
    console.log('✅ Direct OpenAI call completed');
  } catch (error: any) {
    console.log('⚠️ Expected error (mock fetch):', error.message);
  }

  // Test 2: Gateway with mock key
  currentTest = 'Gateway with mock key';
  console.log('\n2. Testing gateway with mock key...');
  process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';

  try {
    const model = openproviders('gpt-4o-mini');
    await generateText({
      model,
      prompt: 'Test',
      maxTokens: 5,
    });
    console.log('✅ Gateway call completed');
  } catch (error: any) {
    console.log('⚠️ Expected error (mock fetch):', error.message);
  }

  // Test 3: GPT-5 model without gateway (should use responses API)
  currentTest = 'GPT-5 without gateway (responses API)';
  console.log('\n3. Testing GPT-5 without gateway...');
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;

  try {
    const model = openproviders('gpt-5');
    await generateText({
      model,
      prompt: 'Test',
      maxTokens: 5,
    });
    console.log('✅ GPT-5 direct call completed');
  } catch (error: any) {
    console.log('⚠️ Expected error (mock fetch):', error.message);
  }

  // Test 4: GPT-5 with gateway (should NOT use responses API)
  currentTest = 'GPT-5 with gateway (standard API)';
  console.log('\n4. Testing GPT-5 with gateway...');
  process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';

  try {
    const model = openproviders('gpt-5');
    await generateText({
      model,
      prompt: 'Test',
      maxTokens: 5,
    });
    console.log('✅ GPT-5 gateway call completed');
  } catch (error: any) {
    console.log('⚠️ Expected error (mock fetch):', error.message);
  }

  // Restore original fetch
  global.fetch = originalFetch;

  // Analyze captured requests
  console.log('\n=== REQUEST ANALYSIS ===\n');

  requestLogs.forEach((log, index) => {
    console.log(`Request ${index + 1}: ${log.test}`);
    console.log(`URL: ${log.url}`);
    console.log(`Method: ${log.method}`);
    console.log(`Headers:`, JSON.stringify(log.headers, null, 2));
    if (log.body) {
      console.log(`Body:`, JSON.stringify(log.body, null, 2));
    }

    // Analyze endpoint
    if (log.url.includes('/responses')) {
      console.log('🔍 USES RESPONSES API (/responses)');
    } else if (log.url.includes('/chat/completions')) {
      console.log('🔍 USES CHAT COMPLETIONS API (/chat/completions)');
    } else {
      console.log('🔍 UNKNOWN ENDPOINT');
    }

    // Analyze gateway usage
    if (
      log.url.includes('gateway') ||
      log.headers.Authorization?.includes('Bearer gw_')
    ) {
      console.log('🚀 USING GATEWAY');
    } else {
      console.log('🔗 DIRECT API CALL');
    }

    console.log('---\n');
  });

  // Summary
  console.log('=== SUMMARY ===');
  const responsesCount = requestLogs.filter((log) =>
    log.url.includes('/responses')
  ).length;
  const chatCompletionsCount = requestLogs.filter((log) =>
    log.url.includes('/chat/completions')
  ).length;
  const gatewayCount = requestLogs.filter(
    (log) =>
      log.url.includes('gateway') ||
      log.headers.Authorization?.includes('Bearer gw_')
  ).length;

  console.log(`Total requests: ${requestLogs.length}`);
  console.log(`Responses API calls: ${responsesCount}`);
  console.log(`Chat Completions API calls: ${chatCompletionsCount}`);
  console.log(`Gateway calls: ${gatewayCount}`);
  console.log(`Direct API calls: ${requestLogs.length - gatewayCount}`);

  if (responsesCount > 0 && gatewayCount > 0) {
    const gatewayResponsesCount = requestLogs.filter(
      (log) =>
        log.url.includes('/responses') &&
        (log.url.includes('gateway') ||
          log.headers.Authorization?.includes('Bearer gw_'))
    ).length;

    if (gatewayResponsesCount > 0) {
      console.log(
        '\n❌ ISSUE CONFIRMED: Gateway is trying to use /responses endpoint'
      );
      console.log(`   Gateway + Responses API calls: ${gatewayResponsesCount}`);
    }
  }
}

testActualEndpoints().catch(console.error);
