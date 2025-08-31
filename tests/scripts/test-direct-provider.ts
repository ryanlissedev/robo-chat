#!/usr/bin/env tsx
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

// Test with gateway ENABLED from the start
process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';

console.log('=== Direct Provider Test ===\n');
console.log(
  `Gateway Key: ${process.env.AI_GATEWAY_API_KEY ? '[SET]' : '[NOT SET]'}`
);

import { generateText } from 'ai';
import { openproviders } from '../../lib/openproviders';
// Import AFTER setting environment variables
import { getGatewayConfig } from '../../lib/openproviders/env';

const gatewayConfig = getGatewayConfig();
console.log('Gateway Config:');
console.log(`- enabled: ${gatewayConfig.enabled}`);
console.log(`- baseURL: ${gatewayConfig.baseURL}`);
console.log(`- has headers: ${Object.keys(gatewayConfig.headers).length > 0}`);

const requestLogs: Array<{
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}> = [];

// Mock fetch to intercept requests
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
  });

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

const originalFetch = global.fetch;
global.fetch = mockFetch as any;

async function testDirectProvider() {
  console.log('\nTesting gpt-4o-mini with gateway enabled...');

  try {
    const model = openproviders('gpt-4o-mini');
    await generateText({
      model,
      prompt: 'Test',
      maxTokens: 5,
    });
    console.log('✅ Request completed');
  } catch (error: any) {
    console.log('⚠️ Expected error (mock):', error.message);
  }

  // Restore fetch
  global.fetch = originalFetch;

  // Analyze request
  if (requestLogs.length > 0) {
    const request = requestLogs[0];
    console.log('\n=== REQUEST ANALYSIS ===');
    console.log(`URL: ${request.url}`);
    console.log(`Method: ${request.method}`);
    console.log(`Authorization: ${request.headers.Authorization || '[NONE]'}`);
    console.log(`Body model: ${request.body?.model || '[NONE]'}`);

    if (request.url.includes('/responses')) {
      console.log('❌ STILL USING RESPONSES API');
    } else if (request.url.includes('/chat/completions')) {
      console.log('✅ SUCCESS: USING CHAT COMPLETIONS API');
    } else {
      console.log('❓ UNKNOWN ENDPOINT');
    }

    if (request.url.includes('gateway')) {
      console.log('✅ USING GATEWAY URL');
    } else {
      console.log('❌ NOT USING GATEWAY URL');
    }
  } else {
    console.log('❌ NO REQUESTS CAPTURED');
  }
}

testDirectProvider().catch(console.error);
