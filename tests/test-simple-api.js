#!/usr/bin/env node

/**
 * Simple API test with minimal payload
 */

async function testSimpleAPI() {
  const payload = {
    messages: [
      {
        id: 'test-1',
        role: 'user',
        content: 'Hi',
      },
    ],
    chatId: 'test-simple',
    userId: 'test-user',
    model: 'gpt-5-mini',
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
    } else {
      const _text = await response.text();
    }
  } catch (_error) {}
}

testSimpleAPI();
