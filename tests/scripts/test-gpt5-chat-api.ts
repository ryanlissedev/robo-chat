#!/usr/bin/env bun
/**
 * Test script for GPT-5 models via Chat API
 * Tests the full chat API with proper request structure
 */

const API_URL = 'http://localhost:3000/api/chat';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Test models
const testModels = ['gpt-5-mini', 'gpt-5', 'gpt-5-nano'];

async function testChatAPI(model: string) {
  console.log(
    `\n${colors.cyan}Testing ${model} via Chat API...${colors.reset}`
  );

  const chatRequest = {
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Write a short haiku about AI',
        createdAt: new Date().toISOString(),
      },
    ],
    chatId: `test-chat-${Date.now()}`,
    userId: 'test-user',
    model: model,
    isAuthenticated: false,
    systemPrompt: 'You are a helpful assistant.',
    enableSearch: false,
    reasoningEffort: 'medium',
    verbosity: 'low',
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `${colors.red}❌ HTTP ${response.status}: ${errorText}${colors.reset}`
      );
      return false;
    }

    // Check if it's a streaming response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('text/event-stream')) {
      console.log(
        `${colors.green}✓ Streaming response received${colors.reset}`
      );

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let hasReasoning = false;

      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            // Parse SSE data
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);

                  // Check for different part types
                  if (parsed.type === 'text-delta') {
                    fullContent += parsed.textDelta || '';
                  } else if (parsed.type === 'reasoning-delta') {
                    hasReasoning = true;
                    console.log(
                      `${colors.blue}Found reasoning: ${parsed.textDelta?.slice(0, 50)}...${colors.reset}`
                    );
                  } else if (parsed.type === 'finish') {
                    console.log(
                      `${colors.green}Stream finished${colors.reset}`
                    );
                  }
                } catch (_e) {
                  // Not JSON, might be other SSE format
                }
              }
            }
          }
        }
      }

      console.log(
        `${colors.green}✓ Response content: ${fullContent.slice(0, 100)}...${colors.reset}`
      );
      if (hasReasoning) {
        console.log(
          `${colors.green}✓ Reasoning tokens detected${colors.reset}`
        );
      }

      return true;
    } else {
      // Non-streaming response
      const data = await response.json();
      console.log(`${colors.green}✓ JSON response received${colors.reset}`);
      console.log(`Response:`, JSON.stringify(data, null, 2).slice(0, 500));
      return true;
    }
  } catch (error: any) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    if (error.cause) {
      console.error(`Cause:`, error.cause);
    }
    return false;
  }
}

async function main() {
  console.log(`${colors.cyan}=== GPT-5 Chat API Test Suite ===${colors.reset}`);
  console.log(`Testing endpoint: ${API_URL}`);
  console.log(`Testing models: ${testModels.join(', ')}`);

  // Check if server is running
  try {
    const healthCheck = await fetch('http://localhost:3000/api/health');
    if (!healthCheck.ok) {
      console.error(
        `${colors.red}Server is not responding. Make sure it's running on port 3000.${colors.reset}`
      );
      process.exit(1);
    }
    console.log(`${colors.green}✓ Server is running${colors.reset}`);
  } catch (_error) {
    console.error(
      `${colors.red}Cannot connect to server. Run 'bun run dev' first.${colors.reset}`
    );
    process.exit(1);
  }

  const results: Record<string, boolean> = {};

  for (const model of testModels) {
    console.log(`\n${colors.yellow}${'='.repeat(50)}${colors.reset}`);
    const success = await testChatAPI(model);
    results[model] = success;

    // Add a small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);

  for (const [model, success] of Object.entries(results)) {
    const status = success
      ? `${colors.green}✓ PASS${colors.reset}`
      : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`${model}: ${status}`);
  }

  const allPass = Object.values(results).every((r) => r);

  if (allPass) {
    console.log(
      `\n${colors.green}✅ All GPT-5 models are working via Chat API!${colors.reset}`
    );
  } else {
    console.log(
      `\n${colors.red}⚠️  Some tests failed. Check the logs above.${colors.reset}`
    );
  }
}

// Run the tests
main().catch(console.error);
