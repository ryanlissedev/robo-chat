// Test script to debug the chat API
const testChatAPI = async () => {
  try {
    // First get CSRF token
    const csrfResponse = await fetch('http://localhost:3000/api/csrf');
    const { csrfToken } = await csrfResponse.json();

    // Prepare test request
    const testPayload = {
      messages: [
        {
          role: 'user',
          content: 'Hello, tell me about RoboRail',
          parts: [{ type: 'text', text: 'Hello, tell me about RoboRail' }],
        },
      ],
      chatId: `test-chat-${Date.now()}`,
      userId: `guest-${Date.now()}`,
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant.',
      enableSearch: true,
      reasoningEffort: 'medium',
    };

    // Make the chat request
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(testPayload),
    });

    if (response.ok) {
      // For streaming response, read chunks
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const _chunk = decoder.decode(value);
      }
    } else {
      const _errorText = await response.text();
    }
  } catch (_error) {}
};

testChatAPI();
