// Test script to debug streaming response format
const fetch = require('node-fetch');

async function testStreamingResponse() {
  const requestBody = {
    messages: [
      {
        role: 'user',
        content: 'Hi, can you help me test the chat?',
        parts: [{ type: 'text', text: 'Hi, can you help me test the chat?' }],
      },
    ],
    chatId: 'test-chat-1',
    userId: 'test-user-1',
    model: 'gpt-4o-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const _error = await response.text();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Parse each line
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          // Try to parse AI SDK v5 format
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const _type = line.substring(0, colonIndex);
            const data = line.substring(colonIndex + 1);

            try {
              const _parsed = JSON.parse(data);
            } catch (_e) {}
          }
        }
      }
    }
  } catch (_error) {}
}
testStreamingResponse();
