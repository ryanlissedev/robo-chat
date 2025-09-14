/**
 * AI Gateway Migration Layer
 *
 * This module provides a compatibility layer that uses AI SDK v5 openproviders()
 * internally while maintaining the existing AIGateway API for backwards compatibility.
 *
 * All new code should use openproviders() directly from lib/openproviders/index.ts
 */

import { generateText, streamText } from 'ai';
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
  client: any; // AI SDK v5 LanguageModel
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
  };
  anthropic: {
    configured: boolean;
    direct?: boolean;
  };
}

/**
 * Migration wrapper around AI SDK v5 openproviders()
 * @deprecated Use openproviders() directly
 */
// eslint-disable-next-line deprecation/deprecation
export class AIGateway {
  private readonly config: GatewayConfig;

  constructor(config: GatewayConfig = {}) {
    // Merge with environment variables for backward compatibility
    this.config = {
      mode: config.mode || (process.env.AI_GATEWAY_MODE as any) || 'auto',
      gatewayUrl: config.gatewayUrl || process.env.AI_GATEWAY_BASE_URL,
      gatewayApiKey: config.gatewayApiKey || process.env.AI_GATEWAY_API_KEY,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      ...config,
    };
  }

  /**
   * Get OpenAI client using AI SDK v5 openproviders()
   * @deprecated Use openproviders() directly
   */
  async getOpenAIClient(): Promise<ProviderClient> {
    const gateway = getGatewayConfig();
    const hasApiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;

    if (!hasApiKey && !gateway.enabled) {
      throw new Error('No OpenAI configuration available');
    }

    try {
      // Use a representative OpenAI model for the client
      const model = openproviders(
        'gpt-4o-mini' as SupportedModel,
        {},
        this.config.openaiApiKey
      );

      return {
        type: 'openai',
        client: model,
        isGateway: gateway.enabled && this.config.mode !== 'direct',
      };
    } catch (error) {
      if (this.config.mode === 'gateway') {
        throw new Error(
          `Gateway required but failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      if (this.config.mode === 'auto') {
        logger.warn('Gateway connection failed, falling back to direct API');
        // Try direct mode
        const model = openproviders(
          'gpt-4o-mini' as SupportedModel,
          { forceDirect: true },
          this.config.openaiApiKey
        );
        return {
          type: 'openai',
          client: model,
          isGateway: false,
        };
      }
      throw error;
    }
  }

  /**
   * Get Anthropic client using AI SDK v5 openproviders()
   * @deprecated Use openproviders() directly
   */
  async getAnthropicClient(): Promise<ProviderClient> {
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

      return {
        type: 'anthropic',
        client: model,
        isGateway: gateway.enabled && this.config.mode !== 'direct',
      };
    } catch (error) {
      throw new Error(`No Anthropic configuration available`);
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
        ...(options.maxTokens && { maxCompletionTokens: options.maxTokens }),
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
          ...(options.maxTokens && { maxCompletionTokens: options.maxTokens }),
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
      ...(options.maxTokens && { maxCompletionTokens: options.maxTokens }),
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
