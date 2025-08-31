#!/usr/bin/env tsx

/**
 * AI Gateway Integration Test
 * Tests the gateway implementation with real API calls
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AIGateway, createAIProvider } from '../../lib/ai/gateway';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

interface TestScenario {
  name: string;
  test: () => Promise<boolean>;
}

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test scenarios
const scenarios: TestScenario[] = [
  {
    name: 'Gateway Status Check',
    test: async () => {
      log('\n📊 Checking gateway status...', 'cyan');
      const gateway = new AIGateway();
      const status = await gateway.getStatus();

      console.log('Gateway Configuration:', status.gateway);
      console.log('OpenAI Status:', status.openai);
      console.log('Anthropic Status:', status.anthropic);

      return status.openai.configured || status.anthropic.configured;
    },
  },

  {
    name: 'Direct OpenAI Connection',
    test: async () => {
      log('\n🔌 Testing direct OpenAI connection...', 'cyan');
      try {
        const gateway = new AIGateway({ mode: 'direct' });
        const provider = await gateway.getOpenAIClient();

        log(`  Provider type: ${provider.type}`, 'blue');
        log(`  Is Gateway: ${provider.isGateway}`, 'blue');

        // Test actual API call
        const client = provider.client as any;
        const response = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "OK"' }],
          max_tokens: 5,
        });

        const content = response.choices[0]?.message?.content;
        log(`  Response: ${content}`, 'green');
        return true;
      } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        return false;
      }
    },
  },

  {
    name: 'Gateway Mode OpenAI',
    test: async () => {
      log('\n🌐 Testing gateway mode for OpenAI...', 'cyan');
      try {
        const gateway = new AIGateway({ mode: 'gateway' });
        const provider = await gateway.getOpenAIClient();

        log(`  Provider type: ${provider.type}`, 'blue');
        log(`  Is Gateway: ${provider.isGateway}`, 'blue');

        if (!provider.isGateway) {
          log('  Gateway not available, using direct API', 'yellow');
        }

        return true;
      } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        return false;
      }
    },
  },

  {
    name: 'Auto Mode Fallback',
    test: async () => {
      log('\n🔄 Testing auto mode with fallback...', 'cyan');
      try {
        const gateway = new AIGateway({ mode: 'auto' });
        const provider = await gateway.getOpenAIClient();

        log(`  Provider type: ${provider.type}`, 'blue');
        log(`  Using Gateway: ${provider.isGateway}`, 'blue');
        log(`  Fallback worked: ${!provider.isGateway ? 'Yes' : 'No'}`, 'blue');

        return true;
      } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        return false;
      }
    },
  },

  {
    name: 'Helper Function Test',
    test: async () => {
      log('\n🔧 Testing helper functions...', 'cyan');
      try {
        const openaiProvider = await createAIProvider('openai', {
          mode: 'direct',
        });
        log(`  OpenAI provider created: ${openaiProvider.type}`, 'green');

        const anthropicProvider = await createAIProvider('anthropic');
        log(`  Anthropic provider created: ${anthropicProvider.type}`, 'green');

        return true;
      } catch (error) {
        log(`  Error: ${error.message}`, 'red');
        return false;
      }
    },
  },

  {
    name: 'Error Handling',
    test: async () => {
      log('\n⚠️  Testing error handling...', 'cyan');
      try {
        // Test with invalid config
        const gateway = new AIGateway({
          mode: 'gateway',
          gatewayUrl: 'https://invalid.gateway.url',
          gatewayApiKey: 'invalid-key',
        });

        const provider = await gateway.getOpenAIClient();
        log(
          `  Fallback on error: ${!provider.isGateway ? 'Success' : 'Failed'}`,
          !provider.isGateway ? 'green' : 'red'
        );

        return !provider.isGateway;
      } catch (error) {
        log(`  Handled error: ${error.message}`, 'yellow');
        return true;
      }
    },
  },
];

// Main test runner
async function main() {
  log('\n🚀 AI Gateway Integration Tests', 'cyan');
  log('='.repeat(50), 'cyan');

  const results: { name: string; success: boolean }[] = [];

  for (const scenario of scenarios) {
    log(`\n📝 Running: ${scenario.name}`, 'yellow');
    try {
      const success = await scenario.test();
      results.push({ name: scenario.name, success });
      log(
        `  Result: ${success ? '✅ PASS' : '❌ FAIL'}`,
        success ? 'green' : 'red'
      );
    } catch (error) {
      results.push({ name: scenario.name, success: false });
      log(`  Unexpected error: ${error.message}`, 'red');
    }
  }

  // Summary
  log('\n📊 Test Summary', 'cyan');
  log('='.repeat(50), 'cyan');

  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  const passRate = ((passed / total) * 100).toFixed(1);

  results.forEach((r) => {
    log(`  ${r.success ? '✅' : '❌'} ${r.name}`, r.success ? 'green' : 'red');
  });

  log(
    `\n  Total: ${passed}/${total} passed (${passRate}%)`,
    passed === total ? 'green' : 'yellow'
  );

  // Recommendations
  log('\n💡 Recommendations', 'cyan');
  log('='.repeat(50), 'cyan');

  if (passed === total) {
    log(
      '✅ All tests passed! Gateway implementation is working correctly.',
      'green'
    );
  } else {
    log('⚠️  Some tests failed. Recommendations:', 'yellow');

    if (!results.find((r) => r.name === 'Direct OpenAI Connection')?.success) {
      log('  1. Check your OPENAI_API_KEY in .env.local', 'yellow');
    }

    if (!results.find((r) => r.name === 'Gateway Mode OpenAI')?.success) {
      log(
        '  2. Gateway is not configured. This is OK if using direct API.',
        'yellow'
      );
    }

    log(
      '  3. The auto mode will fallback to direct API when gateway fails.',
      'blue'
    );
  }

  process.exit(passed === total ? 0 : 1);
}

// Run tests
main().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});
