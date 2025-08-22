// Test script to debug streaming response format
const fetch = require('node-fetch');

async function testStreamingResponse() {
  const requestBody = {
    messages: [
      { 
        role: 'user', 
        content: 'Hi, can you help me test the chat?',
        parts: [{ type: 'text', text: 'Hi, can you help me test the chat?' }]
      }
    ],
    chatId: 'test-chat-1',
    userId: 'test-user-1',
    model: 'gpt-4o-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium'
  };

  console.log('📤 Sending request:', JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error response:', error);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    console.log('\n🔄 Streaming chunks:');
    console.log('=' . repeat(50));

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      // Parse each line
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          console.log('📦 Raw chunk:', line);
          
          // Try to parse AI SDK v5 format
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const type = line.substring(0, colonIndex);
            const data = line.substring(colonIndex + 1);
            
            console.log('  Type:', type);
            
            try {
              const parsed = JSON.parse(data);
              console.log('  Parsed data:', JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log('  Raw data:', data);
            }
          }
        }
      }
    }

    console.log('=' . repeat(50));
    console.log('✅ Stream complete');

  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Run the test
console.log('🚀 Starting streaming debug test...\n');
testStreamingResponse();