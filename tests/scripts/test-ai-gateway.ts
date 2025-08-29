#!/usr/bin/env node
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
} catch (error) {
  console.error('Warning: Could not load .env.local file');
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.blue);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

// Test configuration
const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
const GATEWAY_API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function testDirectOpenAI() {
  logSection('Test 1: Direct OpenAI API (Baseline)');
  
  try {
    const openai = createOpenAI({
      apiKey: OPENAI_API_KEY,
    });
    
    logInfo('Testing with gpt-4o-mini...');
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: 'Say "Hello from Direct OpenAI" in exactly 5 words.',
      maxTokens: 20,
    });
    
    logSuccess('Direct OpenAI API works!');
    log(`Response: ${result.text}`, colors.yellow);
    log(`Tokens used: ${result.usage?.totalTokens || 'N/A'}`, colors.cyan);
    return true;
  } catch (error) {
    logError('Direct OpenAI API failed:');
    console.error(error);
    return false;
  }
}

async function testGatewayWithOpenAIKey() {
  logSection('Test 2: AI Gateway with OpenAI API Key');
  
  try {
    const openai = createOpenAI({
      baseURL: GATEWAY_BASE_URL,
      apiKey: OPENAI_API_KEY,
      headers: {
        'X-Provider': 'openai',
      },
    });
    
    logInfo(`Gateway URL: ${GATEWAY_BASE_URL}`);
    logInfo('Using OpenAI API key for authentication...');
    
    const result = await generateText({
      model: openai('openai/gpt-4o-mini'),
      prompt: 'Say "Hello from Gateway with OpenAI key" in exactly 7 words.',
      maxTokens: 20,
    });
    
    logSuccess('Gateway with OpenAI key works!');
    log(`Response: ${result.text}`, colors.yellow);
    log(`Tokens used: ${result.usage?.totalTokens || 'N/A'}`, colors.cyan);
    return true;
  } catch (error: any) {
    logError('Gateway with OpenAI key failed:');
    if (error.response) {
      log(`Status: ${error.response.status}`, colors.red);
      log(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`, colors.red);
    }
    console.error(error);
    return false;
  }
}

async function testGatewayWithGatewayKey() {
  logSection('Test 3: AI Gateway with Gateway API Key');
  
  if (!GATEWAY_API_KEY) {
    logError('VERCEL_AI_GATEWAY_API_KEY not found in environment');
    logInfo('Set VERCEL_AI_GATEWAY_API_KEY in .env.local to test this mode');
    return false;
  }
  
  try {
    const openai = createOpenAI({
      baseURL: GATEWAY_BASE_URL,
      apiKey: GATEWAY_API_KEY,
      headers: {
        'X-Provider': 'openai',
      },
    });
    
    logInfo(`Gateway URL: ${GATEWAY_BASE_URL}`);
    logInfo('Using Gateway API key for authentication...');
    
    const result = await generateText({
      model: openai('openai/gpt-4o-mini'),
      prompt: 'Say "Hello from Gateway with Gateway key" in exactly 7 words.',
      maxTokens: 20,
    });
    
    logSuccess('Gateway with Gateway key works!');
    log(`Response: ${result.text}`, colors.yellow);
    log(`Tokens used: ${result.usage?.totalTokens || 'N/A'}`, colors.cyan);
    return true;
  } catch (error: any) {
    logError('Gateway with Gateway key failed:');
    if (error.response) {
      log(`Status: ${error.response.status}`, colors.red);
      log(`Headers: ${JSON.stringify(error.response.headers, null, 2)}`, colors.red);
    }
    console.error(error);
    return false;
  }
}

async function testGatewayStreaming() {
  logSection('Test 4: AI Gateway Streaming');
  
  try {
    const openai = createOpenAI({
      baseURL: GATEWAY_BASE_URL,
      apiKey: OPENAI_API_KEY,
      headers: {
        'X-Provider': 'openai',
      },
    });
    
    logInfo('Testing streaming with gateway...');
    
    const result = streamText({
      model: openai('openai/gpt-4o-mini'),
      prompt: 'Count from 1 to 5 slowly.',
      maxTokens: 50,
    });
    
    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      process.stdout.write(chunk);
    }
    
    console.log(); // New line after streaming
    logSuccess('Gateway streaming works!');
    return true;
  } catch (error: any) {
    logError('Gateway streaming failed:');
    console.error(error);
    return false;
  }
}

async function testProviderRouting() {
  logSection('Test 5: Provider Routing (Multiple Providers)');
  
  const providers = [
    { name: 'openai', model: 'openai/gpt-4o-mini', apiKey: OPENAI_API_KEY },
    { name: 'anthropic', model: 'anthropic/claude-3-haiku-20240307', apiKey: process.env.ANTHROPIC_API_KEY },
  ];
  
  for (const provider of providers) {
    if (!provider.apiKey) {
      logInfo(`Skipping ${provider.name} (no API key found)`);
      continue;
    }
    
    try {
      logInfo(`Testing ${provider.name}...`);
      
      const client = createOpenAI({
        baseURL: GATEWAY_BASE_URL,
        apiKey: provider.apiKey,
        headers: {
          'X-Provider': provider.name,
        },
      });
      
      const result = await generateText({
        model: client(provider.model),
        prompt: `Say "Hello from ${provider.name}" in exactly 4 words.`,
        maxTokens: 20,
      });
      
      logSuccess(`${provider.name} routing works!`);
      log(`Response: ${result.text}`, colors.yellow);
    } catch (error: any) {
      logError(`${provider.name} routing failed:`);
      if (error.response) {
        log(`Status: ${error.response.status}`, colors.red);
      }
      console.error(error.message);
    }
  }
}

async function runAllTests() {
  logSection('🚀 AI Gateway Test Suite');
  
  logInfo('Environment Check:');
  log(`OPENAI_API_KEY: ${OPENAI_API_KEY ? '✓ Found' : '✗ Missing'}`, OPENAI_API_KEY ? colors.green : colors.red);
  log(`VERCEL_AI_GATEWAY_API_KEY: ${GATEWAY_API_KEY ? '✓ Found' : '✗ Missing'}`, GATEWAY_API_KEY ? colors.green : colors.red);
  log(`ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Found' : '✗ Missing'}`, process.env.ANTHROPIC_API_KEY ? colors.green : colors.red);
  
  const results = {
    directOpenAI: false,
    gatewayWithOpenAI: false,
    gatewayWithGatewayKey: false,
    gatewayStreaming: false,
    providerRouting: false,
  };
  
  // Run tests
  results.directOpenAI = await testDirectOpenAI();
  results.gatewayWithOpenAI = await testGatewayWithOpenAIKey();
  results.gatewayWithGatewayKey = await testGatewayWithGatewayKey();
  results.gatewayStreaming = await testGatewayStreaming();
  await testProviderRouting(); // Results tracked internally
  
  // Summary
  logSection('📊 Test Summary');
  
  const tests = Object.entries(results);
  const passed = tests.filter(([_, result]) => result).length;
  const total = tests.length;
  
  tests.forEach(([name, result]) => {
    const displayName = name.replace(/([A-Z])/g, ' $1').trim();
    log(`${result ? '✅' : '❌'} ${displayName}`, result ? colors.green : colors.red);
  });
  
  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    logSuccess(`All ${total} tests passed! 🎉`);
  } else {
    logError(`${passed}/${total} tests passed`);
  }
  
  // Configuration recommendations
  if (!results.gatewayWithGatewayKey && !GATEWAY_API_KEY) {
    console.log('\n' + '💡 ' + colors.yellow + 'Recommendation:' + colors.reset);
    log('To use Vercel AI Gateway with a gateway key:', colors.cyan);
    log('1. Go to https://vercel.com/dashboard/ai-gateway', colors.cyan);
    log('2. Create a gateway and get your API key', colors.cyan);
    log('3. Add to .env.local: VERCEL_AI_GATEWAY_API_KEY=your_key', colors.cyan);
  }
}

// Run tests
runAllTests().catch(console.error);