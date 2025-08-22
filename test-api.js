const fetch = require('node-fetch');

async function testChatAPI() {
  console.log('Testing Chat API...\n');
  
  const response = await fetch('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          id: 'test-msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'What are the safety features of RoboRail?' }]
        }
      ],
      chatId: 'test-chat-' + Date.now(),
      userId: 'guest-' + Date.now(),
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant for RoboRail.',
      enableSearch: true,
      reasoningEffort: 'medium'
    })
  });

  if (!response.ok) {
    console.error('Error:', response.status, response.statusText);
    const text = await response.text();
    console.error('Response body:', text);
    return;
  }

  const reader = response.body;
  const decoder = new TextDecoder();
  let buffer = '';
  let messageCount = 0;

  for await (const chunk of reader) {
    const text = decoder.decode(chunk, { stream: true });
    buffer += text;
    
    // Parse SSE events
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          console.log('\n✅ Stream completed');
          continue;
        }
        
        try {
          const parsed = JSON.parse(data);
          messageCount++;
          
          // Log the full structure for debugging
          console.log(`Chunk ${messageCount} (${parsed.type}):`, JSON.stringify(parsed, null, 2).substring(0, 200));
        } catch (e) {
          if (data) {
            console.log('⚠️ Could not parse:', data);
          }
        }
      }
    }
  }
  
  console.log(`\n📊 Total chunks received: ${messageCount}`);
}

testChatAPI().catch(console.error);