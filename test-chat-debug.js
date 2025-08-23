// Debug script to test the chat API directly
const fetch = require('node-fetch');

async function testChatAPI() {
  const chatId = `test-${Date.now()}`;
  const userId = `guest-${Date.now()}`;

  const requestBody = {
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, how are you?' }],
      },
    ],
    chatId,
    userId,
    model: 'gpt-5-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
    verbosity: 'medium',
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Try to get response body
    const responseText = await response.text();

    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const _responseJson = JSON.parse(responseText);
      } catch {}
    } else if (
      response.headers.get('content-type')?.includes('text/event-stream')
    ) {
    } else {
    }

    if (response.ok) {
    } else {
      // Provide specific debugging hints
      if (response.status === 400) {
      }
    }
  } catch (_error) {}
}

// Run the test
testChatAPI()
  .then(() => {})
  .catch((_error) => {});
