// Test the chat API directly to verify it works
const fetch = require('node-fetch');

async function testChatAPI() {
  console.log('🧪 Testing Chat API directly...\n');

  const payload = {
    messages: [
      {
        id: 'test-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, how are you?' }],
      },
    ],
    chatId: 'test-chat-' + Date.now(),
    userId: 'guest-' + Date.now(),
    model: 'gpt-5-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
  };

  console.log('📤 Request payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n');

  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 Response status:', response.status);
    console.log(
      '📥 Response headers:',
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      console.log('✅ API call successful!');
      // For streaming responses, we might not get JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('Response data:', data);
      } else {
        console.log('Response is streaming or non-JSON');
      }
    } else {
      console.log('❌ API call failed');
      const text = await response.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testChatAPI();
