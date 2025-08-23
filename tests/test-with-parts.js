#!/usr/bin/env node

/**
 * Test API with parts array format
 */

async function testWithParts() {
  const payload = {
    messages: [
      {
        id: 'test-parts-1',
        role: 'user',
        content: 'Hello, please respond',
        parts: [{ type: 'text', text: 'Hello, please respond' }],
      },
    ],
    chatId: 'test-parts',
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false,
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return;
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let _eventCount = 0;

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
            continue;
          }

          try {
            const event = JSON.parse(data);
            if (event.type === 'text-delta') {
              fullText += event.delta || '';
            }
          } catch (_e) {
            // Skip parse errors
          }
        }
      }
    }
    if (fullText) {
    }
  } catch (_error) {}
}

testWithParts();
