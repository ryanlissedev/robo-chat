#!/usr/bin/env node

/**
 * Quick Gateway Fix Test
 * 
 * Test the correct AI Gateway URL format
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

async function testGatewayURL() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL;
  
  console.log('🔍 Current configuration:');
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   API Key: ${apiKey ? 'Set' : 'Not set'}`);
  
  if (!apiKey) {
    console.log('❌ No AI_GATEWAY_API_KEY found');
    return;
  }
  
  // Test different URL formats
  const urlsToTest = [
    baseUrl,
    baseUrl + '/ai',
    baseUrl.replace('/v1/', '/v1/ai/'),
    'https://ai-gateway.vercel.sh/v1/ai',
  ];
  
  for (const testUrl of urlsToTest) {
    console.log(`\n🧪 Testing: ${testUrl}`);
    
    try {
      const response = await fetch(`${testUrl}/openai/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say "gateway works"' }],
          max_tokens: 5,
        }),
      });
      
      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        console.log(`   ✅ SUCCESS! Response: "${content}"`);
        console.log(`   🎯 Use this URL: ${testUrl}`);
        return;
      } else if (response.status !== 405) {
        const text = await response.text();
        console.log(`   ⚠️  Error: ${text.substring(0, 100)}`);
      } else {
        console.log(`   ❌ Method not allowed (wrong endpoint)`);
      }
    } catch (error) {
      console.log(`   ❌ Network error: ${error.message}`);
    }
  }
  
  console.log('\n💡 None of the URLs worked. The gateway might be:');
  console.log('   1. Requiring different authentication');
  console.log('   2. Not publicly accessible');
  console.log('   3. Using a different API format');
  console.log('   4. Requiring your own deployment');
}

testGatewayURL().catch(console.error);
