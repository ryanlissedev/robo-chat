#!/usr/bin/env node

/**
 * Direct test of chat API to verify message handling
 */

const testChatAPI = async () => {
  const apiUrl = 'http://localhost:3000/api/chat';

  const testMessage = {
    messages: [
      {
        id: 'msg-test-1',
        role: 'user',
        content: 'Hello, can you see this message?',
        parts: [{ type: 'text', text: 'Hello, can you see this message?' }],
      },
    ],
    chatId: `test-chat-${Date.now()}`,
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: true,
    enableSearch: false,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
      const _errorText = await response.text();
      return;
    }

    // Read streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
      fullResponse += chunk;

      // Parse and display chunk info
      if (chunk.startsWith('0:')) {
      }
    }

    // Try to extract the actual text from AI SDK format
    const textMatch = fullResponse.match(/0:"(.*)"/);
    if (textMatch) {
      const _extractedText = textMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n');
    } else {
    }
  } catch (_error) {}
};

// Run the test
testChatAPI();
