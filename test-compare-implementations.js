// Test to compare base-chat and robo-chat implementations
// Run this to see the difference in streaming responses

const testMessage = "What is 2+2?";

async function testBaseChat() {
  console.log('\n🔵 Testing base-chat implementation...');
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testMessage }],
        model: 'gpt-5-mini',
        chatId: 'test-base-' + Date.now(),
        userId: 'test-user',
        isAuthenticated: false
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          chunkCount++;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            console.log(`  Chunk ${chunkCount}:`, parsed.type || 'unknown');
          } catch {}
        }
      }
    }
    console.log(`  ✅ Total chunks: ${chunkCount}`);
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function testRoboChat() {
  console.log('\n🟢 Testing robo-chat implementation...');
  try {
    const response = await fetch('http://localhost:3005/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testMessage }],
        model: 'gpt-5-mini',
        chatId: 'test-robo-' + Date.now(),
        userId: 'test-user',
        isAuthenticated: false
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          chunkCount++;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            console.log(`  Chunk ${chunkCount}:`, parsed.type || 'unknown');
          } catch {}
        }
      }
    }
    console.log(`  ✅ Total chunks: ${chunkCount}`);
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function main() {
  console.log('========================================');
  console.log('Comparing base-chat vs robo-chat');
  console.log('========================================');
  console.log('Make sure both servers are running:');
  console.log('- base-chat on port 3000');
  console.log('- robo-chat on port 3005');
  console.log('========================================');
  
  await testBaseChat();
  await testRoboChat();
  
  console.log('\n========================================');
  console.log('Test complete!');
  console.log('========================================');
}

main().catch(console.error);