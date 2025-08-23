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
  const testConfig = {
    url: 'http://localhost:3000/api/chat',
    chatId: `test-${Date.now()}`,
    userId: `guest-${Date.now()}`,
    model: 'gpt-5-mini',
    isAuthenticated: false,
    enableSearch: false,
    reasoningEffort: 'medium',
    verbosity: 'medium',
  };
  const basicMessage = {
    messages: [
      {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, test message' }],
      },
    ],
    chatId: testConfig.chatId,
    userId: testConfig.userId,
    model: testConfig.model,
    isAuthenticated: testConfig.isAuthenticated,
    enableSearch: testConfig.enableSearch,
    reasoningEffort: testConfig.reasoningEffort,
    verbosity: testConfig.verbosity,
  };

  try {
    const response = await fetch(testConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(basicMessage),
    });

    if (response.ok) {
      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let _fullResponse = '';
      let _assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        _fullResponse += chunk;

        // Parse SSE data
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content' && data.data) {
                _assistantContent += data.data;
                process.stdout.write(
                  `${COLORS.cyan}${data.data}${COLORS.reset}`
                );
              } else if (data.type === 'finish') {
              }
            } catch (_e) {
              // Skip non-JSON lines
            }
          }
        }
      }
    } else {
      const errorText = await response.text();

      // Try to parse as JSON if possible
      try {
        const _errorJson = JSON.parse(errorText);
      } catch (_e) {
        // Not JSON, already displayed as text
      }
    }
  } catch (_error) {}
  const conversation = [
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What is the RoboRail system?' }],
    },
    {
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'The RoboRail is an automated railway system...',
        },
      ],
    },
    {
      role: 'user',
      parts: [{ type: 'text', text: 'What safety equipment do I need?' }],
    },
  ];

  const multiTurnMessage = {
    messages: conversation,
    chatId: `${testConfig.chatId}-multi`,
    userId: testConfig.userId,
    model: testConfig.model,
    isAuthenticated: testConfig.isAuthenticated,
    enableSearch: testConfig.enableSearch,
    reasoningEffort: testConfig.reasoningEffort,
    verbosity: testConfig.verbosity,
  };

  try {
    const response = await fetch(testConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(multiTurnMessage),
    });

    if (response.ok) {
    } else {
      const _errorText = await response.text();
    }
  } catch (_error) {}
  const invalidMessages = [
    { name: 'Missing chatId', payload: { messages: [], userId: 'test' } },
    { name: 'Missing userId', payload: { messages: [], chatId: 'test' } },
    { name: 'Missing messages', payload: { chatId: 'test', userId: 'test' } },
  ];

  for (const test of invalidMessages) {
    try {
      const response = await fetch(testConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload),
      });

      if (response.status === 400) {
      } else {
      }
    } catch (_error) {}
  }
}

// Run the test
testChatAPI().catch((_error) => {
  process.exit(1);
});
