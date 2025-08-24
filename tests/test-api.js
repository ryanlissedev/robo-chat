const fetch = require('node-fetch');

async function testChatAPI() {
  const response = await fetch('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          id: 'test-msg-1',
          role: 'user',
          parts: [
            { type: 'text', text: 'What are the safety features of RoboRail?' },
          ],
        },
      ],
      chatId: `test-chat-${Date.now()}`,
      userId: `guest-${Date.now()}`,
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant for RoboRail.',
      enableSearch: true,
      reasoningEffort: 'medium',
    }),
  });

  if (!response.ok) {
    const _text = await response.text();
    return;
  }

  const reader = response.body;
  const decoder = new TextDecoder();
  let buffer = '';
  let _messageCount = 0;

  for await (const chunk of reader) {
    const text = decoder.decode(chunk, { stream: true });
    buffer += text;

    // Parse SSE events
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          continue;
        }

        try {
          const _parsed = JSON.parse(data);
          _messageCount++;
        } catch (_e) {
          if (data) {
          }
        }
      }
    }
  }
}

testChatAPI().catch(console.error);
