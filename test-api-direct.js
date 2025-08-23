// Test the chat API directly to verify it works
const fetch = require('node-fetch');

async function testChatAPI() {
  const payload = {
    messages: [
      {
        id: 'test-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, how are you?' }],
      },
    ],
    chatId: `test-chat-${Date.now()}`,
    userId: `guest-${Date.now()}`,
    model: 'gpt-5-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
  };

  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // For streaming responses, we might not get JSON
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const _data = await response.json();
      } else {
      }
    } else {
      const _text = await response.text();
    }
  } catch (_error) {}
}

testChatAPI();
