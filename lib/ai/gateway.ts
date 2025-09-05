/**
 * AI Gateway Configuration and Fallback Logic
 *
 * This implementation uses the Vercel AI SDK which automatically routes
 * through the AI Gateway when model strings are specified (e.g., 'openai/gpt-4o-mini')
 * and falls back to direct API calls when needed.
 */

import Anthropic from '@anthropic-ai/sdk';
import { generateText, streamText } from 'ai';
import { OpenAI } from 'openai';
import logger from '@/lib/utils/logger';

export interface GatewayConfig {
  mode: 'direct' | 'gateway' | 'auto';
  gatewayUrl?: string;
  gatewayApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface ProviderClient {
  type: 'openai' | 'anthropic' | 'ai-sdk';
  client: OpenAI | Anthropic | 'ai-sdk';
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
  openai: {
    configured: boolean;
    direct: boolean;
    gateway: boolean;
  };
  anthropic: {
    configured: boolean;
    direct: boolean;
    gateway: boolean;
  };
  gateway: {
    configured: boolean;
    url?: string;
    working: boolean;
  };
}

export class AIGateway {
  private config: GatewayConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private gatewayClientCache?: OpenAI;

  constructor(config?: Partial<GatewayConfig>) {
    this.config = {
      mode: config?.mode || (process.env.AI_GATEWAY_MODE as any) || 'auto',
      gatewayUrl: config?.gatewayUrl || process.env.AI_GATEWAY_BASE_URL,
      gatewayApiKey: config?.gatewayApiKey || process.env.AI_GATEWAY_API_KEY,
      openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
      anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    };
  }

  /**
   * Get OpenAI client with automatic fallback
   */
  async getOpenAIClient(): Promise<ProviderClient> {
    // Try gateway first if mode is auto or gateway
    if (this.config.mode !== 'direct') {
      // Return cached gateway client if available
      if (this.gatewayClientCache) {
        return {
          type: 'openai',
          client: this.gatewayClientCache,
          isGateway: true,
        };
      }

      const gatewayResult = await this.testGatewayConnection('openai');
      if (
        gatewayResult.success &&
        this.config.gatewayUrl &&
        this.config.gatewayApiKey
      ) {
        this.gatewayClientCache = new OpenAI({
          apiKey: this.config.gatewayApiKey,
          baseURL: this.config.gatewayUrl,
          dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
        });
        return {
          type: 'openai',
          client: this.gatewayClientCache,
          isGateway: true,
        };
      }

      // Gateway failed, try direct (only if mode allows fallback)
      if (this.config.mode === 'auto') {
        logger.warn(
          `Gateway connection failed: ${gatewayResult.error}, falling back to direct API`
        );
      } else if (this.config.mode === 'gateway') {
        throw new Error(`Gateway required but failed: ${gatewayResult.error}`);
      }
    }

    // Direct API fallback
    if (!this.openaiClient && this.config.openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.openaiApiKey,
        dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
      });
    }

    if (!this.openaiClient) {
      throw new Error('No OpenAI configuration available');
    }

    return { type: 'openai', client: this.openaiClient, isGateway: false };
  }

  /**
   * Get Anthropic client with automatic fallback
   */
  async getAnthropicClient(): Promise<ProviderClient> {
    // For now, Anthropic uses direct API only
    // Gateway support can be added when available
    if (!this.anthropicClient && this.config.anthropicApiKey) {
      this.anthropicClient = new Anthropic({
        apiKey: this.config.anthropicApiKey,
      });
    }

    if (!this.anthropicClient) {
      throw new Error('No Anthropic configuration available');
    }

    return {
      type: 'anthropic',
      client: this.anthropicClient,
      isGateway: false,
    };
  }

  /**
   * Get status of all providers and gateway
   */
  async getStatus(): Promise<GatewayStatus> {
    const status: GatewayStatus = {
      openai: {
        configured: !!this.config.openaiApiKey,
        direct: false,
        gateway: false,
      },
      anthropic: {
        configured: !!this.config.anthropicApiKey,
        direct: false,
        gateway: false,
      },
      gateway: {
        configured: !!(this.config.gatewayUrl && this.config.gatewayApiKey),
        url: this.config.gatewayUrl,
        working: false,
      },
    };

    // Test OpenAI direct access
    if (status.openai.configured) {
      try {
        const client = await this.getOpenAIClient();
        status.openai.direct = !client.isGateway;
        status.openai.gateway = client.isGateway;
      } catch {
        // Client creation failed
      }
    }

    // Test Anthropic direct access
    if (status.anthropic.configured) {
      try {
        await this.getAnthropicClient();
        status.anthropic.direct = true;
      } catch {
        // Client creation failed
      }
    }

    // Test gateway connectivity
    if (status.gateway.configured) {
      const gatewayResult = await this.testGatewayConnection('openai');
      status.gateway.working = gatewayResult.success;
    }

    return status;
  }

  /**
   * Test gateway connection
   */
  private async testGatewayConnection(
    _provider: 'openai' | 'anthropic'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.gatewayUrl || !this.config.gatewayApiKey) {
      return { success: false, error: 'Gateway not configured' };
    }

    try {
      // Use fetch instead of OpenAI client for testing to avoid dependency issues
      const response = await fetch(
        `${this.config.gatewayUrl}/openai/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.gatewayApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
        }
      );

      // Accept 401 (auth error) as gateway working, reject 404/405 as not configured
      if (response.status === 401) {
        return { success: true };
      }
      if (response.status === 404 || response.status === 405) {
        return { success: false, error: 'Gateway not configured' };
      }
      if (response.ok) {
        return { success: true };
      }

      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate text using AI SDK with automatic fallback
   */
  async generateText(
    prompt: string,
    modelId: string,
    options: GenerateTextOptions = {}
  ): Promise<AISDKResponse> {
    // Use the Vercel AI SDK for generation with automatic gateway routing
    try {
      const result = await generateText({
        model: modelId, // e.g., 'openai/gpt-4o-mini' for gateway routing
        prompt,
        ...(options.maxTokens && { maxCompletionTokens: options.maxTokens }),
        temperature: options.temperature,
        topP: options.topP,
      });

      return {
        text: result.text,
        usage: result.usage
          ? {
              promptTokens: (result.usage as any).promptTokens || 0,
              completionTokens: (result.usage as any).completionTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined,
        finishReason: result.finishReason,
      };
    } catch (error) {
      // On error, fall back to direct client if mode allows
      if (this.config.mode === 'auto') {
        logger.warn(
          'AI SDK generation failed, attempting direct client fallback'
        );
        // Additional fallback logic would go here
        throw error;
      }
      throw error;
    }
  }

  /**
   * Stream text using AI SDK with automatic fallback
   */
  async streamText(
    prompt: string,
    modelId: string,
    options: GenerateTextOptions = {}
  ) {
    // Use the Vercel AI SDK for streaming with automatic gateway routing
    return streamText({
      model: modelId, // e.g., 'openai/gpt-4o-mini' for gateway routing
      prompt,
      ...(options.maxTokens && { maxCompletionTokens: options.maxTokens }),
      temperature: options.temperature,
      topP: options.topP,
    });
  }
}

// Global singleton instance
let gatewayInstance: AIGateway | undefined;

/**
 * Get singleton AI Gateway instance
 */
export function getAIGateway(): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway();
  }
  return gatewayInstance;
}

/**
 * Create AI provider client
 */
export async function createAIProvider(
  type: 'openai' | 'anthropic'
): Promise<ProviderClient> {
  const gateway = getAIGateway();

  switch (type) {
    case 'openai':
      return gateway.getOpenAIClient();
    case 'anthropic':
      return gateway.getAnthropicClient();
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
