#!/usr/bin/env node

/**
 * Simple API test with minimal payload
 */

async function testSimpleAPI() {
  console.log('Testing simplified API call...\n');

  const payload = {
    messages: [
      {
        id: 'test-1',
        role: 'user',
        content: 'Hi'
      }
    ],
    chatId: 'test-simple',
    userId: 'test-user',
    model: 'gpt-5-mini'
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Status:', response.status);
    console.log('Headers:', response.headers.get('content-type'));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
    } else {
      console.log('✅ API is responding');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testSimpleAPI();