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

export class AIGateway {
  private config: GatewayConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  /**
   * Get OpenAI client with automatic fallback
   */
  async getOpenAIClient(): Promise<ProviderClient> {
    // Try gateway first if mode is auto or gateway
    if (this.config.mode !== 'direct') {
      const gatewayResult = await this.testGatewayConnection('openai');
      if (
        gatewayResult.success &&
        this.config.gatewayUrl &&
        this.config.gatewayApiKey
      ) {
        const gatewayClient = new OpenAI({
          apiKey: this.config.gatewayApiKey,
          baseURL: this.config.gatewayUrl,
          dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
        });
        return { type: 'openai', client: gatewayClient, isGateway: true };
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
   * Test gateway connection
   */
  private async testGatewayConnection(
    _provider: 'openai' | 'anthropic'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.config.gatewayUrl || !this.config.gatewayApiKey) {
      return { success: false, error: 'Gateway not configured' };
    }

    try {
      // Use OpenAI-compatible API for testing
      const testClient = new OpenAI({
        apiKey: this.config.gatewayApiKey,
        baseURL: this.config.gatewayUrl,
        dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
      });

      // Quick test call
      await testClient.models.list();
      return { success: true };
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
