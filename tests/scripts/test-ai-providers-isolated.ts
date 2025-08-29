#!/usr/bin/env tsx

/**
 * Isolated AI Provider Tests
 * Tests direct API connections and gateway configurations
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

interface TestResult {
  provider: string;
  method: string;
  success: boolean;
  status?: number;
  error?: string;
  response?: any;
}

const results: TestResult[] = [];

// Test 1: Direct OpenAI API
async function testOpenAIDirect(): Promise<TestResult> {
  console.log('\n📝 Testing OpenAI Direct API...');
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { 
      provider: 'OpenAI', 
      method: 'Direct API', 
      success: false, 
      error: 'OPENAI_API_KEY not found' 
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Respond with "OK" only' }],
        max_tokens: 5,
        temperature: 0,
      }),
    });

    const data = await response.json();
    return {
      provider: 'OpenAI',
      method: 'Direct API',
      success: response.ok,
      status: response.status,
      response: data.choices?.[0]?.message?.content,
    };
  } catch (error) {
    return {
      provider: 'OpenAI',
      method: 'Direct API',
      success: false,
      error: error.message,
    };
  }
}

// Test 2: Direct Anthropic API
async function testAnthropicDirect(): Promise<TestResult> {
  console.log('\n📝 Testing Anthropic Direct API...');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    return { 
      provider: 'Anthropic', 
      method: 'Direct API', 
      success: false, 
      error: 'ANTHROPIC_API_KEY not found' 
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Respond with "OK" only' }],
        max_tokens: 5,
      }),
    });

    const data = await response.json();
    return {
      provider: 'Anthropic',
      method: 'Direct API',
      success: response.ok,
      status: response.status,
      response: data.content?.[0]?.text,
    };
  } catch (error) {
    return {
      provider: 'Anthropic',
      method: 'Direct API',
      success: false,
      error: error.message,
    };
  }
}

// Test 3: Vercel AI Gateway with different configurations
async function testVercelGateway(): Promise<TestResult[]> {
  console.log('\n📝 Testing Vercel AI Gateway...');
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || !baseUrl) {
    return [{
      provider: 'OpenAI',
      method: 'Vercel Gateway',
      success: false,
      error: 'AI_GATEWAY_API_KEY or AI_GATEWAY_BASE_URL not found',
    }];
  }

  const configs = [
    {
      name: 'Gateway v1 format',
      url: `${baseUrl}/openai/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    },
    {
      name: 'Gateway with auth passthrough',
      url: `${baseUrl}/openai`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': `Bearer ${openaiKey}`,
      },
    },
    {
      name: 'Gateway with provider header',
      url: baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-provider': 'openai',
        'Authorization': `Bearer ${openaiKey}`,
      },
    },
  ];

  const results: TestResult[] = [];
  
  for (const config of configs) {
    try {
      console.log(`  Testing: ${config.name}`);
      const response = await fetch(config.url, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Respond with "OK" only' }],
          max_tokens: 5,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      results.push({
        provider: 'OpenAI',
        method: `Gateway: ${config.name}`,
        success: response.ok,
        status: response.status,
        response: typeof data === 'object' ? data.choices?.[0]?.message?.content : data,
      });
    } catch (error) {
      results.push({
        provider: 'OpenAI',
        method: `Gateway: ${config.name}`,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

// Test 4: Check Vercel deployment config
async function checkVercelConfig(): Promise<void> {
  console.log('\n📋 Checking Vercel Configuration...');
  
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
  if (fs.existsSync(vercelJsonPath)) {
    const config = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
    console.log('  vercel.json found:', JSON.stringify(config, null, 2));
  } else {
    console.log('  No vercel.json found');
  }

  // Check for AI SDK configuration
  console.log('\n  Environment variables:');
  console.log('    AI_GATEWAY_API_KEY:', process.env.AI_GATEWAY_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('    AI_GATEWAY_BASE_URL:', process.env.AI_GATEWAY_BASE_URL || '❌ Not set');
  console.log('    OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
  console.log('    ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');
}

// Main test runner
async function main() {
  console.log('🚀 AI Provider Isolated Tests');
  console.log('=' .repeat(50));

  // Run all tests
  results.push(await testOpenAIDirect());
  results.push(await testAnthropicDirect());
  results.push(...await testVercelGateway());
  
  await checkVercelConfig();

  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(50));
  
  const table = results.map(r => ({
    '✓': r.success ? '✅' : '❌',
    'Provider': r.provider,
    'Method': r.method,
    'Status': r.status || '-',
    'Response': r.response || r.error || 'No response',
  }));
  
  console.table(table);

  // Recommendations
  console.log('\n💡 Recommendations');
  console.log('=' .repeat(50));
  
  const directAPIsWork = results.some(r => r.method.includes('Direct') && r.success);
  const gatewayWorks = results.some(r => r.method.includes('Gateway') && r.success);
  
  if (directAPIsWork && !gatewayWorks) {
    console.log('✅ Direct API connections work');
    console.log('❌ Vercel AI Gateway is not configured correctly');
    console.log('\nRecommended approach:');
    console.log('1. Use direct API connections as fallback');
    console.log('2. Implement provider switching logic');
    console.log('3. Consider configuring Vercel AI Gateway properly or removing it');
  } else if (gatewayWorks) {
    console.log('✅ Vercel AI Gateway is working');
    console.log('Use the gateway for rate limiting and analytics');
  } else {
    console.log('❌ No AI providers are working');
    console.log('Check your API keys and network connection');
  }

  // Create implementation strategy
  console.log('\n📝 Implementation Strategy');
  console.log('=' .repeat(50));
  console.log(`
Based on the test results, here's the recommended implementation:

1. **Provider Factory Pattern**
   - Create a provider factory that can switch between direct and gateway
   - Use environment variables to control the mode

2. **Configuration Structure**
   \`\`\`typescript
   interface ProviderConfig {
     mode: 'direct' | 'gateway';
     provider: 'openai' | 'anthropic';
     apiKey: string;
     gatewayUrl?: string;
     gatewayKey?: string;
   }
   \`\`\`

3. **Error Handling**
   - Implement automatic fallback from gateway to direct
   - Add retry logic with exponential backoff
   - Log failures for debugging

4. **Testing**
   - Unit tests for each provider
   - Integration tests for gateway routing
   - E2E tests for the complete flow
  `);

  process.exit(results.some(r => r.success) ? 0 : 1);
}

main().catch(console.error);