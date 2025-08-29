#!/usr/bin/env tsx

/**
 * Test OpenAI API directly and through Vercel AI Gateway
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

async function testOpenAIDirect() {
  console.log('=== Testing OpenAI API Directly ===\n');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found');
    return false;
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
        messages: [{ role: 'user', content: 'Say "test successful" in 3 words' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Direct OpenAI API call successful');
      return true;
    } else {
      console.log('\n❌ Direct OpenAI API call failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error calling OpenAI directly:', error);
    return false;
  }
}

async function testGateway() {
  console.log('\n=== Testing Vercel AI Gateway ===\n');
  
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL;
  
  if (!apiKey || !baseUrl) {
    console.error('❌ AI_GATEWAY_API_KEY or AI_GATEWAY_BASE_URL not found');
    return false;
  }

  try {
    const response = await fetch(`${baseUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "gateway test successful"' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Gateway API call successful');
      return true;
    } else {
      console.log('\n❌ Gateway API call failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Error calling Gateway:', error);
    return false;
  }
}

async function main() {
  const directSuccess = await testOpenAIDirect();
  const gatewaySuccess = await testGateway();
  
  console.log('\n=== Summary ===');
  console.log('Direct OpenAI:', directSuccess ? '✅' : '❌');
  console.log('Vercel Gateway:', gatewaySuccess ? '✅' : '❌');
  
  process.exit(directSuccess || gatewaySuccess ? 0 : 1);
}

main();