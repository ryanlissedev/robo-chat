#!/usr/bin/env tsx

/**
 * Test OpenAI direct API without gateway to verify baseline functionality
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

async function testOpenAIDirect() {
  console.log('=== Testing OpenAI Direct API ===\n');

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.error('❌ OPENAI_API_KEY not found');
    return false;
  }

  console.log(`OpenAI Key: ${openaiKey.substring(0, 8)}...`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "test successful"' }],
        stream: false,
        max_tokens: 10,
      }),
    });

    console.log('Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log(
        'Response:',
        data.choices?.[0]?.message?.content || 'No content'
      );
      console.log('✅ Direct OpenAI API successful');
      return true;
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
      console.log('❌ Direct OpenAI API failed');
      return false;
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('❌ Direct OpenAI API failed');
    return false;
  }
}

async function main() {
  const success = await testOpenAIDirect();
  process.exit(success ? 0 : 1);
}

main();
