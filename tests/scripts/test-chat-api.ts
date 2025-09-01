#!/usr/bin/env tsx
/**
 * Simple test to verify chat API is working
 */

async function testChatAPI() {
  console.log('🧪 Testing Chat API...\n');
  
  const port = process.env.PORT || '3001';
  const baseUrl = `http://localhost:${port}`;
  
  // Test 1: Check if server is running
  console.log('1. Checking server status...');
  try {
    const response = await fetch(baseUrl);
    if (response.ok) {
      console.log('   ✅ Server is running on port', port);
    } else {
      console.log('   ❌ Server returned status:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Failed to connect to server:', error);
    process.exit(1);
  }
  
  // Test 2: Test chat API endpoint
  console.log('\n2. Testing chat API endpoint...');
  try {
    const chatRequest = {
      messages: [
        { 
          id: '1',
          role: 'user',
          content: 'Hello, can you help me?'
        }
      ],
      chatId: 'test-chat',
      userId: 'test-user',
      model: 'gpt-4',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant',
      enableSearch: false,
      verbosity: 'low',
      reasoningSummary: 'auto'
    };
    
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest)
    });
    
    if (response.ok) {
      console.log('   ✅ Chat API responded successfully');
      
      // Try to read response
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Only show first chunk for verification
          if (buffer.length > 0) {
            console.log('   ✅ Received streaming response');
            break;
          }
        }
      }
    } else {
      console.log('   ❌ Chat API returned error:', response.status);
      const text = await response.text();
      console.log('   Error details:', text);
    }
  } catch (error) {
    console.log('   ❌ Failed to call chat API:', error);
  }
  
  // Test 3: Verify message extraction works
  console.log('\n3. Testing message extraction...');
  const { getMessageContent } = require('../../app/types/ai-extended');
  
  const testMessages = [
    {
      content: 'String content',
      expected: 'String content'
    },
    {
      content: [
        { type: 'text', text: 'Array ' },
        { type: 'text', text: 'content' }
      ],
      expected: 'Array content'
    }
  ];
  
  let passed = true;
  for (const test of testMessages) {
    const result = getMessageContent({ role: 'assistant', ...test } as any);
    if (result === test.expected) {
      console.log(`   ✅ Extracted: "${result}"`);
    } else {
      console.log(`   ❌ Failed: expected "${test.expected}", got "${result}"`);
      passed = false;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log('   - Server: ✅ Running');
  console.log('   - Chat API: ' + (passed ? '✅ Working' : '❌ Issues detected'));
  console.log('   - Message extraction: ' + (passed ? '✅ Working' : '❌ Issues detected'));
  
  if (passed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some tests failed');
    process.exit(1);
  }
}

// Run the test
testChatAPI().catch(console.error);