#!/usr/bin/env node

/**
 * Debug the actual stream format
 */

async function debugStream() {
  const testMessage = {
    messages: [
      {
        id: 'debug-1',
        role: 'user',
        content: 'Say hello',
        parts: [{ type: 'text', text: 'Say hello' }],
      },
    ],
    chatId: `debug-${Date.now()}`,
    userId: 'test',
    model: 'gpt-5-mini',
    isAuthenticated: false,
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let _chunkNumber = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      _chunkNumber++;

      // Show first 300 chars of each chunk
      const _preview = chunk.substring(0, 300);

      if (chunk.length > 300) {
      }

      // Analyze chunk format
      if (chunk.includes('"type":"text"')) {
      }
      if (chunk.includes('"role":"assistant"')) {
      }
      if (chunk.includes('"parts":[')) {
      }
      if (chunk.match(/^\d+:/m)) {
      }
    }
  } catch (_error) {}
}

debugStream();
