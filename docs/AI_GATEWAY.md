# AI Gateway Implementation

## Overview

The AI Gateway provides a unified interface for accessing AI providers (OpenAI, Anthropic) with automatic fallback from Vercel AI Gateway to direct API connections.

## Features

- **Automatic Fallback**: Tries gateway first, falls back to direct API if unavailable
- **Multiple Providers**: Supports OpenAI and Anthropic
- **Caching**: Caches client instances for performance
- **Error Handling**: Graceful degradation with detailed error reporting
- **Configuration Modes**: Direct, Gateway, or Auto modes

## Configuration

### Environment Variables

```bash
# Gateway Configuration (Optional)
AI_GATEWAY_MODE=auto           # auto | direct | gateway
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1/
AI_GATEWAY_API_KEY=your-gateway-key

# Provider API Keys
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Configuration Modes

1. **Direct Mode**: Always uses direct API connections
2. **Gateway Mode**: Always tries to use gateway (fails if unavailable)
3. **Auto Mode** (Default): Tries gateway first, falls back to direct

## Usage

### Basic Usage

```typescript
import { createAIProvider } from '@/lib/ai/gateway';

// Get OpenAI provider with automatic configuration
const provider = await createAIProvider('openai');

// Use the client
const client = provider.client;
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Advanced Usage

```typescript
import { AIGateway } from '@/lib/ai/gateway';

// Create gateway with custom configuration
const gateway = new AIGateway({
  mode: 'auto',
  openaiApiKey: process.env.OPENAI_API_KEY,
  gatewayUrl: process.env.AI_GATEWAY_BASE_URL,
});

// Get status of all providers
const status = await gateway.getStatus();
console.log('Provider Status:', status);

// Get specific provider
const openai = await gateway.getOpenAIClient();
console.log('Using Gateway:', openai.isGateway);
```

## Testing

### Run All Tests

```bash
# Unit tests (all passing)
npm run test tests/unit/ai-gateway.test.ts

# Integration tests (validates fallback behavior)
npx tsx tests/scripts/test-gateway-integration.ts

# Provider tests (isolated connection testing)
npx tsx tests/scripts/test-ai-providers-isolated.ts
```

### Test Coverage

- ✅ Direct API connections (OpenAI, Anthropic)
- ✅ Gateway mode with automatic fallback
- ✅ Client instance caching
- ✅ Error handling and recovery
- ✅ Configuration management
- ✅ Singleton pattern implementation

### Test Individual Components

```bash
# Test OpenAI direct connection
npx tsx tests/scripts/test-openai-direct.ts

# Test gateway configurations
npx tsx tests/scripts/test-gateway-fix.ts
```

## Architecture

```
┌─────────────────┐
│   Application   │
└────────┬────────┘
         │
    ┌────▼────┐
    │Gateway  │
    │ Factory │
    └────┬────┘
         │
    ┌────▼────┐
    │  Mode   │
    │ Router  │
    └────┬────┘
         │
    ┌────▼────────────┐
    │                 │
┌───▼──┐         ┌───▼───┐
│Direct│         │Gateway│
│ API  │         │  API  │
└──────┘         └───┬───┘
                     │
                ┌────▼────┐
                │Fallback │
                │to Direct│
                └─────────┘
```

## Troubleshooting

### Gateway Not Working

If the gateway returns 405 or 404 errors:

1. Verify the gateway URL format
2. Check API key validity
3. Ensure the gateway service is configured correctly

The system will automatically fall back to direct API connections.

### API Key Issues

- **OpenAI**: Ensure key starts with `sk-`
- **Anthropic**: Ensure key starts with `sk-ant-`
- **Gateway**: Check Vercel dashboard for correct key

### Performance

- Clients are cached after first initialization
- Gateway connection is tested only once per session
- Fallback is automatic and transparent

## Migration Guide

### From Direct API Usage

```typescript
// Before
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After
const provider = await createAIProvider('openai');
const openai = provider.client;
```

### From Existing Gateway

```typescript
// Before
const client = new OpenAI({
  baseURL: 'https://gateway.example.com',
  apiKey: gatewayKey,
});

// After
const provider = await createAIProvider('openai', { mode: 'gateway' });
const client = provider.client;
```

## Benefits

1. **Resilience**: Automatic fallback ensures service availability
2. **Flexibility**: Easy to switch between gateway and direct modes
3. **Cost Control**: Use gateway for rate limiting and monitoring
4. **Performance**: Cached clients and optimized connection testing
5. **Simplicity**: Single interface for all AI providers