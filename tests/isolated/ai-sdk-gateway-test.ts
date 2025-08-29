#!/usr/bin/env node

/**
 * AI SDK Gateway Test
 * 
 * This test uses the proper Vercel AI SDK approach which automatically
 * routes through the AI Gateway when model strings are specified.
 * 
 * Usage:
 *   npx tsx tests/isolated/ai-sdk-gateway-test.ts
 */

import { readFileSync, existsSync } from 'fs';
import { AIGateway } from '../../lib/ai/gateway';
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

class AISDKGatewayTester {
  
  async testDirectAISDK() {
    log('\n🧪 Testing Direct AI SDK with Gateway Routing', 'bold');
    
    if (!process.env.AI_GATEWAY_API_KEY) {
      log('❌ AI_GATEWAY_API_KEY not configured', 'red');
      return false;
    }
    
    if (!process.env.OPENAI_API_KEY) {
      log('❌ OPENAI_API_KEY not configured', 'red');
      return false;
    }
    
    try {
      log('🔄 Making AI SDK call with gateway routing...', 'cyan');
      
      // This should automatically route through the AI Gateway
      const result = await generateText({
        model: 'openai/gpt-4o-mini', // This format triggers gateway routing
        prompt: 'Say "AI SDK Gateway works!" in exactly 4 words.',
        maxTokens: 10,
        temperature: 0,
      });
      
      log(`✅ AI SDK Gateway Response: "${result.text}"`, 'green');
      log(`📊 Usage: ${JSON.stringify(result.usage)}`, 'blue');
      log(`🏁 Finish Reason: ${result.finishReason}`, 'blue');
      
      return true;
    } catch (error) {
      log(`❌ AI SDK Gateway failed: ${error.message}`, 'red');
      return false;
    }
  }
  
  async testGatewayClass() {
    log('\n🧪 Testing AIGateway Class with AI SDK', 'bold');
    
    try {
      const gateway = new AIGateway();
      const result = await gateway.testAISDKGateway('Say "Gateway class works!" in exactly 3 words.');
      
      log(`✅ Gateway Class Response: "${result.text}"`, 'green');
      log(`📊 Usage: ${JSON.stringify(result.usage)}`, 'blue');
      
      return true;
    } catch (error) {
      log(`❌ Gateway class failed: ${error.message}`, 'red');
      return false;
    }
  }
  
  async testFallbackComparison() {
    log('\n🧪 Testing Gateway vs Direct API Comparison', 'bold');
    
    const prompt = 'Say "comparison test" in exactly 2 words.';
    
    // Test 1: AI SDK (should use gateway)
    let aiSDKResult = null;
    try {
      const result = await generateText({
        model: 'openai/gpt-4o-mini',
        prompt,
        maxTokens: 10,
        temperature: 0,
      });
      aiSDKResult = result.text;
      log(`🚪 AI SDK (Gateway): "${result.text}"`, 'green');
    } catch (error) {
      log(`❌ AI SDK failed: ${error.message}`, 'red');
    }
    
    // Test 2: Direct OpenAI (should bypass gateway)
    let directResult = null;
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true,
      });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      });
      
      directResult = response.choices[0]?.message?.content;
      log(`🔗 Direct OpenAI: "${directResult}"`, 'blue');
    } catch (error) {
      log(`❌ Direct OpenAI failed: ${error.message}`, 'red');
    }
    
    // Compare results
    if (aiSDKResult && directResult) {
      log('\n📊 Comparison Results:', 'cyan');
      log(`   AI SDK (Gateway): "${aiSDKResult}"`, 'green');
      log(`   Direct OpenAI:    "${directResult}"`, 'blue');
      
      if (aiSDKResult === directResult) {
        log('✅ Both methods returned identical results', 'green');
      } else {
        log('ℹ️  Different responses (expected due to temperature/randomness)', 'yellow');
      }
    }
  }
  
  async testGatewayStatus() {
    log('\n🧪 Testing Gateway Status Detection', 'bold');
    
    try {
      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      log('📊 Gateway Status:', 'cyan');
      log(`   Gateway Configured: ${status.gateway.configured}`, status.gateway.configured ? 'green' : 'red');
      log(`   AI SDK Configured: ${status.gateway.aiSDKConfigured}`, status.gateway.aiSDKConfigured ? 'green' : 'red');
      log(`   AI SDK Gateway Working: ${status.aiSDK?.gateway}`, status.aiSDK?.gateway ? 'green' : 'red');
      log(`   OpenAI Direct: ${status.openai.configured}`, status.openai.configured ? 'green' : 'red');
      
      return status;
    } catch (error) {
      log(`❌ Status check failed: ${error.message}`, 'red');
      return null;
    }
  }
  
  async runAllTests() {
    log('🚀 AI SDK Gateway Testing Suite', 'bold');
    log('=' .repeat(50), 'cyan');
    
    const results = {
      directAISDK: false,
      gatewayClass: false,
      status: null,
    };
    
    // Test gateway status first
    results.status = await this.testGatewayStatus();
    
    // Test direct AI SDK
    results.directAISDK = await this.testDirectAISDK();
    
    // Test gateway class
    results.gatewayClass = await this.testGatewayClass();
    
    // Test comparison
    await this.testFallbackComparison();
    
    // Summary
    log('\n📋 Test Summary', 'bold');
    log('=' .repeat(30), 'cyan');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const total = Object.keys(results).filter(k => k !== 'status').length;
    
    log(`Tests Passed: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
    
    if (results.directAISDK && results.gatewayClass) {
      log('\n🎉 SUCCESS: AI SDK Gateway is working!', 'green');
      log('✅ The AI SDK is properly routing through the Vercel AI Gateway', 'green');
    } else if (results.status?.openai.configured) {
      log('\n⚠️  Gateway not working, but direct API is available', 'yellow');
      log('💡 Check your AI_GATEWAY_API_KEY configuration', 'blue');
    } else {
      log('\n❌ Neither gateway nor direct API is working', 'red');
      log('💡 Check your API key configuration', 'blue');
    }
    
    return results;
  }
}

async function main() {
  const tester = new AISDKGatewayTester();
  await tester.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { AISDKGatewayTester };
