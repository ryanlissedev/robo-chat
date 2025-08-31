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

async function debugProviderCalls() {
  console.log('=== Provider Call Debug ===\n');

  // Test without gateway (baseline)
  console.log('1. Testing without gateway:');
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;

  try {
    const model = openproviders('gpt-4o-mini');
    console.log('Model created successfully');
    console.log('Model type:', typeof model);
    console.log('Model constructor:', model.constructor.name);

    // Check if it's trying to use responses API
    console.log('Attempting generateText...');
    const result = await generateText({
      model,
      prompt: 'Say "Hello"',
      maxTokens: 5,
    });
    console.log('Result:', result.text);
    console.log('✅ Without gateway works\n');
  } catch (error: any) {
    console.error('❌ Without gateway failed:', error.message);
    console.error('URL:', error.url);
    console.log();
  }

  // Test with mock gateway
  console.log('2. Testing with mock gateway:');
  process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';

  try {
    const model = openproviders('gpt-4o-mini');
    console.log('Model created successfully');
    console.log('Model type:', typeof model);
    console.log('Model constructor:', model.constructor.name);

    // Check if it's trying to use responses API
    console.log('Attempting generateText...');
    const result = await generateText({
      model,
      prompt: 'Say "Hello"',
      maxTokens: 5,
    });
    console.log('Result:', result.text);
    console.log('✅ With gateway works\n');
  } catch (error: any) {
    console.error('❌ With gateway failed:', error.message);
    console.error('URL:', error.url);
    console.log();
  }

  // Test GPT-5 model without gateway
  console.log('3. Testing GPT-5 without gateway:');
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;

  try {
    const model = openproviders('gpt-5');
    console.log('GPT-5 Model created successfully');
    console.log('Model type:', typeof model);
    console.log('Model constructor:', model.constructor.name);
    console.log('Should use responses API: TRUE');
  } catch (error: any) {
    console.error('❌ GPT-5 creation failed:', error.message);
  }

  // Test GPT-5 model WITH gateway
  console.log('4. Testing GPT-5 with gateway:');
  process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';

  try {
    const model = openproviders('gpt-5');
    console.log('GPT-5 Model with gateway created successfully');
    console.log('Model type:', typeof model);
    console.log('Model constructor:', model.constructor.name);
    console.log('Should use responses API: FALSE (gateway mode)');
  } catch (error: any) {
    console.error('❌ GPT-5 with gateway creation failed:', error.message);
  }
}

debugProviderCalls();
