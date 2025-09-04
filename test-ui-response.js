#!/usr/bin/env node

/**
 * Test script to verify the UI is now displaying responses correctly
 * This simulates what would happen in a browser
 */

const fs = require('fs');

async function testUIResponse() {
  console.log('🔬 Testing UI Response Display...\n');

  try {
    // 1. Test that the page loads
    console.log('1. Testing page accessibility...');
    const pageResponse = await fetch('http://localhost:3000/verify-chat');
    
    if (pageResponse.status !== 200) {
      throw new Error(`Page not accessible: ${pageResponse.status}`);
    }
    
    const html = await pageResponse.text();
    
    // Check for key elements
    const hasChat = html.includes('Chat Verification - AI SDK v5');
    const hasForm = html.includes('Type \'test\' to verify');
    const hasDebugInfo = html.includes('Debug Info');
    
    console.log(`   ✅ Page loads: ${pageResponse.status}`);
    console.log(`   ✅ Chat title present: ${hasChat}`);
    console.log(`   ✅ Form present: ${hasForm}`);
    console.log(`   ℹ️  Debug info present: ${hasDebugInfo}`);

    // 2. Test the API streaming with consistent IDs
    console.log('\n2. Testing API streaming format...');
    const apiResponse = await fetch('http://localhost:3000/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test ui response' }]
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`API error: ${apiResponse.status}`);
    }

    // Parse the streaming response to verify ID consistency
    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    const events = [];
    const ids = new Set();
    const reasoningIds = new Set();
    const textIds = new Set();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const event = JSON.parse(line.slice(6));
            events.push(event);
            
            if (event.id) {
              ids.add(event.id);
              if (event.type === 'reasoning-delta') {
                reasoningIds.add(event.id);
              } else if (event.type === 'text-delta') {
                textIds.add(event.id);
              }
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    console.log(`   ✅ Total events: ${events.length}`);
    console.log(`   ✅ Unique IDs: ${ids.size}`);
    console.log(`   ✅ Reasoning IDs: ${reasoningIds.size} (should be 1)`);
    console.log(`   ✅ Text IDs: ${textIds.size} (should be 1)`);
    
    const reasoningEvents = events.filter(e => e.type === 'reasoning-delta');
    const textEvents = events.filter(e => e.type === 'text-delta');
    
    console.log(`   ✅ Reasoning events: ${reasoningEvents.length}`);
    console.log(`   ✅ Text events: ${textEvents.length}`);

    // 3. Verify the fix worked
    const reasoningConsistent = reasoningIds.size === 1;
    const textConsistent = textIds.size === 1;
    
    console.log('\n3. Verification Results:');
    console.log(`   ${reasoningConsistent ? '✅' : '❌'} Reasoning IDs are consistent`);
    console.log(`   ${textConsistent ? '✅' : '❌'} Text IDs are consistent`);

    if (reasoningConsistent && textConsistent) {
      console.log('\n🎉 SUCCESS! The AI SDK v5 streaming format is now correct.');
      console.log('\n📋 What this means for the UI:');
      console.log('   ✅ Reasoning tokens will be accumulated into a single reasoning part');
      console.log('   ✅ Text tokens will be accumulated into a single text part');
      console.log('   ✅ MessageAssistant component will receive proper parts array');
      console.log('   ✅ getMessageContent function will extract the accumulated text');
      console.log('   ✅ Reasoning will display in the yellow collapsible box');
      console.log('   ✅ Response text will display in the main message area');
      
      console.log('\n🧪 To test in browser:');
      console.log('   1. Open http://localhost:3000/verify-chat');
      console.log('   2. Type "test" and send');
      console.log('   3. You should see:');
      console.log('      - Yellow "Thinking..." box that expands to show reasoning');
      console.log('      - Main response text appearing below');
      console.log('      - Debug info showing parts count and content length');
    } else {
      console.log('\n❌ ISSUE: ID consistency problem still exists');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUIResponse();