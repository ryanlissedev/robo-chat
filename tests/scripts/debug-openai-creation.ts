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

import { createOpenAI, openai } from '@ai-sdk/openai';
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

async function debugOpenAICreation() {
  console.log('=== Testing Different OpenAI Provider Creation Methods ===\n');

  // Replace global fetch with our mock
  global.fetch = mockFetch as any;
  requestLogs.length = 0;

  // Test 1: Default openai import
  currentTest = 'Default openai import';
  console.log('1. Testing default openai import...');
  try {
    await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 2: createOpenAI with empty config
  currentTest = 'createOpenAI empty config';
  console.log('2. Testing createOpenAI with empty config...');
  try {
    const provider = createOpenAI({});
    await generateText({
      model: provider('gpt-4o-mini'),
      prompt: 'Test',
      maxTokens: 5,
    });
  } catch (_error: any) {
    console.log('⚠️ Expected error (mock)');
  }

  // Test 3: createOpenAI with API key
  currentTest = 'createOpenAI with API key';
  console.log('3. Testing createOpenAI with API key...');
  try {
    const provider = createOpenAI({
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

  // Test 4: createOpenAI with baseURL
  currentTest = 'createOpenAI with baseURL';
  console.log('4. Testing createOpenAI with explicit baseURL...');
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

  // Test 5: openai.responses() explicitly
  currentTest = 'openai.responses() explicit';
  console.log('5. Testing openai.responses() explicitly...');
  try {
    await generateText({
      model: openai.responses('gpt-4o-mini'),
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
      console.log('   ❌ USES RESPONSES API');
    } else if (log.url.includes('/chat/completions')) {
      console.log('   ✅ USES CHAT COMPLETIONS API');
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
  console.log(`Using responses API: ${responsesCount}`);
  console.log(`Using chat completions API: ${chatCompletionsCount}`);

  if (responsesCount === requestLogs.length) {
    console.log('\n🚨 ALL providers are defaulting to responses API!');
    console.log('This suggests the AI SDK has changed its default behavior.');
  }
}

debugOpenAICreation().catch(console.error);
