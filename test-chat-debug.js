// Debug script to test the chat API directly
const fetch = require('node-fetch');

async function testChatAPI() {
  console.log('🔍 Testing Chat API with detailed debugging...\n');
  
  const chatId = 'test-' + Date.now();
  const userId = 'guest-' + Date.now();
  
  const requestBody = {
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, how are you?' }]
      }
    ],
    chatId: chatId,
    userId: userId,
    model: 'gpt-5-mini',
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
    verbosity: 'medium'
  };
  
  console.log('📤 Request Details:');
  console.log('URL: http://localhost:3000/api/chat');
  console.log('Method: POST');
  console.log('Headers: Content-Type: application/json');
  console.log('\n📋 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));
  console.log('\n-----------------------------------\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📥 Response Status:', response.status, response.statusText);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    // Try to get response body
    const responseText = await response.text();
    console.log('\n📄 Response Body:');
    
    if (response.headers.get('content-type')?.includes('application/json')) {
      try {
        const responseJson = JSON.parse(responseText);
        console.log(JSON.stringify(responseJson, null, 2));
      } catch {
        console.log('Raw text:', responseText);
      }
    } else if (response.headers.get('content-type')?.includes('text/event-stream')) {
      console.log('✅ Streaming response received!');
      console.log('First part of stream:', responseText.substring(0, 500));
    } else {
      console.log('Raw response:', responseText);
    }
    
    if (response.ok) {
      console.log('\n✅ API call successful!');
    } else {
      console.log('\n❌ API call failed with status:', response.status);
      
      // Provide specific debugging hints
      if (response.status === 400) {
        console.log('\n🔍 Debugging hints for 400 error:');
        console.log('1. Check if all required fields are present in the request');
        console.log('2. Verify the message format matches AI SDK v5 requirements');
        console.log('3. Check model availability and API key configuration');
        console.log('4. Review validation logic in the API route handler');
      }
    }
    
  } catch (error) {
    console.error('❌ Network or parsing error:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testChatAPI().then(() => {
  console.log('\n✅ Test completed');
}).catch(error => {
  console.error('❌ Test failed:', error);
});