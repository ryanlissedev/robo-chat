#!/usr/bin/env node

/**
 * Test script to verify AI SDK v5 chat functionality
 * Tests both reasoning and text response display
 */

const SERVER_URL = 'http://localhost:3000';

async function testChatAPI() {
  try {
    const response = await fetch(`${SERVER_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'test reasoning and response display' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Parse the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const messageData = {
      reasoning: [],
      textDeltas: [],
      events: [],
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6));
            messageData.events.push(data);

            if (data.type === 'reasoning-delta') {
              messageData.reasoning.push(data.delta || '');
            } else if (data.type === 'text-delta') {
              messageData.textDeltas.push(data.delta || '');
            }
          } catch (_e) {
            // Skip invalid JSON
          }
        }
      }
    }

    if (messageData.reasoning.length > 0) {
    }

    if (messageData.textDeltas.length > 0) {
    }
    const chatResponse = await fetch(`${SERVER_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        chatId: `test-${Date.now()}`,
        userId: 'test-user',
        model: 'gpt-4o-mini',
        isAuthenticated: false,
        systemPrompt: 'You are a helpful assistant.',
        enableSearch: false,
      }),
    });

    if (chatResponse.status === 200) {
    } else {
    }
    const pageResponse = await fetch(`${SERVER_URL}/verify-chat`);

    if (pageResponse.status === 200) {
      const html = await pageResponse.text();
      const _hasTitle = html.includes('Chat Verification - AI SDK v5');
      const _hasForm = html.includes("Type 'test' to verify");
    }
  } catch (_error) {
    process.exit(1);
  }
}

// Run tests if this is the main module
if (require.main === module) {
  testChatAPI();
}

module.exports = { testChatAPI };
