#!/usr/bin/env node

/**
 * Debug Gateway Routing Test
 * 
 * This test investigates exactly what's happening with gateway routing
 * by testing different approaches and monitoring network traffic.
 */

import { readFileSync, existsSync } from 'fs';
import { generateText } from 'ai';

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

class GatewayRoutingDebugger {
  
  async testDirectGatewayAPI() {
    log('\n🔍 Testing Direct Gateway API Calls', 'bold');
    
    const gatewayUrl = process.env.AI_GATEWAY_BASE_URL;
    const gatewayKey = process.env.AI_GATEWAY_API_KEY;
    
    log(`Gateway URL: ${gatewayUrl}`, 'blue');
    log(`Gateway Key: ${gatewayKey ? 'Set' : 'Not set'}`, 'blue');
    
    if (!gatewayUrl || !gatewayKey) {
      log('❌ Gateway not configured', 'red');
      return;
    }
    
    // Test different endpoint variations
    const endpoints = [
      `${gatewayUrl}/openai/chat/completions`,
      `${gatewayUrl}/chat/completions`,
      `${gatewayUrl}/v1/chat/completions`,
      `${gatewayUrl}/openai/v1/chat/completions`,
    ];
    
    for (const endpoint of endpoints) {
      log(`\n🧪 Testing endpoint: ${endpoint}`, 'cyan');
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gatewayKey}`,
            'x-api-key': gatewayKey,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5,
          }),
        });
        
        log(`   Status: ${response.status}`, response.ok ? 'green' : 'red');
        
        if (response.ok) {
          const data = await response.json();
          log(`   ✅ SUCCESS! Response: ${JSON.stringify(data).substring(0, 100)}...`, 'green');
          return endpoint;
        } else {
          const text = await response.text();
          log(`   Error: ${text.substring(0, 100)}`, 'red');
        }
      } catch (error) {
        log(`   Network error: ${error.message}`, 'red');
      }
    }
    
    log('\n❌ No working gateway endpoints found', 'red');
    return null;
  }
  
  async testAISDKWithDifferentModels() {
    log('\n🔍 Testing AI SDK with Different Model Formats', 'bold');
    
    const modelFormats = [
      'gpt-4o-mini',
      'openai/gpt-4o-mini',
      'openai:gpt-4o-mini',
    ];
    
    for (const model of modelFormats) {
      log(`\n🧪 Testing model format: "${model}"`, 'cyan');
      
      try {
        const result = await generateText({
          model: model as any,
          prompt: 'Say "test" in one word.',
          maxTokens: 5,
        });
        
        log(`   ✅ Success: "${result.text}"`, 'green');
        log(`   Usage: ${JSON.stringify(result.usage)}`, 'blue');
        
        // Check if this looks like it went through gateway
        if (result.usage && 'inputTokens' in result.usage) {
          log(`   🚪 Likely used gateway (has inputTokens)`, 'green');
        } else if (result.usage && 'prompt_tokens' in result.usage) {
          log(`   🔗 Likely used direct API (has prompt_tokens)`, 'yellow');
        }
        
      } catch (error) {
        log(`   ❌ Failed: ${error.message}`, 'red');
      }
    }
  }
  
  async testWithoutGatewayKey() {
    log('\n🔍 Testing AI SDK Without Gateway Key', 'bold');
    
    // Temporarily remove gateway key
    const originalKey = process.env.AI_GATEWAY_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    
    try {
      const result = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: 'Say "direct" in one word.',
        maxTokens: 5,
      });
      
      log(`   ✅ Without gateway key: "${result.text}"`, 'green');
      log(`   Usage: ${JSON.stringify(result.usage)}`, 'blue');
      
    } catch (error) {
      log(`   ❌ Failed without gateway key: ${error.message}`, 'red');
    } finally {
      // Restore gateway key
      if (originalKey) {
        process.env.AI_GATEWAY_API_KEY = originalKey;
      }
    }
  }
  
  async testNetworkInterception() {
    log('\n🔍 Testing Network Request Interception', 'bold');
    
    // Override fetch to intercept requests
    const originalFetch = global.fetch;
    const interceptedRequests: Array<{ url: string; method: string; headers: any }> = [];
    
    global.fetch = async (url: any, options: any) => {
      interceptedRequests.push({
        url: url.toString(),
        method: options?.method || 'GET',
        headers: options?.headers || {},
      });
      
      return originalFetch(url, options);
    };
    
    try {
      log('🔄 Making AI SDK call with request interception...', 'cyan');
      
      const result = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt: 'Say "intercepted" in one word.',
        maxTokens: 5,
      });
      
      log(`   ✅ Response: "${result.text}"`, 'green');
      
      log('\n📡 Intercepted Network Requests:', 'cyan');
      interceptedRequests.forEach((req, i) => {
        log(`   ${i + 1}. ${req.method} ${req.url}`, 'blue');
        
        // Check if this looks like a gateway request
        if (req.url.includes('ai-gateway.vercel.sh')) {
          log(`      🚪 GATEWAY REQUEST!`, 'green');
        } else if (req.url.includes('api.openai.com')) {
          log(`      🔗 Direct OpenAI API`, 'yellow');
        }
        
        // Check authorization headers
        const auth = req.headers?.Authorization || req.headers?.authorization;
        if (auth) {
          const keyPreview = auth.substring(0, 20) + '...';
          log(`      Auth: ${keyPreview}`, 'blue');
        }
      });
      
    } finally {
      // Restore original fetch
      global.fetch = originalFetch;
    }
  }
  
  async runAllTests() {
    log('🚀 Gateway Routing Debug Suite', 'bold');
    log('=' .repeat(50), 'cyan');
    
    log('\n📋 Environment Configuration:', 'bold');
    log(`   AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? 'Set' : 'Not set'}`, 'blue');
    log(`   AI_GATEWAY_BASE_URL: ${process.env.AI_GATEWAY_BASE_URL || 'Not set'}`, 'blue');
    log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : 'Not set'}`, 'blue');
    
    // Test 1: Direct gateway API calls
    await this.testDirectGatewayAPI();
    
    // Test 2: AI SDK with different model formats
    await this.testAISDKWithDifferentModels();
    
    // Test 3: AI SDK without gateway key
    await this.testWithoutGatewayKey();
    
    // Test 4: Network request interception
    await this.testNetworkInterception();
    
    log('\n📋 Summary', 'bold');
    log('=' .repeat(30), 'cyan');
    log('If you see "GATEWAY REQUEST!" in the intercepted requests,', 'blue');
    log('then the AI SDK is actually using the gateway.', 'blue');
    log('If you only see "Direct OpenAI API", then it\'s falling back.', 'blue');
  }
}

async function main() {
  const tester = new GatewayRoutingDebugger();
  await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { GatewayRoutingDebugger };
