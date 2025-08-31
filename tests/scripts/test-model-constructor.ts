#!/usr/bin/env tsx
import { createOpenAI, openai } from '@ai-sdk/openai';

async function testModelConstructors() {
  console.log('=== Model Constructor Test ===\n');

  // Test 1: Default openai provider
  console.log('1. Default openai provider:');
  const model1 = openai('gpt-4o-mini');
  console.log('Constructor:', model1.constructor.name);

  // Test 2: Created OpenAI provider (no special config)
  console.log('2. Created OpenAI provider (no config):');
  const provider2 = createOpenAI({});
  const model2 = provider2('gpt-4o-mini');
  console.log('Constructor:', model2.constructor.name);

  // Test 3: Created OpenAI provider with headers
  console.log('3. Created OpenAI provider (with headers):');
  const provider3 = createOpenAI({
    headers: { 'User-Agent': 'test' },
  });
  const model3 = provider3('gpt-4o-mini');
  console.log('Constructor:', model3.constructor.name);

  // Test 4: Created OpenAI provider with baseURL (gateway simulation)
  console.log('4. Created OpenAI provider (with baseURL):');
  const provider4 = createOpenAI({
    baseURL: 'https://ai-gateway.vercel.sh/v1',
    apiKey: 'test-key',
  });
  const model4 = provider4('gpt-4o-mini');
  console.log('Constructor:', model4.constructor.name);

  // Test 5: Responses API
  console.log('5. Responses API:');
  const model5 = openai.responses('gpt-5');
  console.log('Constructor:', model5.constructor.name);
}

testModelConstructors();
