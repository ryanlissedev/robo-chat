// Comprehensive test of chat API with detailed error diagnosis
const fetch = require('node-fetch');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function testChatAPI() {
  console.log(`${COLORS.bright}${COLORS.cyan}🧪 COMPREHENSIVE CHAT API TEST${COLORS.reset}\n`);
  console.log('='.repeat(60) + '\n');

  const testConfig = {
    url: 'http://localhost:3000/api/chat',
    chatId: 'test-' + Date.now(),
    userId: 'guest-' + Date.now(),
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false,
    reasoningEffort: 'medium',
    verbosity: 'medium'
  };

  console.log(`${COLORS.bright}📋 Test Configuration:${COLORS.reset}`);
  console.log(JSON.stringify(testConfig, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  // Test 1: Basic message structure
  console.log(`${COLORS.bright}Test 1: Basic Message Structure${COLORS.reset}`);
  const basicMessage = {
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, test message' }]
      }
    ],
    chatId: testConfig.chatId,
    userId: testConfig.userId,
    model: testConfig.model,
    isAuthenticated: testConfig.isAuthenticated,
    enableSearch: testConfig.enableSearch,
    reasoningEffort: testConfig.reasoningEffort,
    verbosity: testConfig.verbosity
  };

  console.log('Request payload:');
  console.log(JSON.stringify(basicMessage, null, 2));

  try {
    const response = await fetch(testConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basicMessage)
    });

    console.log(`\n${COLORS.bright}Response Status:${COLORS.reset} ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${COLORS.red}❌ Error Response:${COLORS.reset}`);
      console.log(errorText);
      
      // Try to parse as JSON if possible
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`\n${COLORS.yellow}Parsed Error:${COLORS.reset}`);
        console.log(JSON.stringify(errorJson, null, 2));
      } catch (e) {
        // Not JSON, already displayed as text
      }
    } else {
      console.log(`${COLORS.green}✅ Request successful!${COLORS.reset}`);
      
      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let assistantContent = '';
      
      console.log(`\n${COLORS.bright}Streaming Response:${COLORS.reset}`);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        
        // Parse SSE data
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content' && data.data) {
                assistantContent += data.data;
                process.stdout.write(`${COLORS.cyan}${data.data}${COLORS.reset}`);
              } else if (data.type === 'finish') {
                console.log(`\n${COLORS.green}Stream finished${COLORS.reset}`);
              }
            } catch (e) {
              // Skip non-JSON lines
            }
          }
        }
      }
      
      console.log(`\n\n${COLORS.bright}Summary:${COLORS.reset}`);
      console.log(`Assistant response length: ${assistantContent.length} characters`);
      console.log(`Full response length: ${fullResponse.length} bytes`);
    }
  } catch (error) {
    console.log(`${COLORS.red}❌ Network Error:${COLORS.reset} ${error.message}`);
    console.log('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Multi-turn conversation
  console.log(`${COLORS.bright}Test 2: Multi-turn Conversation${COLORS.reset}`);
  const conversation = [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What is the RoboRail system?' }]
    },
    {
      role: 'assistant',
      parts: [{ type: 'text', text: 'The RoboRail is an automated railway system...' }]
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What safety equipment do I need?' }]
    }
  ];

  const multiTurnMessage = {
    messages: conversation,
    chatId: testConfig.chatId + '-multi',
    userId: testConfig.userId,
    model: testConfig.model,
    isAuthenticated: testConfig.isAuthenticated,
    enableSearch: testConfig.enableSearch,
    reasoningEffort: testConfig.reasoningEffort,
    verbosity: testConfig.verbosity
  };

  try {
    const response = await fetch(testConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(multiTurnMessage)
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`${COLORS.red}❌ Multi-turn test failed${COLORS.reset}`);
      console.log(errorText);
    } else {
      console.log(`${COLORS.green}✅ Multi-turn conversation successful${COLORS.reset}`);
    }
  } catch (error) {
    console.log(`${COLORS.red}❌ Network Error:${COLORS.reset} ${error.message}`);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Missing required fields
  console.log(`${COLORS.bright}Test 3: Missing Required Fields${COLORS.reset}`);
  const invalidMessages = [
    { name: 'Missing chatId', payload: { messages: [], userId: 'test' } },
    { name: 'Missing userId', payload: { messages: [], chatId: 'test' } },
    { name: 'Missing messages', payload: { chatId: 'test', userId: 'test' } },
  ];

  for (const test of invalidMessages) {
    console.log(`\nTesting: ${test.name}`);
    try {
      const response = await fetch(testConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });
      
      if (response.status === 400) {
        console.log(`${COLORS.green}✅ Correctly returned 400 Bad Request${COLORS.reset}`);
      } else {
        console.log(`${COLORS.yellow}⚠️ Unexpected status: ${response.status}${COLORS.reset}`);
      }
    } catch (error) {
      console.log(`${COLORS.red}❌ Error: ${error.message}${COLORS.reset}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${COLORS.bright}${COLORS.green}🎉 TEST SUITE COMPLETE${COLORS.reset}`);
}

// Run the test
testChatAPI().catch(error => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
  process.exit(1);
});