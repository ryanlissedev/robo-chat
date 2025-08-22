// End-to-end test of the chat functionality
const fetch = require('node-fetch');

async function testFullChatFlow() {
  console.log('🚀 End-to-End Chat Test\n');
  console.log('========================\n');
  
  const chatId = 'e2e-test-' + Date.now();
  const userId = 'guest-' + Date.now();
  
  // Test messages to send
  const testMessages = [
    "Hello, I'm testing the RoboRail Assistant!",
    "Can you tell me about safety protocols?",
    "What maintenance should I perform daily?"
  ];
  
  let conversationHistory = [];
  
  for (let i = 0; i < testMessages.length; i++) {
    const userMessage = testMessages[i];
    console.log(`\n📝 Test ${i + 1}/${testMessages.length}:`);
    console.log(`User: "${userMessage}"`);
    
    // Add user message to history
    conversationHistory.push({
      role: 'user',
      parts: [{ type: 'text', text: userMessage }]
    });
    
    const requestBody = {
      messages: conversationHistory,
      chatId: chatId,
      userId: userId,
      model: 'gpt-5-mini',
      isAuthenticated: false,
      systemPrompt: undefined, // Use default RoboRail system prompt
      enableSearch: false,
      reasoningEffort: 'medium',
      verbosity: 'medium'
    };
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        console.log('✅ API Response: Success (Status:', response.status + ')');
        
        // Read streaming response
        const responseText = await response.text();
        
        // Parse the streaming response to extract assistant message
        const lines = responseText.split('\n');
        let assistantResponse = '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') continue;
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
                assistantResponse += (d.textDelta || d.text);
                continue;
              }
            }
            // direct text-delta
            if (evt?.type === 'text-delta' && (evt.textDelta || evt.text)) {
              assistantResponse += (evt.textDelta || evt.text);
              continue;
            }
            // message.delta with content parts
            if (evt?.type === 'message.delta' && evt?.delta?.content) {
              const parts = Array.isArray(evt.delta.content) ? evt.delta.content : [];
              for (const p of parts) {
                if (p?.type === 'text' && typeof p?.text === 'string') {
                  assistantResponse += p.text;
                }
              }
              continue;
            }
            // content with object form
            if (evt?.type === 'content' && evt?.content?.type === 'text' && typeof evt.content.text === 'string') {
              assistantResponse += evt.content.text;
              continue;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
        
        if (assistantResponse) {
          console.log(`Assistant: "${assistantResponse.substring(0, 100)}${assistantResponse.length > 100 ? '...' : ''}"`);
          
          // Add assistant response to history for context
          conversationHistory.push({
            role: 'assistant',
            parts: [{ type: 'text', text: assistantResponse }]
          });
        } else {
          console.log('Assistant: [Streaming response received but content parsing incomplete]');
        }
        
      } else {
        console.log('❌ API Response: Error (Status:', response.status + ')');
        const errorText = await response.text();
        console.log('Error details:', errorText);
        break;
      }
      
    } catch (error) {
      console.error('❌ Network error:', error.message);
      break;
    }
    
    // Small delay between messages
    if (i < testMessages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n========================');
  console.log('✅ End-to-End Test Complete');
  console.log(`📊 Results: ${conversationHistory.filter(m => m.role === 'assistant').length}/${testMessages.length} responses received`);
  
  // Final validation
  const successRate = (conversationHistory.filter(m => m.role === 'assistant').length / testMessages.length) * 100;
  
  if (successRate === 100) {
    console.log('🎉 100% SUCCESS - Chat is fully functional!');
  } else if (successRate >= 50) {
    console.log(`⚠️  ${successRate}% SUCCESS - Chat is partially functional`);
  } else {
    console.log(`❌ ${successRate}% SUCCESS - Chat needs fixes`);
  }
}

// Run the test
testFullChatFlow().catch(error => {
  console.error('❌ Test failed:', error);
});
