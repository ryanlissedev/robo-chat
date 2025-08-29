/**
 * Vercel AI SDK Provider Implementation
 * Uses the native Vercel AI SDK for proper gateway integration
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, streamText, LanguageModel } from 'ai';

export interface VercelAIConfig {
  provider: 'openai' | 'anthropic';
  apiKey?: string;
  baseURL?: string;
  useGateway?: boolean;
}

export interface VercelAIProvider {
  type: 'openai' | 'anthropic';
  model: LanguageModel;
  isGateway: boolean;
  generateText: typeof generateText;
  streamText: typeof streamText;
}

/**
 * Create a Vercel AI SDK provider with proper gateway support
 */
export function createVercelAIProvider(config: VercelAIConfig): VercelAIProvider {
  let model: LanguageModel;
  let isGateway = false;

  if (config.provider === 'openai') {
    const openaiConfig: any = {};
    
    // Use gateway if baseURL is provided
    if (config.baseURL) {
      openaiConfig.baseURL = config.baseURL;
      isGateway = true;
    }
    
    // Set API key if provided
    if (config.apiKey) {
      openaiConfig.apiKey = config.apiKey;
    } else if (process.env.OPENAI_API_KEY) {
      openaiConfig.apiKey = process.env.OPENAI_API_KEY;
    }

    // Create OpenAI provider using Vercel AI SDK
    const openai = createOpenAI(openaiConfig);
    model = openai('gpt-4o-mini'); // Default model
    
  } else if (config.provider === 'anthropic') {
    const anthropicConfig: any = {};
    
    // Use gateway if baseURL is provided
    if (config.baseURL) {
      anthropicConfig.baseURL = config.baseURL;
      isGateway = true;
    }
    
    // Set API key if provided
    if (config.apiKey) {
      anthropicConfig.apiKey = config.apiKey;
    } else if (process.env.ANTHROPIC_API_KEY) {
      anthropicConfig.apiKey = process.env.ANTHROPIC_API_KEY;
    }

    // Create Anthropic provider using Vercel AI SDK
    const anthropic = createAnthropic(anthropicConfig);
    model = anthropic('claude-3-haiku-20240307'); // Default model
    
  } else {
    throw new Error(`Unsupported provider: ${config.provider}`);
  }

  return {
    type: config.provider,
    model,
    isGateway,
    generateText,
    streamText,
  };
}

/**
 * Test Vercel AI SDK provider connection
 */
export async function testVercelAIProvider(config: VercelAIConfig): Promise<{
  success: boolean;
  error?: string;
  response?: string;
}> {
  try {
    const provider = createVercelAIProvider(config);
    
    // Test with a simple generation
    const result = await generateText({
      model: provider.model,
      messages: [{ role: 'user', content: 'Say "OK"' }],
      maxRetries: 1,
    });
    
    return {
      success: true,
      response: result.text,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create provider with automatic fallback
 */
export async function createVercelAIProviderWithFallback(
  config: VercelAIConfig
): Promise<VercelAIProvider> {
  // First try with gateway if configured
  if (config.useGateway && config.baseURL) {
    const gatewayConfig = { ...config };
    const testResult = await testVercelAIProvider(gatewayConfig);
    
    if (testResult.success) {
      console.log(`✅ Vercel AI SDK: Using gateway for ${config.provider}`);
      return createVercelAIProvider(gatewayConfig);
    } else {
      console.warn(`⚠️ Gateway failed for ${config.provider}, falling back to direct API`);
    }
  }
  
  // Fallback to direct API
  const directConfig = { ...config, baseURL: undefined, useGateway: false };
  console.log(`✅ Vercel AI SDK: Using direct API for ${config.provider}`);
  return createVercelAIProvider(directConfig);
}

/**
 * Get all configured providers
 */
export async function getAllVercelAIProviders(
  gatewayURL?: string
): Promise<{
  openai?: VercelAIProvider;
  anthropic?: VercelAIProvider;
}> {
  const providers: {
    openai?: VercelAIProvider;
    anthropic?: VercelAIProvider;
  } = {};

  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      providers.openai = await createVercelAIProviderWithFallback({
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: gatewayURL,
        useGateway: !!gatewayURL,
      });
    } catch (error) {
      console.error('Failed to create OpenAI provider:', error);
    }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      providers.anthropic = await createVercelAIProviderWithFallback({
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: gatewayURL,
        useGateway: !!gatewayURL,
      });
    } catch (error) {
      console.error('Failed to create Anthropic provider:', error);
    }
  }

  return providers;
}