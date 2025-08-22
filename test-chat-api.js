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
          parts: [{ type: 'text', text: 'Hello, tell me about RoboRail' }]
        }
      ],
      chatId: 'test-chat-' + Date.now(),
      userId: 'guest-' + Date.now(),
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant.',
      enableSearch: true,
      reasoningEffort: 'medium'
    };
    
    console.log('Sending payload:', JSON.stringify(testPayload, null, 2));
    
    // Make the chat request
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } else {
      // For streaming response, read chunks
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        console.log('Chunk:', chunk);
      }
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
};

testChatAPI();