#!/usr/bin/env node

/**
 * Direct test of chat API to verify message handling
 */

const testChatAPI = async () => {
  console.log('🧪 Testing Chat API directly...\n');

  const apiUrl = 'http://localhost:3000/api/chat';
  
  const testMessage = {
    messages: [
      {
        id: 'msg-test-1',
        role: 'user',
        content: 'Hello, can you see this message?',
        parts: [{ type: 'text', text: 'Hello, can you see this message?' }]
      }
    ],
    chatId: 'test-chat-' + Date.now(),
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: true,
    enableSearch: false
  };

  console.log('📤 Sending test message:', JSON.stringify(testMessage, null, 2));

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    console.log('\n📥 Response Status:', response.status);
    console.log('📥 Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }

    // Read streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let chunks = [];

    console.log('\n🔄 Reading stream chunks:');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
      fullResponse += chunk;
      
      // Parse and display chunk info
      if (chunk.startsWith('0:')) {
        console.log(`  ✅ Received text chunk: ${chunk.substring(0, 100)}...`);
      }
    }

    console.log('\n📊 Stream Analysis:');
    console.log(`  - Total chunks received: ${chunks.length}`);
    console.log(`  - Total response length: ${fullResponse.length} characters`);
    
    // Try to extract the actual text from AI SDK format
    const textMatch = fullResponse.match(/0:"(.*)"/);
    if (textMatch) {
      const extractedText = textMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
      console.log('\n💬 Extracted AI Response:');
      console.log(extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));
    } else {
      console.log('\n⚠️  Could not extract text from response format');
      console.log('Raw response sample:', fullResponse.substring(0, 200));
    }

    console.log('\n✅ Chat API test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
};

// Run the test
testChatAPI();