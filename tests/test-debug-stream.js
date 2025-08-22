#!/usr/bin/env node

/**
 * Debug the actual stream format
 */

async function debugStream() {
  console.log('🔍 Debugging Stream Format\n');

  const testMessage = {
    messages: [
      {
        id: 'debug-1',
        role: 'user',
        content: 'Say hello',
        parts: [{ type: 'text', text: 'Say hello' }]
      }
    ],
    chatId: 'debug-' + Date.now(),
    userId: 'test',
    model: 'gpt-5-mini',
    isAuthenticated: false
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkNumber = 0;

    console.log('Raw chunks:\n');
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      chunkNumber++;
      
      console.log(`\n--- Chunk ${chunkNumber} (${chunk.length} bytes) ---`);
      
      // Show first 300 chars of each chunk
      const preview = chunk.substring(0, 300);
      console.log(preview);
      
      if (chunk.length > 300) {
        console.log('... [truncated]');
      }
      
      // Analyze chunk format
      if (chunk.includes('"type":"text"')) {
        console.log('  ✓ Contains text type');
      }
      if (chunk.includes('"role":"assistant"')) {
        console.log('  ✓ Contains assistant role');
      }
      if (chunk.includes('"parts":[')) {
        console.log('  ✓ Contains parts array');
      }
      if (chunk.match(/^\d+:/m)) {
        console.log('  ✓ AI SDK streaming format detected');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugStream();