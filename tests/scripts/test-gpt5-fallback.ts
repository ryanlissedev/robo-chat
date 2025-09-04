#!/usr/bin/env bun

/**
 * Test GPT-5 models with fallback handling
 */

import { openproviders } from '@/lib/openproviders';
import { generateText } from 'ai';

async function testGPT5WithFallback() {
  console.log('🚀 Testing GPT-5 Models with Fallback Handling');
  console.log('=' .repeat(60));
  
  const models = [
    { id: 'gpt-5-mini', expected: 'gpt-4o-mini' },
    { id: 'gpt-5-nano', expected: 'gpt-4o-mini' },
    { id: 'gpt-5', expected: 'gpt-4o' },
  ];
  
  for (const { id, expected } of models) {
    console.log(`\n📦 Testing ${id} (should fallback to ${expected})`);
    
    try {
      const model = openproviders(id as any);
      
      const result = await generateText({
        model,
        prompt: 'Say hello and your model name',
        maxTokens: 50,
      });
      
      console.log('✅ Success!');
      console.log('Response:', result.text);
      
      // Check if response indicates the fallback model
      if (result.text.toLowerCase().includes('gpt-4')) {
        console.log('✓ Correctly using GPT-4o fallback');
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n✨ Test Complete!');
}

testGPT5WithFallback().catch(console.error);