#!/usr/bin/env node

/**
 * End-to-end test for chat functionality
 */

const _https = require('node:https');
const _http = require('node:http');

async function testChatFlow() {
  const testMessage = {
    messages: [
      {
        id: 'test-msg-1',
        role: 'user',
        content: 'Hello! Can you count to 3?',
        parts: [{ type: 'text', text: 'Hello! Can you count to 3?' }],
      },
    ],
    chatId: `test-chat-${Date.now()}`,
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false,
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
      const _error = await response.text();
      return;
    }

    // Read and parse the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponseText = '';
    const chunks = [];
    let messageData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);

      // Parse AI SDK v5 UI Message format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('0:')) {
          // This is the UI message format
          try {
            const jsonStr = line.substring(2);
            const data = JSON.parse(jsonStr);

            if (data.id && data.role === 'assistant') {
              messageData = data;

              // Extract text from parts array
              if (data.parts && Array.isArray(data.parts)) {
                const textParts = data.parts.filter((p) => p.type === 'text');
                aiResponseText = textParts.map((p) => p.text || '').join('');
              }
            }
          } catch (_e) {
            // Not a complete JSON object yet, continue
          }
        } else if (line.startsWith('8:')) {
          // Text delta chunks
          const match = line.match(/8:"(.*)"/);
          if (match) {
            aiResponseText += match[1];
          }
        }
      }
    }

    if (aiResponseText) {
    }

    if (messageData) {
      const hasRequiredFields =
        messageData.id &&
        messageData.role === 'assistant' &&
        (messageData.parts || messageData.content);

      if (hasRequiredFields) {
      } else {
      }
    } else {
    }
    if (aiResponseText && messageData) {
    } else {
      if (!aiResponseText) {
      }
      if (!messageData) {
      }
    }
  } catch (_error) {}
}

// Run the test
testChatFlow().catch(console.error);
