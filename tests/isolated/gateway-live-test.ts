#!/usr/bin/env node

/**
 * Live AI Gateway Test Script
 * 
 * This script tests the AI gateway with real API calls.
 * It requires actual API keys to be configured.
 * 
 * Usage:
 *   npx tsx tests/isolated/gateway-live-test.ts
 *   
 * Environment variables needed:
 *   - OPENAI_API_KEY (for direct testing)
 *   - AI_GATEWAY_API_KEY (for gateway testing)
 *   - AI_GATEWAY_BASE_URL (optional, defaults to Vercel AI Gateway)
 */

import { AIGateway } from '../../lib/ai/gateway';
import { readFileSync, existsSync } from 'fs';

// Load environment variables manually
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

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
  details?: any;
}

class GatewayLiveTester {
  private results: TestResult[] = [];

  async runTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    log(`\n🧪 Running: ${name}`, 'cyan');
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      log(`✅ Passed: ${name} (${duration}ms)`, 'green');
      
      const testResult: TestResult = {
        name,
        success: true,
        duration,
        details: result,
      };
      
      this.results.push(testResult);
      return testResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      log(`❌ Failed: ${name} (${duration}ms)`, 'red');
      log(`   Error: ${errorMessage}`, 'red');
      
      const testResult: TestResult = {
        name,
        success: false,
        duration,
        error: errorMessage,
      };
      
      this.results.push(testResult);
      return testResult;
    }
  }

  async testGatewayStatus() {
    return this.runTest('Gateway Status Check', async () => {
      const gateway = new AIGateway();
      const status = await gateway.getStatus();
      
      log(`   Gateway configured: ${status.gateway.configured}`, 'blue');
      log(`   Gateway URL: ${status.gateway.url || 'Not set'}`, 'blue');
      log(`   OpenAI configured: ${status.openai.configured}`, 'blue');
      log(`   Anthropic configured: ${status.anthropic.configured}`, 'blue');
      
      return status;
    });
  }

  async testDirectOpenAI() {
    return this.runTest('Direct OpenAI Connection', async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not configured');
      }

      const gateway = new AIGateway({ mode: 'direct' });
      const client = await gateway.getOpenAIClient();
      
      if (client.isGateway) {
        throw new Error('Expected direct client, got gateway client');
      }

      // Test actual API call
      const openaiClient = client.client as any;
      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test successful" in exactly 2 words.' }],
        max_tokens: 10,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      log(`   Response: "${content}"`, 'blue');
      
      return {
        isGateway: client.isGateway,
        response: content,
        usage: response.usage,
      };
    });
  }

  async testGatewayConnection() {
    return this.runTest('Gateway Connection Test', async () => {
      if (!process.env.AI_GATEWAY_API_KEY) {
        throw new Error('AI_GATEWAY_API_KEY not configured');
      }

      const gateway = new AIGateway();
      const testResult = await gateway.testGatewayConnection('openai');
      
      if (!testResult.success) {
        throw new Error(`Gateway test failed: ${testResult.error}`);
      }

      log(`   Gateway connection successful`, 'blue');
      return testResult;
    });
  }

  async testGatewayOpenAI() {
    return this.runTest('Gateway OpenAI API Call', async () => {
      if (!process.env.AI_GATEWAY_API_KEY) {
        throw new Error('AI_GATEWAY_API_KEY not configured');
      }

      const gateway = new AIGateway({ mode: 'gateway' });
      
      // Mock successful gateway test to force gateway usage
      gateway.testGatewayConnection = async () => ({ success: true });
      
      const client = await gateway.getOpenAIClient();
      
      if (!client.isGateway) {
        throw new Error('Expected gateway client, got direct client');
      }

      // Test actual API call through gateway
      const gatewayClient = client.client as any;
      const response = await gatewayClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "gateway works" in exactly 2 words.' }],
        max_tokens: 10,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      log(`   Gateway response: "${content}"`, 'blue');
      
      return {
        isGateway: client.isGateway,
        response: content,
        usage: response.usage,
      };
    });
  }

  async testAutoMode() {
    return this.runTest('Auto Mode (Gateway with Fallback)', async () => {
      const gateway = new AIGateway({ mode: 'auto' });
      const client = await gateway.getOpenAIClient();
      
      log(`   Using ${client.isGateway ? 'gateway' : 'direct'} client`, 'blue');
      
      // Test actual API call
      const apiClient = client.client as any;
      const response = await apiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "auto mode" in exactly 2 words.' }],
        max_tokens: 10,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      log(`   Auto mode response: "${content}"`, 'blue');
      
      return {
        isGateway: client.isGateway,
        response: content,
        usage: response.usage,
      };
    });
  }

  async testRawGatewayAPI() {
    return this.runTest('Raw Gateway API Call', async () => {
      if (!process.env.AI_GATEWAY_API_KEY || !process.env.AI_GATEWAY_BASE_URL) {
        throw new Error('Gateway configuration missing');
      }

      const response = await fetch(`${process.env.AI_GATEWAY_BASE_URL}/openai/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.AI_GATEWAY_API_KEY,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "raw API" in exactly 2 words.' }],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      log(`   Raw API response: "${content}"`, 'blue');
      
      return {
        status: response.status,
        response: content,
        usage: data.usage,
      };
    });
  }

  printSummary() {
    log('\n📊 Test Summary', 'bold');
    log('=' .repeat(50), 'cyan');
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    log(`Total tests: ${this.results.length}`, 'blue');
    log(`Passed: ${passed}`, 'green');
    log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
    
    if (failed > 0) {
      log('\n❌ Failed tests:', 'red');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          log(`   • ${r.name}: ${r.error}`, 'red');
        });
    }
    
    log('\n✅ Passed tests:', 'green');
    this.results
      .filter(r => r.success)
      .forEach(r => {
        log(`   • ${r.name} (${r.duration}ms)`, 'green');
      });
  }
}

async function main() {
  log('🚀 AI Gateway Live Testing', 'bold');
  log('Testing with real API calls...', 'yellow');
  
  const tester = new GatewayLiveTester();
  
  // Run all tests
  await tester.testGatewayStatus();
  await tester.testDirectOpenAI();
  await tester.testGatewayConnection();
  await tester.testGatewayOpenAI();
  await tester.testAutoMode();
  await tester.testRawGatewayAPI();
  
  tester.printSummary();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

export { GatewayLiveTester };
