#!/usr/bin/env node

/**
 * Chat Gateway Integration Test
 *
 * This test verifies that the chat API is using the AI Gateway
 * by making actual requests to the running development server.
 *
 * Usage:
 *   npm run dev (in another terminal)
 *   npx tsx tests/isolated/chat-gateway-test.ts
 */

import { existsSync, readFileSync } from 'node:fs';

// Load environment variables
function loadEnv() {
  const envFiles = ['.env.local', '.env.test.local', '.env'];

  for (const file of envFiles) {
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
      break;
    }
  }
}

loadEnv();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class ChatGatewayTester {
  private baseUrl = 'http://localhost:3000';

  async testChatAPI() {
    log('\n🧪 Testing Chat API with Gateway', 'bold');

    const chatRequest = {
      messages: [
        {
          id: 'test-1',
          role: 'user',
          content: 'Say "Chat gateway works!" in exactly 3 words.',
        },
      ],
      chatId: `test-chat-${Date.now()}`,
      userId: 'test-user',
      model: 'gpt-4o-mini',
      isAuthenticated: false,
      systemPrompt: 'You are a helpful assistant.',
      enableSearch: false,
      reasoningEffort: 'medium',
      verbosity: 'medium',
    };

    try {
      log('🔄 Making chat request...', 'cyan');

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      log(`✅ Chat API responded with status: ${response.status}`, 'green');

      // Read the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      let fullResponse = '';
      let chunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        fullResponse += chunk;
        chunks++;

        // Log first few chunks to see the format
        if (chunks <= 3) {
          log(`   Chunk ${chunks}: ${chunk.substring(0, 100)}...`, 'blue');
        }
      }

      log(
        `📊 Received ${chunks} chunks, total length: ${fullResponse.length}`,
        'blue'
      );

      // Try to extract the actual response content
      const lines = fullResponse.split('\n').filter((line) => line.trim());
      let assistantResponse = '';

      for (const line of lines) {
        if (line.startsWith('0:')) {
          try {
            const data = JSON.parse(line.substring(2));
            if (data.content) {
              assistantResponse += data.content;
            }
          } catch (_e) {
            // Ignore parsing errors for non-JSON lines
          }
        }
      }

      if (assistantResponse) {
        log(`✅ Chat Response: "${assistantResponse.trim()}"`, 'green');
        return { success: true, response: assistantResponse.trim() };
      } else {
        log('⚠️  Could not extract response content from stream', 'yellow');
        return {
          success: true,
          response: 'Stream received but content not parsed',
        };
      }
    } catch (error) {
      log(`❌ Chat API failed: ${error.message}`, 'red');
      return { success: false, error: error.message };
    }
  }

  async testChatStatus() {
    log('\n🧪 Testing Chat API Status', 'bold');

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      log('📊 Chat API Status:', 'cyan');
      log(
        `   Gateway Enabled: ${data.gateway?.enabled}`,
        data.gateway?.enabled ? 'green' : 'red'
      );
      log(`   Gateway URL: ${data.gateway?.baseURL || 'Not set'}`, 'blue');
      log(`   Environment Status:`, 'blue');

      Object.entries(data.envAvailable || {}).forEach(
        ([provider, available]) => {
          log(`     ${provider}: ${available}`, available ? 'green' : 'red');
        }
      );

      return data;
    } catch (error) {
      log(`❌ Status check failed: ${error.message}`, 'red');
      return null;
    }
  }

  async testServerConnection() {
    log('\n🧪 Testing Server Connection', 'bold');

    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
      });

      if (response.ok) {
        log('✅ Server is running and accessible', 'green');
        return true;
      } else {
        // Try the root endpoint
        const rootResponse = await fetch(this.baseUrl);
        if (rootResponse.ok) {
          log('✅ Server is running (root endpoint accessible)', 'green');
          return true;
        }
      }

      throw new Error(`Server not accessible: ${response.status}`);
    } catch (error) {
      log(`❌ Server connection failed: ${error.message}`, 'red');
      log(
        '💡 Make sure the development server is running: npm run dev',
        'yellow'
      );
      return false;
    }
  }

  async runAllTests() {
    log('🚀 Chat Gateway Integration Testing', 'bold');
    log('='.repeat(50), 'cyan');

    // Test server connection first
    const serverRunning = await this.testServerConnection();
    if (!serverRunning) {
      log('\n❌ Cannot proceed without server connection', 'red');
      return;
    }

    // Test chat status
    const status = await this.testChatStatus();

    // Test actual chat functionality
    const chatResult = await this.testChatAPI();

    // Summary
    log('\n📋 Test Summary', 'bold');
    log('='.repeat(30), 'cyan');

    if (status?.gateway?.enabled) {
      log('✅ Gateway is enabled in chat API', 'green');
    } else {
      log('❌ Gateway is not enabled in chat API', 'red');
    }

    if (chatResult.success) {
      log('✅ Chat API is working', 'green');
      if (chatResult.response) {
        log(`📝 Response: "${chatResult.response}"`, 'blue');
      }
    } else {
      log('❌ Chat API is not working', 'red');
    }

    // Check if gateway is actually being used
    if (status?.gateway?.enabled && chatResult.success) {
      log('\n🎉 SUCCESS: Chat is configured to use the AI Gateway!', 'green');
      log(
        '✅ The chat API should be routing through the Vercel AI Gateway',
        'green'
      );
    } else if (chatResult.success) {
      log('\n⚠️  Chat is working but gateway may not be enabled', 'yellow');
      log('💡 Check your AI_GATEWAY_API_KEY configuration', 'blue');
    } else {
      log('\n❌ Chat is not working properly', 'red');
    }

    return { status, chatResult };
  }
}

async function main() {
  const tester = new ChatGatewayTester();
  await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { ChatGatewayTester };
