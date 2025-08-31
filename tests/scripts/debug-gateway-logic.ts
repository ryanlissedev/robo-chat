#!/usr/bin/env tsx
import { getGatewayConfig } from '../../lib/openproviders/env';

// Test the gateway configuration logic
function testGatewayLogic() {
  console.log('=== Gateway Configuration Test ===\n');

  // Test with no gateway key
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_AI_GATEWAY_API_KEY;

  let config = getGatewayConfig();
  console.log('Without gateway key:');
  console.log('Enabled:', config.enabled);
  console.log('BaseURL:', config.baseURL);
  console.log('Headers:', config.headers);

  // Test model detection
  const models = ['gpt-4o-mini', 'gpt-5', 'claude-3-5-sonnet-latest'];

  console.log('\n=== Model Detection Test ===');
  models.forEach((model) => {
    const isGPT5Model = model.startsWith('gpt-5');
    const shouldUseResponses = isGPT5Model && !config.enabled;
    console.log(
      `${model}: isGPT5=${isGPT5Model}, useResponses=${shouldUseResponses}`
    );
  });

  // Test with mock gateway key
  process.env.AI_GATEWAY_API_KEY = 'test-key';
  config = getGatewayConfig();

  console.log('\n=== With Gateway Key ===');
  console.log('Enabled:', config.enabled);
  console.log('BaseURL:', config.baseURL);
  console.log('Headers:', config.headers);

  console.log('\n=== Model Detection With Gateway ===');
  models.forEach((model) => {
    const isGPT5Model = model.startsWith('gpt-5');
    const shouldUseResponses = isGPT5Model && !config.enabled;
    console.log(
      `${model}: isGPT5=${isGPT5Model}, useResponses=${shouldUseResponses}`
    );
  });
}

testGatewayLogic();
