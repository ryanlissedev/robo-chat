#!/usr/bin/env node

/**
 * Test GPT-5 Models with Gateway
 *
 * This test checks if GPT-5 models are available through the Vercel AI Gateway
 */

import { existsSync, readFileSync } from 'node:fs';
import OpenAI from 'openai';

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

async function testGPT5Models() {
  log('🧪 Testing GPT-5 Models with Vercel AI Gateway', 'bold');

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseURL = process.env.AI_GATEWAY_BASE_URL;

  if (!apiKey || !baseURL) {
    log('❌ Gateway not configured', 'red');
    return;
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
    dangerouslyAllowBrowser: true,
  });

  const gpt5Models = [
    'openai/gpt-5-mini',
    'openai/gpt-5',
    'openai/gpt-5-nano',
    'openai/gpt-5-pro',
    'gpt-5-mini',
    'gpt-5',
    'gpt-5-nano',
  ];

  for (const model of gpt5Models) {
    log(`\n🔄 Testing model: ${model}`, 'cyan');

    try {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Say "GPT-5 works" in exactly 3 words.',
          },
        ],
        max_completion_tokens: 20, // GPT-5 uses max_completion_tokens instead of max_tokens
        temperature: 1, // GPT-5 only supports temperature = 1
      });

      const response = completion.choices[0]?.message?.content;

      log(`   ✅ ${model}: "${response}"`, 'green');
      log(`   📊 Usage: ${JSON.stringify(completion.usage)}`, 'blue');
    } catch (error) {
      log(`   ❌ ${model}: ${error.message}`, 'red');

      // Check for specific error types
      if (error.message.includes('404')) {
        log(`   💡 Model not found in gateway`, 'yellow');
      } else if (error.message.includes('401')) {
        log(`   💡 Authentication issue`, 'yellow');
      } else if (error.message.includes('OIDC')) {
        log(
          `   💡 OIDC token issue - gateway might need different auth`,
          'yellow'
        );
      }
    }
  }
}

async function main() {
  await testGPT5Models();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { testGPT5Models };
