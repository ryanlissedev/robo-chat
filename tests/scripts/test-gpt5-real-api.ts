#!/usr/bin/env bun

/**
 * Real API test for GPT-5 models
 * Tests actual OpenAI endpoints with proper SDK configuration
 */

import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Load environment variables
if (!process.env.OPENAI_API_KEY) {
  // Try to load from .env.local first (Next.js convention)
  try {
    const fs = await import('fs');
    const path = await import('path');
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }
  } catch (e) {
    // Ignore if can't load
  }
}

interface TestResult {
  model: string;
  api: 'responses' | 'chat';
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

async function testGPT5WithResponsesAPI(modelId: string): Promise<TestResult> {
  console.log(`\n🔧 Testing ${modelId} with Responses API`);
  
  try {
    // Use the responses API as recommended for GPT-5 models
    const model = openai.responses(modelId as any);
    
    const result = await generateText({
      model,
      prompt: 'Say "Hello from GPT-5" and state your model name in 10 words or less.',
      maxTokens: 50,
      temperature: 0.7,
      // GPT-5 specific options
      providerOptions: {
        openai: {
          textVerbosity: 'low',
          reasoningSummary: 'auto',
          serviceTier: 'auto',
        },
      },
    });
    
    console.log('✅ Success with Responses API');
    console.log('Response:', result.text);
    console.log('Tokens:', {
      input: result.usage?.promptTokens,
      output: result.usage?.completionTokens,
      total: result.usage?.totalTokens,
    });
    
    return {
      model: modelId,
      api: 'responses',
      success: true,
      response: result.text,
      usage: {
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
      },
    };
  } catch (error: any) {
    console.error(`❌ Responses API failed:`, error.message);
    return {
      model: modelId,
      api: 'responses',
      success: false,
      error: error.message,
    };
  }
}

async function testGPT5WithChatAPI(modelId: string): Promise<TestResult> {
  console.log(`\n🔧 Testing ${modelId} with Chat API (fallback)`);
  
  try {
    // Fallback to chat API
    const model = openai(modelId as any);
    
    const result = await generateText({
      model,
      prompt: 'Say "Hello from GPT-5" and state your model name in 10 words or less.',
      maxTokens: 50,
      temperature: 0.7,
    });
    
    console.log('✅ Success with Chat API');
    console.log('Response:', result.text);
    console.log('Tokens:', {
      input: result.usage?.promptTokens,
      output: result.usage?.completionTokens,
      total: result.usage?.totalTokens,
    });
    
    return {
      model: modelId,
      api: 'chat',
      success: true,
      response: result.text,
      usage: {
        inputTokens: result.usage?.promptTokens,
        outputTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
      },
    };
  } catch (error: any) {
    console.error(`❌ Chat API failed:`, error.message);
    return {
      model: modelId,
      api: 'chat',
      success: false,
      error: error.message,
    };
  }
}

async function testStreamingAPI(modelId: string): Promise<void> {
  console.log(`\n📡 Testing streaming for ${modelId}`);
  
  try {
    const model = openai.responses(modelId as any);
    
    const result = await streamText({
      model,
      prompt: 'Count from 1 to 5.',
      maxTokens: 50,
      temperature: 0.7,
      providerOptions: {
        openai: {
          textVerbosity: 'low',
        },
      },
    });
    
    let fullText = '';
    process.stdout.write('Stream: ');
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    console.log('\n✅ Streaming successful');
  } catch (error: any) {
    console.error(`❌ Streaming failed:`, error.message);
  }
}

async function main() {
  console.log('🚀 GPT-5 Real API Test (September 2025)');
  console.log('=' .repeat(60));
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY not found in environment');
    console.log('Please set your OpenAI API key in .env file');
    process.exit(1);
  }
  
  console.log('✅ API Key found');
  console.log('📅 Date:', new Date().toISOString());
  console.log('');
  
  const models = [
    'gpt-5-mini',  // Default model - best balance
    'gpt-5-nano',  // Ultra-fast lightweight
    'gpt-5',       // Flagship model
  ];
  
  const results: TestResult[] = [];
  
  // Test each model
  for (const modelId of models) {
    console.log('\n' + '='.repeat(60));
    console.log(`📦 Testing Model: ${modelId}`);
    console.log('='.repeat(60));
    
    // Try Responses API first (recommended for GPT-5)
    const responsesResult = await testGPT5WithResponsesAPI(modelId);
    results.push(responsesResult);
    
    // If Responses API fails, try Chat API as fallback
    if (!responsesResult.success) {
      const chatResult = await testGPT5WithChatAPI(modelId);
      results.push(chatResult);
    }
    
    // Test streaming if basic test succeeded
    if (responsesResult.success) {
      await testStreamingAPI(modelId);
    }
    
    // Add delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log('\n✅ Working Models:');
    successful.forEach(r => {
      console.log(`  • ${r.model} (${r.api} API)`);
      if (r.response) {
        console.log(`    Response: "${r.response}"`);
      }
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Models:');
    failed.forEach(r => {
      console.log(`  • ${r.model} (${r.api} API): ${r.error}`);
    });
  }
  
  // Recommendations
  console.log('\n' + '='.repeat(60));
  console.log('💡 Recommendations:');
  console.log('='.repeat(60));
  
  if (successful.length === 0) {
    console.log('⚠️  No models are working. Possible issues:');
    console.log('  1. GPT-5 models may not be available yet in your region/account');
    console.log('  2. Check if your API key has access to GPT-5 models');
    console.log('  3. The models might be in limited preview');
    console.log('  4. Try using gpt-4o or gpt-4o-mini as alternatives');
  } else {
    console.log('✅ GPT-5 models are available and working!');
    console.log('  • Use gpt-5-mini as default (best balance)');
    console.log('  • Use gpt-5-nano for high-volume, simple tasks');
    console.log('  • Use gpt-5 for complex reasoning tasks');
  }
  
  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});