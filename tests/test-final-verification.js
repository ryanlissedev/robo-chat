#!/usr/bin/env node

/**
 * Final verification of chat functionality
 */

async function verifyChat() {
  console.log('🎯 Final Chat Verification\n');
  console.log('═══════════════════════════════════════\n');

  const testMessage = {
    messages: [
      {
        id: 'verify-1',
        role: 'user',
        content: 'Testing: please respond with "Hello, I am working!"',
        parts: [{ type: 'text', text: 'Testing: please respond with "Hello, I am working!"' }]
      }
    ],
    chatId: 'verify-' + Date.now(),
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false
  };

  try {
    console.log('📤 Sending test message...');
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });

    console.log('📥 Response Status:', response.status);
    console.log('📥 Content-Type:', response.headers.get('content-type'));

    if (!response.ok) {
      console.error('❌ Error:', await response.text());
      return;
    }

    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let eventCount = 0;
    let hasTextDelta = false;
    let hasFinish = false;

    console.log('\n🔄 Processing stream...\n');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          eventCount++;
          const data = line.substring(6);
          
          if (data === '[DONE]') {
            hasFinish = true;
            continue;
          }
          
          try {
            const event = JSON.parse(data);
            
            if (event.type === 'text-delta') {
              hasTextDelta = true;
              fullText += event.delta || '';
              process.stdout.write(event.delta || '');
            } else if (event.type === 'text-start') {
              console.log('  ✅ Text streaming started');
            } else if (event.type === 'text-end') {
              console.log('\n  ✅ Text streaming completed');
            }
          } catch (e) {
            // Skip parse errors
          }
        }
      }
    }

    console.log('\n\n═══════════════════════════════════════');
    console.log('📊 Results:');
    console.log('  - Total events:', eventCount);
    console.log('  - Has text deltas:', hasTextDelta);
    console.log('  - Has finish event:', hasFinish);
    console.log('  - Response length:', fullText.length, 'characters');
    
    if (fullText.length > 0) {
      console.log('\n💬 AI Response:');
      console.log('  "' + fullText + '"');
    }

    console.log('\n═══════════════════════════════════════');
    
    if (hasTextDelta && hasFinish && fullText.length > 0) {
      console.log('✅ CHAT API WORKING CORRECTLY!');
      console.log('   - SSE streaming functional');
      console.log('   - Text deltas received');
      console.log('   - Response assembled');
      console.log('\n🎉 The issue is resolved!');
      console.log('   Messages should now display in the UI.');
    } else {
      console.log('⚠️  Issues detected:');
      if (!hasTextDelta) console.log('   - No text deltas received');
      if (!hasFinish) console.log('   - No finish event');
      if (fullText.length === 0) console.log('   - No text content');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

verifyChat();