#!/usr/bin/env node

/**
 * Test script to verify the UI is now displaying responses correctly
 * This simulates what would happen in a browser
 */

const _fs = require('node:fs');

async function testUIResponse() {
  try {
    const pageResponse = await fetch('http://localhost:3000/verify-chat');

    if (pageResponse.status !== 200) {
      throw new Error(`Page not accessible: ${pageResponse.status}`);
    }

    const html = await pageResponse.text();

    // Check for key elements
    const _hasChat = html.includes('Chat Verification - AI SDK v5');
    const _hasForm = html.includes("Type 'test' to verify");
    const _hasDebugInfo = html.includes('Debug Info');
    const apiResponse = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test ui response' }],
      }),
    });

    if (!apiResponse.ok) {
      throw new Error(`API error: ${apiResponse.status}`);
    }

    // Parse the streaming response to verify ID consistency
    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const events = [];
    const ids = new Set();
    const reasoningIds = new Set();
    const textIds = new Set();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const event = JSON.parse(line.slice(6));
            events.push(event);

            if (event.id) {
              ids.add(event.id);
              if (event.type === 'reasoning-delta') {
                reasoningIds.add(event.id);
              } else if (event.type === 'text-delta') {
                textIds.add(event.id);
              }
            }
          } catch (_e) {
            // Skip invalid JSON
          }
        }
      }
    }

    const _reasoningEvents = events.filter((e) => e.type === 'reasoning-delta');
    const _textEvents = events.filter((e) => e.type === 'text-delta');

    // 3. Verify the fix worked
    const reasoningConsistent = reasoningIds.size === 1;
    const textConsistent = textIds.size === 1;

    if (reasoningConsistent && textConsistent) {
    } else {
    }
  } catch (_error) {}
}

// Run the test
testUIResponse();
