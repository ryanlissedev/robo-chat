/**
 * AI Gateway Migration Layer
 *
 * This module provides a compatibility layer that uses AI SDK v5 openproviders()
 * internally while maintaining the existing AIGateway API for backwards compatibility.
 *
 * All new code should use openproviders() directly from lib/openproviders/index.ts
 */

import { generateText, type LanguageModel, streamText } from 'ai';
import logger from '@/lib/utils/logger';
import { openproviders } from '../openproviders';
import { getGatewayConfig } from '../openproviders/env';
import type { SupportedModel } from '../openproviders/types';

export interface GatewayConfig {
  mode?: 'direct' | 'gateway' | 'auto';
  gatewayUrl?: string;
  gatewayApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface ProviderClient {
  type: 'openai' | 'anthropic' | 'ai-sdk';
  client: LanguageModel; // AI SDK v5 LanguageModel
  isGateway: boolean;
}

export interface AISDKResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface GenerateTextOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface GatewayStatus {
  gateway: {
    configured: boolean;
    url?: string;
  };
  openai: {
    configured: boolean;
    direct?: boolean;
    gateway?: boolean;
  };
  anthropic: {
    configured: boolean;
    direct?: boolean;
    gateway?: boolean;
  };
}

export interface GatewayTestResult {
  success: boolean;
  error?: string;
}

/**
 * Migration wrapper around AI SDK v5 openproviders()
 * @deprecated Use openproviders() directly
 */
// eslint-disable-next-line deprecation/deprecation
export class AIGateway {
  private readonly config: GatewayConfig;
  private clientCache: Map<string, ProviderClient> = new Map();

  constructor(config: GatewayConfig = {}) {
    // Merge with environment variables for backward compatibility
    this.config = {
      mode:
        config.mode ||
        ((process.env.AI_GATEWAY_MODE as 'direct' | 'gateway' | 'auto' | undefined) ??
          'auto'),
      gatewayUrl: config.gatewayUrl || process.env.AI_GATEWAY_BASE_URL,
      gatewayApiKey: config.gatewayApiKey || process.env.AI_GATEWAY_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      ...config,
    };
  }

  /**
   * Test gateway connection for a specific provider
   */
  async testGatewayConnection(provider: 'openai' | 'anthropic'): Promise<GatewayTestResult> {
    const gatewayUrl = this.config.gatewayUrl;
    const gatewayApiKey = this.config.gatewayApiKey;

    // Check basic configuration
    if (!gatewayUrl) {
      return { success: false, error: 'Gateway URL not configured' };
    }

    if (!gatewayApiKey) {
      return { success: false, error: 'Gateway API key not configured' };
    }

    // Validate URL format
    try {
      new URL(gatewayUrl);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }

    // Test gateway connectivity with a lightweight request
    try {
      const testUrl = `${gatewayUrl.replace(/\/$/, '')}/${provider}/chat/completions`;

      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gatewayApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:
            provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          'max_tokens': 1,
        }),
      });

      // Accept various response codes that indicate the gateway is responding
      if (response.status === 200 || response.status === 401 || response.status === 403) {
        return { success: true };
      }

      // 404/405 typically means the gateway doesn't have the provider configured
      if (response.status === 404 || response.status === 405) {
        return { success: false, error: `Gateway does not support ${provider} provider` };
      }

      return { success: false, error: `Gateway returned status ${response.status}` };
    } catch (_error) {
      return {
        success: false,
        error: _error instanceof Error ? _error.message : 'Network error',
      };
    }
  }

  /**
   * Get OpenAI client using AI SDK v5 openproviders()
   * @deprecated Use openproviders() directly
   */
  async getOpenAIClient(): Promise<ProviderClient> {
    const cacheKey = 'openai';

    // Check cache first
    if (this.clientCache.has(cacheKey)) {
      const cached = this.clientCache.get(cacheKey);
      if (cached) return cached;
    }

    const gateway = getGatewayConfig();
    const hasApiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!hasApiKey && !gateway.enabled) {
      throw new Error('No OpenAI configuration available');
    }

    // Direct mode: always use direct API
    if (this.config.mode === 'direct') {
      const model = openproviders(
        'gpt-4o-mini' as SupportedModel,
        { forceDirect: true },
        this.config.openaiApiKey
      );
      const client = {
        type: 'openai' as const,
        client: model,
        isGateway: false,
      };
      this.clientCache.set(cacheKey, client);
      return client;
    }

    // Gateway mode: must use gateway
    if (this.config.mode === 'gateway') {
      const testResult = await this.testGatewayConnection('openai');
      if (!testResult.success) {
        throw new Error(`Gateway required but failed: ${testResult.error}`);
      }

      const model = openproviders(
        'gpt-4o-mini' as SupportedModel,
        {},
        this.config.openaiApiKey
      );
      const client = {
        type: 'openai' as const,
        client: model,
        isGateway: true,
      };
      this.clientCache.set(cacheKey, client);
      return client;
    }

    // Auto mode: try gateway first, fallback to direct
    if (gateway.enabled) {
      try {
        const testResult = await this.testGatewayConnection('openai');
        if (testResult.success) {
          const model = openproviders(
            'gpt-4o-mini' as SupportedModel,
            {},
            this.config.openaiApiKey
          );
          const client = {
            type: 'openai' as const,
            client: model,
            isGateway: true,
          };
          this.clientCache.set(cacheKey, client);
          return client;
        }
      } catch (error) {
        logger.warn(
          { err: error },
          'Gateway test failed, falling back to direct API'
        );
      }
    }

    // Fallback to direct API
    if (hasApiKey) {
      logger.warn('Using direct OpenAI API as fallback');
      const model = openproviders(
        'gpt-4o-mini' as SupportedModel,
        { forceDirect: true },
        this.config.openaiApiKey
      );
      const client = {
        type: 'openai' as const,
        client: model,
        isGateway: false,
      };
      this.clientCache.set(cacheKey, client);
      return client;
    }

    throw new Error('No OpenAI configuration available');
  }

  /**
   * Get Anthropic client using AI SDK v5 openproviders()
   * @deprecated Use openproviders() directly
   */
  async getAnthropicClient(): Promise<ProviderClient> {
    const cacheKey = 'anthropic';

    // Check cache first
    if (this.clientCache.has(cacheKey)) {
      const cached = this.clientCache.get(cacheKey);
      if (cached) return cached;
    }

    const gateway = getGatewayConfig();
    const hasApiKey =
      this.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

    if (!hasApiKey && !gateway.enabled) {
      throw new Error('No Anthropic configuration available');
    }

    try {
      // Use a representative Anthropic model for the client
      const model = openproviders(
        'claude-3-5-haiku-20241022' as SupportedModel,
        {},
        this.config.anthropicApiKey
      );

      const client = {
        type: 'anthropic' as const,
        client: model,
        isGateway: gateway.enabled && this.config.mode !== 'direct',
      };
      this.clientCache.set(cacheKey, client);
      return client;
    } catch (error) {
      throw new Error('No Anthropic configuration available');
    }
  }

  /**
   * Get gateway and provider status
   */
  async getStatus(): Promise<GatewayStatus> {
    const gateway = getGatewayConfig();

    return {
      gateway: {
        configured: gateway.enabled,
        url: gateway.baseURL || undefined,
      },
      openai: {
        configured: Boolean(
          this.config.openaiApiKey ||
            process.env.OPENAI_API_KEY ||
            gateway.enabled
        ),
        direct: Boolean(this.config.openaiApiKey || process.env.OPENAI_API_KEY),
        gateway: gateway.enabled,
      },
      anthropic: {
        configured: Boolean(
          this.config.anthropicApiKey ||
            process.env.ANTHROPIC_API_KEY ||
            gateway.enabled
        ),
        direct: Boolean(
          this.config.anthropicApiKey || process.env.ANTHROPIC_API_KEY
        ),
        gateway: gateway.enabled,
      },
    };
  }

  /**
   * Generate text using AI SDK v5 openproviders()
   * @deprecated Use generateText() with openproviders() directly
   */
  async generateText(
    prompt: string,
    modelId: string,
    options: GenerateTextOptions = {}
  ): Promise<AISDKResponse> {
    try {
      const model = openproviders(
        modelId as SupportedModel,
        {
          ...(this.config.mode === 'direct' ? { forceDirect: true } : {}),
        },
        // Try to get API key from config or environment
        this.config.openaiApiKey || this.config.anthropicApiKey
      );

      const result = await generateText({
        model,
        prompt,
        ...(options.maxTokens ? { maxCompletionTokens: options.maxTokens } : {}),
        temperature: options.temperature,
        topP: options.topP,
      });

      return {
        text: result.text,
        usage: result.usage
          ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined,
        finishReason: result.finishReason,
      };
    } catch (error) {
      if (this.config.mode === 'auto') {
        logger.warn(
          'AI SDK generation failed, attempting direct client fallback'
        );
        // Try with direct mode forced
        const model = openproviders(
          modelId as SupportedModel,
          { forceDirect: true },
          this.config.openaiApiKey || this.config.anthropicApiKey
        );

        const result = await generateText({
          model,
          prompt,
          ...(options.maxTokens ? { maxCompletionTokens: options.maxTokens } : {}),
          temperature: options.temperature,
          topP: options.topP,
        });

        return {
          text: result.text,
          usage: result.usage
            ? {
                promptTokens: result.usage.inputTokens || 0,
                completionTokens: result.usage.outputTokens || 0,
                totalTokens: result.usage.totalTokens || 0,
              }
            : undefined,
          finishReason: result.finishReason,
        };
      }
      throw error;
    }
  }

  /**
   * Stream text using AI SDK v5 openproviders()
   * @deprecated Use streamText() with openproviders() directly
   */
  async streamText(
    prompt: string,
    modelId: string,
    options: GenerateTextOptions = {}
  ) {
    const model = openproviders(
      modelId as SupportedModel,
      {
        ...(this.config.mode === 'direct' ? { forceDirect: true } : {}),
      },
      this.config.openaiApiKey || this.config.anthropicApiKey
    );

    return streamText({
      model,
      prompt,
      ...(options.maxTokens ? { maxCompletionTokens: options.maxTokens } : {}),
      temperature: options.temperature,
      topP: options.topP,
    });
  }
}

// Singleton instance
// eslint-disable-next-line deprecation/deprecation
let gatewayInstance: AIGateway | undefined;

/**
 * Get singleton AIGateway instance
 * @deprecated Use openproviders() directly
 */
// eslint-disable-next-line deprecation/deprecation
export function getAIGateway(config?: GatewayConfig): AIGateway {
  if (!gatewayInstance) {
    // eslint-disable-next-line deprecation/deprecation
    gatewayInstance = new AIGateway(config);
  }
  return gatewayInstance;
}

/**
 * Create AI provider client
 * @deprecated Use openproviders() directly
 */
export async function createAIProvider(
  provider: 'openai' | 'anthropic',
  config?: GatewayConfig
): Promise<ProviderClient> {
  // eslint-disable-next-line deprecation/deprecation
  const gateway = new AIGateway(config);

  if (provider === 'openai') {
    return gateway.getOpenAIClient();
  }
  return gateway.getAnthropicClient();
}
