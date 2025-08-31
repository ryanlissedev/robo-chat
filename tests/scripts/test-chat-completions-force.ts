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

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

// Mock fetch to intercept HTTP requests
const requestLogs: Array<{
  url: string;
  method: string;
  test: string;
}> = [];

function mockFetch(url: string, options: any = {}) {
  requestLogs.push({
    url,
    method: options.method || 'GET',
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
const originalFetch = global.fetch;

async function testChatCompletionsForce() {
  console.log('=== Testing Ways to Force Chat Completions API ===\n');

  // Replace global fetch with our mock
  global.fetch = mockFetch as any;
  requestLogs.length = 0;

  // Test 1: Explicit baseURL to chat/completions
  currentTest = 'Explicit baseURL to chat/completions';
  console.log('1. Testing explicit baseURL to /chat/completions...');
  try {
    const provider = createOpenAI({
      baseURL: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 2: Create with compatibility flag
  currentTest = 'Create with compatibility option';
  console.log('2. Testing with compatibility option...');
  try {
    const provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      compatibility: 'strict' as any, // Try compatibility mode
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 3: Use older base URL pattern
  currentTest = 'Use base URL without specific endpoint';
  console.log('3. Testing base URL without specific endpoint...');
  try {
    const provider = createOpenAI({
      baseURL: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 4: Try with fetch configuration
  currentTest = 'Custom fetch configuration';
  console.log('4. Testing with custom fetch configuration...');
  try {
    const provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      fetch: global.fetch as any,
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 5: Try with headers that might change behavior
  currentTest = 'Headers to force chat completions';
  console.log('5. Testing with headers to force chat completions...');
  try {
    const provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      headers: {
        'OpenAI-API-Version': '2020-10-01', // Older API version
        'User-Agent': 'OpenAI-Chat-Client',
      },
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 6: Try creating with explicit model configuration
  currentTest = 'Model-specific configuration';
  console.log('6. Testing model-specific configuration...');
  try {
    const provider = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      organization: undefined, // Clear organization
    });
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Restore original fetch
  global.fetch = originalFetch;

  // Analyze results
  console.log('\n=== ANALYSIS ===\n');

  requestLogs.forEach((log, index) => {
    console.log(`${index + 1}. ${log.test}`);
    console.log(`   URL: ${log.url}`);
    if (log.url.includes('/responses')) {
      console.log('   ❌ STILL USES RESPONSES API');
    } else if (log.url.includes('/chat/completions')) {
      console.log('   ✅ SUCCESS: USES CHAT COMPLETIONS API');
    } else {
      console.log('   ❓ UNKNOWN ENDPOINT');
    }
    console.log('');
  });

  console.log('=== SUMMARY ===');
  const responsesCount = requestLogs.filter((log) =>
    log.url.includes('/responses')
  ).length;
  const chatCompletionsCount = requestLogs.filter((log) =>
    log.url.includes('/chat/completions')
  ).length;

  console.log(`Total tests: ${requestLogs.length}`);
  console.log(`Still using responses API: ${responsesCount}`);
  console.log(
    `Successfully using chat completions API: ${chatCompletionsCount}`
  );

  if (chatCompletionsCount > 0) {
    console.log(
      '\n🎉 FOUND SOLUTION! Some methods work to force chat completions API'
    );
  } else {
    console.log('\n🚨 NO SOLUTION FOUND: All methods still use responses API');
    console.log(
      'This may require downgrading AI SDK or using a different approach'
    );
  }
}

testChatCompletionsForce().catch(console.error);
