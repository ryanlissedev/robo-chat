#!/usr/bin/env tsx

/**
 * Test script for native OpenAI file search via responses API
 * Tests the integration of file search with GPT-5 models
 */

import { streamText } from 'ai';
import { config } from 'dotenv';
import OpenAI from 'openai';
import { openproviders } from '@/lib/openproviders';

// Load environment variables
config();

async function setupVectorStore() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }

  const openai = new OpenAI({ apiKey });

  try {
    // Check if we have existing vector stores
    const stores = await openai.vectorStores.list({ limit: 5 });
    console.log('\n📚 Available Vector Stores:');
    stores.data.forEach((store) => {
      console.log(
        `  - ${store.id}: ${store.name} (${store.file_counts?.total || 0} files)`
      );
    });

    if (stores.data.length > 0) {
      return stores.data[0].id;
    }

    // Create a test vector store if none exists
    console.log('\n🔨 Creating test vector store...');
    const newStore = await openai.vectorStores.create({
      name: 'Test Vector Store for Native File Search',
      metadata: {
        purpose: 'testing',
        created_by: 'test-native-file-search.ts',
      },
    });
    console.log(`✅ Created vector store: ${newStore.id}`);
    return newStore.id;
  } catch (error) {
    console.error('❌ Error setting up vector store:', error);
    throw error;
  }
}

async function testNativeFileSearch() {
  console.log('🧪 Testing Native OpenAI File Search');
  console.log('=====================================\n');

  try {
    // Step 1: Setup vector store
    const vectorStoreId = await setupVectorStore();
    console.log(`\n🎯 Using vector store: ${vectorStoreId}`);

    // Step 2: Test with GPT-5 model using native file search
    console.log('\n🤖 Testing GPT-5 with native file search...');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    // Create model with file search enabled
    const model = openproviders(
      'gpt-5',
      {
        enableSearch: true,
        vectorStoreIds: [vectorStoreId],
        fileSearchOptions: {
          maxNumResults: 5,
          ranker: 'default_2024_08_21',
        },
      },
      apiKey
    );

    console.log('📨 Sending test prompt with file search...');

    const result = await streamText({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant with access to file search capabilities.',
        },
        {
          role: 'user',
          content:
            'Search for information about TypeScript best practices in the uploaded documents.',
        },
      ],
      // Force use of file search tool
      toolChoice: {
        type: 'tool',
        toolName: 'file_search',
      },
    });

    console.log('\n📝 Response:');
    let _responseText = '';
    for await (const chunk of result.textStream) {
      _responseText += chunk;
      process.stdout.write(chunk);
    }
    console.log('\n');

    // Check if file search was used
    const finalResult = await result.response;
    if (finalResult.toolCalls && finalResult.toolCalls.length > 0) {
      console.log('✅ File search tool was invoked!');
      console.log(
        '🔧 Tool calls:',
        JSON.stringify(finalResult.toolCalls, null, 2)
      );
    } else {
      console.log(
        '⚠️  No tool calls detected - file search may not have been invoked'
      );
    }

    console.log('\n✨ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);

    // Provide helpful debugging information
    if (error instanceof Error) {
      if (error.message.includes('vector_store')) {
        console.log(
          '\n💡 Tip: Make sure you have uploaded files to the vector store'
        );
        console.log(
          '   You can upload files using the OpenAI dashboard or API'
        );
      }
      if (error.message.includes('API key')) {
        console.log('\n💡 Tip: Set OPENAI_API_KEY in your .env file');
      }
      if (error.message.includes('gpt-5')) {
        console.log(
          '\n💡 Tip: GPT-5 model access may be limited. Try with gpt-4o instead'
        );
      }
    }

    process.exit(1);
  }
}

// Alternative test with gpt-4o (if GPT-5 is not available)
async function testWithGPT4O() {
  console.log('\n🔄 Testing with gpt-4o as fallback...');

  try {
    const vectorStoreId = await setupVectorStore();
    const apiKey = process.env.OPENAI_API_KEY!;

    // Note: gpt-4o doesn't use responses API, but we can still test file search
    const model = openproviders(
      'gpt-4o',
      {
        enableSearch: true,
        vectorStoreIds: [vectorStoreId],
        fileSearchOptions: {
          maxNumResults: 5,
        },
      },
      apiKey
    );

    const result = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'Test file search functionality',
        },
      ],
    });

    let responseText = '';
    for await (const chunk of result.textStream) {
      responseText += chunk;
    }

    console.log('✅ gpt-4o test completed');
    console.log('Response preview:', `${responseText.substring(0, 200)}...`);
  } catch (error) {
    console.error('❌ gpt-4o test failed:', error);
  }
}

// Run tests
async function main() {
  // Try GPT-5 first
  await testNativeFileSearch().catch(async (_error) => {
    console.log('\n⚠️  GPT-5 test failed, trying alternative...');
    await testWithGPT4O();
  });
}

main().catch(console.error);
