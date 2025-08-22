#!/usr/bin/env node

/**
 * End-to-end test for chat functionality
 */

const https = require('https');
const http = require('http');

async function testChatFlow() {
  console.log('🧪 Testing Complete Chat Flow\n');
  console.log('═══════════════════════════════════════\n');

  // Test 1: Send message and verify response
  console.log('📝 Test 1: Sending user message...');
  
  const testMessage = {
    messages: [
      {
        id: 'test-msg-1',
        role: 'user',
        content: 'Hello! Can you count to 3?',
        parts: [{ type: 'text', text: 'Hello! Can you count to 3?' }]
      }
    ],
    chatId: 'test-chat-' + Date.now(),
    userId: 'test-user',
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false
  };

  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage)
    });

    console.log('  Status:', response.status);
    console.log('  Headers:', response.headers.get('content-type'));

    if (!response.ok) {
      const error = await response.text();
      console.error('  ❌ Error:', error);
      return;
    }

    // Read and parse the streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let aiResponseText = '';
    let chunks = [];
    let messageData = null;

    console.log('\n📦 Reading stream chunks...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      chunks.push(chunk);
      
      // Parse AI SDK v5 UI Message format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('0:')) {
          // This is the UI message format
          try {
            const jsonStr = line.substring(2);
            const data = JSON.parse(jsonStr);
            
            if (data.id && data.role === 'assistant') {
              messageData = data;
              console.log('  ✅ Received assistant message with ID:', data.id);
              
              // Extract text from parts array
              if (data.parts && Array.isArray(data.parts)) {
                const textParts = data.parts.filter(p => p.type === 'text');
                aiResponseText = textParts.map(p => p.text || '').join('');
                console.log('  📝 Extracted text from parts:', aiResponseText.substring(0, 50) + '...');
              }
            }
          } catch (e) {
            // Not a complete JSON object yet, continue
          }
        } else if (line.startsWith('8:')) {
          // Text delta chunks
          const match = line.match(/8:"(.*)"/);
          if (match) {
            aiResponseText += match[1];
          }
        }
      }
    }

    console.log('\n📊 Results:');
    console.log('  Total chunks:', chunks.length);
    console.log('  Message received:', messageData ? 'Yes' : 'No');
    console.log('  Text extracted:', aiResponseText.length > 0 ? 'Yes' : 'No');
    
    if (aiResponseText) {
      console.log('\n💬 AI Response:');
      console.log('  "' + aiResponseText.substring(0, 100) + (aiResponseText.length > 100 ? '..."' : '"'));
    }

    // Test 2: Verify message structure
    console.log('\n📝 Test 2: Verifying message structure...');
    
    if (messageData) {
      const hasRequiredFields = 
        messageData.id && 
        messageData.role === 'assistant' &&
        (messageData.parts || messageData.content);
      
      if (hasRequiredFields) {
        console.log('  ✅ Message has all required fields');
        console.log('    - ID:', messageData.id);
        console.log('    - Role:', messageData.role);
        console.log('    - Has parts:', !!messageData.parts);
        console.log('    - Parts count:', messageData.parts?.length || 0);
      } else {
        console.log('  ❌ Message missing required fields');
      }
    } else {
      console.log('  ❌ No message data received');
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    if (aiResponseText && messageData) {
      console.log('✅ CHAT FLOW WORKING CORRECTLY!');
      console.log('   - API responding');
      console.log('   - Messages streaming');
      console.log('   - Text extraction working');
      console.log('   - AI SDK v5 format correct');
    } else {
      console.log('⚠️  PARTIAL SUCCESS');
      if (!aiResponseText) {
        console.log('   - Text extraction needs fixing');
      }
      if (!messageData) {
        console.log('   - Message format needs adjustment');
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testChatFlow().catch(console.error);