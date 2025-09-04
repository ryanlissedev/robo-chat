import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test GPT-5 model endpoints according to September 2025 documentation
 */

const testPrompt = 'Say "Hello from GPT-5" and state your model name.';

async function testGPT5Model(modelId: string, useResponsesAPI: boolean = true) {
  console.log(`\n=== Testing ${modelId} ===`);
  console.log(`Using ${useResponsesAPI ? 'Responses' : 'Chat'} API`);
  
  try {
    const model = useResponsesAPI
      ? openai.responses(modelId) // Use responses API for GPT-5 models
      : openai(modelId); // Use chat API (fallback)
    
    // Test basic generation
    console.log('Testing generateText...');
    const result = await generateText({
      model,
      prompt: testPrompt,
      maxTokens: 100,
      temperature: 0.7,
    });
    
    console.log('✅ Success!');
    console.log('Response:', result.text);
    console.log('Usage:', {
      inputTokens: result.usage?.promptTokens,
      outputTokens: result.usage?.completionTokens,
      totalTokens: result.usage?.totalTokens,
    });
    
    // Test streaming
    console.log('\nTesting streamText...');
    const stream = await streamText({
      model,
      prompt: testPrompt,
      maxTokens: 100,
      temperature: 0.7,
    });
    
    let streamedText = '';
    for await (const chunk of stream.textStream) {
      streamedText += chunk;
    }
    console.log('✅ Stream Success!');
    console.log('Streamed Response:', streamedText);
    
    return { success: true, model: modelId, api: useResponsesAPI ? 'responses' : 'chat' };
  } catch (error: any) {
    console.error(`❌ Failed for ${modelId}:`, error.message);
    
    // If responses API fails, try chat API as fallback
    if (useResponsesAPI && error.message?.includes('404')) {
      console.log('Retrying with Chat API...');
      return testGPT5Model(modelId, false);
    }
    
    return { 
      success: false, 
      model: modelId, 
      api: useResponsesAPI ? 'responses' : 'chat',
      error: error.message 
    };
  }
}

async function testAllGPT5Models() {
  console.log('🚀 Testing GPT-5 Model Endpoints (September 2025)');
  console.log('='.repeat(60));
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    process.exit(1);
  }
  
  const models = [
    'gpt-5',       // Flagship model
    'gpt-5-mini',  // Default model for most use cases
    'gpt-5-nano',  // Ultra-fast lightweight model
  ];
  
  const results = [];
  
  for (const model of models) {
    const result = await testGPT5Model(model);
    results.push(result);
    
    // Add delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  if (successful.length > 0) {
    console.log('\n✅ Working Models:');
    successful.forEach(r => {
      console.log(`  - ${r.model} (${r.api} API)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed Models:');
    failed.forEach(r => {
      console.log(`  - ${r.model}: ${r.error}`);
    });
  }
  
  // Test with provider options for GPT-5 models
  console.log('\n' + '='.repeat(60));
  console.log('🔧 Testing with Provider Options:');
  console.log('='.repeat(60));
  
  try {
    const result = await generateText({
      model: openai.responses('gpt-5-mini'),
      prompt: 'What is 2 + 2?',
      maxTokens: 50,
      providerOptions: {
        openai: {
          textVerbosity: 'low',
          reasoningSummary: 'auto',
          serviceTier: 'auto',
        },
      },
    });
    
    console.log('✅ Provider options work!');
    console.log('Response:', result.text);
  } catch (error: any) {
    console.error('❌ Provider options failed:', error.message);
  }
  
  console.log('\n✨ Test Complete!');
}

// Run the tests
testAllGPT5Models().catch(console.error);