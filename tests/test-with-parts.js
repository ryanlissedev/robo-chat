#!/usr/bin/env node

/**
 * Test API with parts array format
 */

async function testWithParts() {
  console.log('Testing API with parts array...\n');

  const payload = {
    messages: [
      {
        id: 'test-parts-1',
        role: 'user',
        content: 'Hello, please respond',
        parts: [{ type: 'text', text: 'Hello, please respond' }]
      }
    ],
    chatId: 'test-parts',
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Status:', response.status);
    
    if (!response.ok) {
      console.log('Error:', await response.text());
      return;
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let eventCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventCount++;
          const data = line.substring(6);
          
          if (data === '[DONE]') continue;
          
          try {
            const event = JSON.parse(data);
            if (event.type === 'text-delta') {
              fullText += event.delta || '';
            }
          } catch (e) {
            // Skip parse errors
          }
        }
      }
    }

    console.log('\n✅ Success!');
    console.log('  - Events received:', eventCount);
    console.log('  - Response length:', fullText.length, 'chars');
    if (fullText) {
      console.log('  - Sample:', fullText.substring(0, 50) + '...');
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testWithParts();