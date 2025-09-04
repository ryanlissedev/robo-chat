/**
 * Vercel AI Gateway Provider
 * Implements proper Vercel AI Gateway integration using AI SDK
 */

import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { generateText, type LanguageModel, streamText } from 'ai';

export interface GatewayProviderConfig {
  provider: 'openai' | 'anthropic';
  model?: string;
  apiKey?: string;
  gatewayApiKey?: string;
  useGateway?: boolean;
  providerOptions?: {
    gateway?: {
      order?: string[];
      only?: string[];
    };
    [key: string]: any;
  };
}

export class VercelGatewayProvider {
  private config: GatewayProviderConfig;
  private model: LanguageModel;

  constructor(config: GatewayProviderConfig) {
    this.config = config;
    this.model = this.initializeModel();
  }

  private initializeModel(): LanguageModel {
    const { provider, model, apiKey, gatewayApiKey, useGateway } = this.config;

    // If using gateway, configure with gateway API key
    if (useGateway && gatewayApiKey) {
      // Set gateway API key for authentication
      process.env.AI_GATEWAY_API_KEY = gatewayApiKey;

      // Use the native provider with gateway configuration
      if (provider === 'openai') {
        return openai(model || 'gpt-4o-mini');
      } else if (provider === 'anthropic') {
        return anthropic(model || 'claude-3-haiku-20240307');
      }
    }

    // Direct API usage
    if (provider === 'openai') {
      const openaiProvider = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return openaiProvider(model || 'gpt-4o-mini');
    } else if (provider === 'anthropic') {
      const anthropicProvider = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return anthropicProvider(model || 'claude-3-haiku-20240307');
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Generate text using the configured model
   */
  async generate(prompt: string, options?: any) {
    const result = await generateText({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      providerOptions: this.config.providerOptions,
      ...options,
    });

    return {
      text: result.text,
      usage: result.usage,
      provider: this.config.provider,
      isGateway: !!this.config.useGateway,
    };
  }

  /**
   * Stream text using the configured model
   */
  async *stream(prompt: string, options?: any) {
    const result = streamText({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      providerOptions: this.config.providerOptions,
      ...options,
    });

    for await (const textPart of result.textStream) {
      yield textPart;
    }
  }

  /**
   * Test the provider connection
   */
  async test(): Promise<{
    success: boolean;
    error?: string;
    response?: string;
  }> {
    try {
      const result = await this.generate('Say "OK"', { maxTokens: 5 });
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
   * Get provider information
   */
  getInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      isGateway: !!this.config.useGateway,
      hasProviderOptions: !!this.config.providerOptions,
    };
  }
}

/**
 * Factory function to create provider with fallback
 */
export async function createGatewayProvider(
  config: GatewayProviderConfig
): Promise<VercelGatewayProvider> {
  // Try gateway first if configured
  if (config.useGateway && config.gatewayApiKey) {
    const gatewayProvider = new VercelGatewayProvider({
      ...config,
      useGateway: true,
    });

    const testResult = await gatewayProvider.test();
    if (testResult.success) {
      return gatewayProvider;
    }
  }

  // Fallback to direct API
  const directProvider = new VercelGatewayProvider({
    ...config,
    useGateway: false,
  });
  return directProvider;
}

/**
 * Create provider with specific routing options
 */
export function createRoutedProvider(
  model: string,
  options?: {
    order?: string[];
    only?: string[];
    exclude?: string[];
  }
): VercelGatewayProvider {
  const [provider, modelName] = model.split('/') as [
    'openai' | 'anthropic',
    string,
  ];

  return new VercelGatewayProvider({
    provider,
    model: modelName,
    useGateway: true,
    gatewayApiKey: process.env.AI_GATEWAY_API_KEY,
    providerOptions: {
      gateway: options,
    },
  });
}

/**
 * Initialize global default provider for the application
 */
export function initializeDefaultProvider(provider: 'openai' | 'anthropic') {
  if (provider === 'openai') {
    globalThis.AI_SDK_DEFAULT_PROVIDER = openai;
  } else if (provider === 'anthropic') {
    globalThis.AI_SDK_DEFAULT_PROVIDER = anthropic;
  }
}
