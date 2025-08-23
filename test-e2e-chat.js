// End-to-end test of the chat functionality
const fetch = require('node-fetch');

async function testFullChatFlow() {
  const chatId = `e2e-test-${Date.now()}`;
  const userId = `guest-${Date.now()}`;

  // Test messages to send
  const testMessages = [
    "Hello, I'm testing the RoboRail Assistant!",
    'Can you tell me about safety protocols?',
    'What maintenance should I perform daily?',
  ];

  const conversationHistory = [];

  for (let i = 0; i < testMessages.length; i++) {
    const userMessage = testMessages[i];

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      parts: [{ type: 'text', text: userMessage }],
    });

    const requestBody = {
      messages: conversationHistory,
      chatId,
      userId,
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: undefined, // Use default RoboRail system prompt
      enableSearch: false,
      reasoningEffort: 'medium',
      verbosity: 'medium',
    };

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Read streaming response
        const responseText = await response.text();

        // Parse the streaming response to extract assistant message
        const lines = responseText.split('\n');
        let assistantResponse = '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }
          const raw = line.slice(6);
          if (raw === '[DONE]') {
            continue;
          }
          try {
            const evt = JSON.parse(raw);
            // Legacy direct content
            if (evt?.type === 'content' && typeof evt?.data === 'string') {
              assistantResponse += evt.data;
              continue;
            }
            // v5 delta form
            if (evt?.type === 'content.delta' && evt?.delta) {
              const d = evt.delta;
              if (d.type === 'text-delta' && (d.textDelta || d.text)) {
                assistantResponse += d.textDelta || d.text;
                continue;
              }
            }
            // direct text-delta
            if (evt?.type === 'text-delta' && (evt.textDelta || evt.text)) {
              assistantResponse += evt.textDelta || evt.text;
              continue;
            }
            // message.delta with content parts
            if (evt?.type === 'message.delta' && evt?.delta?.content) {
              const parts = Array.isArray(evt.delta.content)
                ? evt.delta.content
                : [];
              for (const p of parts) {
                if (p?.type === 'text' && typeof p?.text === 'string') {
                  assistantResponse += p.text;
                }
              }
              continue;
            }
            // content with object form
            if (
              evt?.type === 'content' &&
              evt?.content?.type === 'text' &&
              typeof evt.content.text === 'string'
            ) {
              assistantResponse += evt.content.text;
            }
          } catch {
            // Skip non-JSON lines
          }
        }

        if (assistantResponse) {
          // Add assistant response to history for context
          conversationHistory.push({
            role: 'assistant',
            parts: [{ type: 'text', text: assistantResponse }],
          });
        } else {
        }
      } else {
        const _errorText = await response.text();
        break;
      }
    } catch (_error) {
      break;
    }

    // Small delay between messages
    if (i < testMessages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Final validation
  const successRate =
    (conversationHistory.filter((m) => m.role === 'assistant').length /
      testMessages.length) *
    100;

  if (successRate === 100) {
  } else if (successRate >= 50) {
  } else {
  }
}

// Run the test
testFullChatFlow().catch((_error) => {});
