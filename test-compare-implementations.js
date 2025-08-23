// Test to compare base-chat and robo-chat implementations
// Run this to see the difference in streaming responses

const testMessage = 'What is 2+2?';

async function testBaseChat() {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testMessage }],
        model: 'gpt-5-mini',
        chatId: `test-base-${Date.now()}`,
        userId: 'test-user',
        isAuthenticated: false,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let _chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          _chunkCount++;
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          try {
            const _parsed = JSON.parse(data);
          } catch {}
        }
      }
    }
  } catch (_error) {}
}

async function testRoboChat() {
  try {
    const response = await fetch('http://localhost:3005/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testMessage }],
        model: 'gpt-5-mini',
        chatId: `test-robo-${Date.now()}`,
        userId: 'test-user',
        isAuthenticated: false,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let _chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          _chunkCount++;
          const data = line.slice(6);
          if (data === '[DONE]') {
            continue;
          }
          try {
            const _parsed = JSON.parse(data);
          } catch {}
        }
      }
    }
  } catch (_error) {}
}

async function main() {
  await testBaseChat();
  await testRoboChat();
}

main().catch(console.error);
