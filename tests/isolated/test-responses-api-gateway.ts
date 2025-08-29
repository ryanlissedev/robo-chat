#!/usr/bin/env node

/**
 * Test Responses API through Gateway
 * 
 * This test checks if the Vercel AI Gateway supports the OpenAI Responses API
 * which is required for GPT-5 models.
 */

import { readFileSync, existsSync } from 'fs';

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
          let value = valueParts.join('=');
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
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

async function testResponsesAPIEndpoints() {
  log('🧪 Testing Responses API Endpoints through Gateway', 'bold');
  
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseURL = process.env.AI_GATEWAY_BASE_URL;
  
  if (!apiKey || !baseURL) {
    log('❌ Gateway not configured', 'red');
    return;
  }
  
  log(`🔧 Configuration:`, 'cyan');
  log(`   Base URL: ${baseURL}`, 'blue');
  log(`   API Key: ${apiKey.substring(0, 10)}...`, 'blue');
  
  const endpoints = [
    `${baseURL}/responses`,
    `${baseURL}/openai/responses`,
    `${baseURL}/v1/responses`,
    `${baseURL}/openai/v1/responses`,
  ];
  
  const payload = {
    model: 'gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: 'Say "Responses API works" in exactly 3 words.',
      },
    ],
    max_completion_tokens: 20,
    temperature: 1,
  };
  
  for (const endpoint of endpoints) {
    log(`\n🔄 Testing endpoint: ${endpoint}`, 'cyan');
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      
      log(`   Status: ${response.status} ${response.statusText}`, response.ok ? 'green' : 'red');
      
      if (response.ok) {
        const data = await response.json();
        log(`   ✅ SUCCESS! Response: ${JSON.stringify(data).substring(0, 200)}...`, 'green');
        return endpoint;
      } else {
        const text = await response.text();
        log(`   Error: ${text.substring(0, 200)}`, 'red');
        
        if (response.status === 404) {
          log(`   💡 Endpoint not found`, 'yellow');
        } else if (response.status === 405) {
          log(`   💡 Method not allowed`, 'yellow');
        } else if (response.status === 401) {
          log(`   💡 Authentication issue`, 'yellow');
        }
      }
    } catch (error) {
      log(`   Network error: ${error.message}`, 'red');
    }
  }
  
  log('\n❌ No working Responses API endpoints found through gateway', 'red');
  return null;
}

async function testChatCompletionsWithGPT5() {
  log('\n🧪 Testing Chat Completions with GPT-5 (Standard API)', 'bold');
  
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseURL = process.env.AI_GATEWAY_BASE_URL;
  
  if (!apiKey || !baseURL) {
    log('❌ Gateway not configured', 'red');
    return;
  }
  
  const endpoint = `${baseURL}/chat/completions`;
  
  // Test with standard Chat API parameters
  const payload = {
    model: 'openai/gpt-5-mini',
    messages: [
      {
        role: 'user',
        content: 'Say "Chat API works" in exactly 3 words.',
      },
    ],
    max_tokens: 20, // Standard parameter
    temperature: 1,
  };
  
  log(`🔄 Testing Chat Completions: ${endpoint}`, 'cyan');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    
    log(`   Status: ${response.status} ${response.statusText}`, response.ok ? 'green' : 'red');
    
    if (response.ok) {
      const data = await response.json();
      log(`   ✅ Chat API works with GPT-5!`, 'green');
      log(`   Response: ${data.choices?.[0]?.message?.content || 'No content'}`, 'blue');
      return true;
    } else {
      const text = await response.text();
      log(`   Error: ${text.substring(0, 200)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`   Network error: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('🚀 Responses API Gateway Testing Suite', 'bold');
  log('=' .repeat(50), 'cyan');
  
  // Test 1: Try Responses API endpoints
  const responsesEndpoint = await testResponsesAPIEndpoints();
  
  // Test 2: Try standard Chat API with GPT-5
  const chatWorksWithGPT5 = await testChatCompletionsWithGPT5();
  
  // Summary
  log('\n📋 Summary', 'bold');
  log('=' .repeat(30), 'cyan');
  
  if (responsesEndpoint) {
    log(`✅ Responses API works through: ${responsesEndpoint}`, 'green');
  } else {
    log(`❌ Responses API not supported through gateway`, 'red');
  }
  
  if (chatWorksWithGPT5) {
    log(`✅ Chat API works with GPT-5 models`, 'green');
  } else {
    log(`❌ Chat API doesn't work with GPT-5 models`, 'red');
  }
  
  // Recommendations
  log('\n💡 Recommendations:', 'bold');
  
  if (!responsesEndpoint && chatWorksWithGPT5) {
    log('🔧 Use standard Chat API instead of Responses API for gateway', 'blue');
    log('🔧 The gateway handles GPT-5 parameter conversion automatically', 'blue');
  } else if (responsesEndpoint) {
    log('🔧 Use Responses API for GPT-5 models through gateway', 'blue');
  } else {
    log('🔧 Gateway might not support GPT-5 models yet', 'yellow');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { testResponsesAPIEndpoints, testChatCompletionsWithGPT5 };
