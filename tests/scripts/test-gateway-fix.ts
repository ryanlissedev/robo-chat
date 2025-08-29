#!/usr/bin/env tsx

/**
 * Test and debug the AI Gateway configuration
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

async function testCorrectGatewayFormat() {
  console.log('=== Testing Correct Vercel AI Gateway Format ===\n');
  
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || !baseUrl) {
    console.error('❌ AI_GATEWAY_API_KEY or AI_GATEWAY_BASE_URL not found');
    return false;
  }

  // Test 1: Try the documented gateway format with provider-specific endpoint
  console.log('Test 1: Gateway with provider endpoint');
  try {
    const response = await fetch(`${baseUrl}/openai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Authorization': `Bearer ${openaiKey}`, // Pass through OpenAI key
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.ok) {
      console.log('✅ Gateway format 1 successful\n');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Try direct passthrough format
  console.log('\nTest 2: Direct passthrough format');
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-provider': 'openai',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.ok) {
      console.log('✅ Gateway format 2 successful\n');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Try with different auth header format
  console.log('\nTest 3: Alternative auth header');
  try {
    const response = await fetch(`${baseUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-openai-api-key': openaiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.ok) {
      console.log('✅ Gateway format 3 successful\n');
      return true;
    }
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n❌ All gateway formats failed');
  return false;
}

async function main() {
  const success = await testCorrectGatewayFormat();
  
  if (success) {
    console.log('\n=== Gateway Configuration Found ===');
    console.log('Update the provider configuration accordingly.');
  } else {
    console.log('\n=== Fallback to Direct API ===');
    console.log('Gateway not working, will implement BYOK fallback.');
  }
  
  process.exit(success ? 0 : 1);
}

main();