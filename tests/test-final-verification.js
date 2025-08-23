#!/usr/bin/env node

/**
 * Final verification of chat functionality
 */

async function verifyChat() {
  const testMessage = {
    messages: [
      {
        id: 'verify-1',
        role: 'user',
        content: 'Testing: please respond with "Hello, I am working!"',
        parts: [
          {
            type: 'text',
            text: 'Testing: please respond with "Hello, I am working!"',
          },
        ],
      },
    ],
    chatId: `verify-${Date.now()}`,
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false,
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
      return;
    }

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let _eventCount = 0;
    let hasTextDelta = false;
    let hasFinish = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          _eventCount++;
          const data = line.substring(6);

          if (data === '[DONE]') {
            hasFinish = true;
            continue;
          }

          try {
            const event = JSON.parse(data);

            if (event.type === 'text-delta') {
              hasTextDelta = true;
              fullText += event.delta || '';
              process.stdout.write(event.delta || '');
            } else if (event.type === 'text-start') {
            } else if (event.type === 'text-end') {
            }
          } catch (_e) {
            // Skip parse errors
          }
        }
      }
    }

    if (fullText.length > 0) {
    }

    if (hasTextDelta && hasFinish && fullText.length > 0) {
    } else {
      if (!hasTextDelta) {
      }
      if (!hasFinish) {
      }
      if (fullText.length === 0) {
      }
    }
  } catch (_error) {}
}

verifyChat();
