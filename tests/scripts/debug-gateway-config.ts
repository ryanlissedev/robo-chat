#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment variables from .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  console.log('=== Loading .env.local ===');

  envContent.split('\n').forEach((line) => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
        console.log(
          `${key.trim()}: ${key.includes('GATEWAY') ? '[SET]' : '[HIDDEN]'}`
        );
      }
    }
  });
} catch (_error) {
  console.error('Warning: Could not load .env.local file');
}

import { getGatewayConfig } from '../../lib/openproviders/env';

console.log('\n=== Gateway Configuration Debug ===');

console.log('Environment Variables:');
console.log(
  `AI_GATEWAY_API_KEY: ${process.env.AI_GATEWAY_API_KEY ? '[SET]' : '[NOT SET]'}`
);
console.log(
  `VERCEL_AI_GATEWAY_API_KEY: ${process.env.VERCEL_AI_GATEWAY_API_KEY ? '[SET]' : '[NOT SET]'}`
);
console.log(
  `AI_GATEWAY_BASE_URL: ${process.env.AI_GATEWAY_BASE_URL || 'default'}`
);

const gatewayConfig = getGatewayConfig();
console.log('\nGateway Config:');
console.log(`enabled: ${gatewayConfig.enabled}`);
console.log(`baseURL: ${gatewayConfig.baseURL}`);
console.log(`headers: ${JSON.stringify(gatewayConfig.headers, null, 2)}`);

// Test what happens when we manually set gateway key
process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';
const gatewayConfigWithKey = getGatewayConfig();
console.log('\nGateway Config (with mock key):');
console.log(`enabled: ${gatewayConfigWithKey.enabled}`);
console.log(`baseURL: ${gatewayConfigWithKey.baseURL}`);
console.log(
  `headers: ${JSON.stringify(gatewayConfigWithKey.headers, null, 2)}`
);

// Test the openproviders function directly
import { openproviders } from '../../lib/openproviders';

console.log('\n=== Testing Provider Creation ===');

console.log('1. Testing without gateway key...');
delete process.env.AI_GATEWAY_API_KEY;
delete process.env.VERCEL_AI_GATEWAY_API_KEY;
const providerWithoutGateway = openproviders('gpt-4o-mini');
console.log(`Provider created: ${!!providerWithoutGateway}`);

console.log('2. Testing with gateway key...');
process.env.AI_GATEWAY_API_KEY = 'mock-gateway-key';
const providerWithGateway = openproviders('gpt-4o-mini');
console.log(`Provider created: ${!!providerWithGateway}`);
