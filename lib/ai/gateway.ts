/**
 * AI Gateway Configuration and Fallback Logic
 *
 * This implementation uses the Vercel AI SDK which automatically routes
 * through the AI Gateway when model strings are specified (e.g., 'openai/gpt-4o-mini')
 * and falls back to direct API calls when needed.
 */

import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { generateText, streamText } from 'ai';

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

export class AIGateway {
  private config: GatewayConfig;
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private gatewayClient?: OpenAI;
  
  constructor(config?: Partial<GatewayConfig>) {
    this.config = {
      mode: config?.mode || process.env.AI_GATEWAY_MODE as any || 'auto',
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
    // Try gateway first if configured
    if (this.config.mode !== 'direct' && this.config.gatewayUrl && this.config.gatewayApiKey) {
      try {
        if (!this.gatewayClient) {
          // Test gateway connection
          const testResponse = await this.testGatewayConnection('openai');
          if (testResponse.success) {
            this.gatewayClient = new OpenAI({
              apiKey: this.config.gatewayApiKey,
              baseURL: this.config.gatewayUrl, // Use OpenAI-compatible API directly
              dangerouslyAllowBrowser: process.env.NODE_ENV === 'test',
            });
            return { type: 'openai', client: this.gatewayClient, isGateway: true };
          }
        } else {
          return { type: 'openai', client: this.gatewayClient, isGateway: true };
        }
      } catch (error) {
        console.warn('Gateway connection failed, falling back to direct API:', error instanceof Error ? error.message : String(error));
      }
    }

    // Fall back to direct API
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

    return { type: 'anthropic', client: this.anthropicClient, isGateway: false };
  }

  /**
   * Test gateway connection
   */
  private async testGatewayConnection(provider: 'openai' | 'anthropic'): Promise<{ success: boolean; error?: string }> {
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

      // Test with a simple models list request
      await testClient.models.list();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Test AI SDK Gateway (Recommended Approach)
   * Uses the AI SDK which automatically routes through Vercel AI Gateway
   */
  async testAISDKGateway(prompt: string = 'Say "Hello from AI Gateway"'): Promise<AISDKResponse> {
    if (!this.config.gatewayApiKey) {
      throw new Error('AI_GATEWAY_API_KEY is required for AI SDK Gateway');
    }

    try {
      // Use AI SDK with model string - this automatically routes through the gateway
      const result = await generateText({
        model: 'openai/gpt-4o-mini', // This format triggers gateway routing
        prompt,
        maxRetries: 1,
      });

      return {
        text: result.text,
        usage: result.usage ? {
          promptTokens: result.usage.inputTokens || 0,
          completionTokens: result.usage.outputTokens || 0,
          totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
        } : undefined,
        finishReason: result.finishReason,
      };
    } catch (error) {
      throw new Error(`AI SDK Gateway test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get OpenAI client with AI SDK Gateway support
   */
  async getAISDKClient(): Promise<ProviderClient> {
    if (this.config.gatewayApiKey) {
      // AI SDK automatically uses gateway when AI_GATEWAY_API_KEY is set
      return { type: 'ai-sdk', client: 'ai-sdk', isGateway: true };
    }

    // Fall back to direct OpenAI client
    return this.getOpenAIClient();
  }

  /**
   * Get provider status
   */
  async getStatus() {
    const status = {
      openai: {
        direct: false,
        gateway: false,
        configured: false,
      },
      anthropic: {
        direct: false,
        gateway: false,
        configured: false,
      },
      aiSDK: {
        gateway: false,
        configured: false,
      },
      gateway: {
        url: this.config.gatewayUrl,
        configured: !!(this.config.gatewayUrl && this.config.gatewayApiKey),
        aiSDKConfigured: !!this.config.gatewayApiKey,
      },
    };

    // Check OpenAI
    if (this.config.openaiApiKey) {
      status.openai.configured = true;
      try {
        const client = await this.getOpenAIClient();
        if (client.isGateway) {
          status.openai.gateway = true;
        } else {
          status.openai.direct = true;
        }
      } catch (error) {
        // Configuration exists but not working
      }
    }

    // Check Anthropic
    if (this.config.anthropicApiKey) {
      status.anthropic.configured = true;
      status.anthropic.direct = true; // Direct only for now
    }

    // Check AI SDK Gateway
    if (this.config.gatewayApiKey) {
      status.aiSDK.configured = true;
      try {
        // Test AI SDK gateway
        await this.testAISDKGateway('test');
        status.aiSDK.gateway = true;
      } catch (error) {
        // AI SDK gateway not working, but configured
      }
    }

    return status;
  }
}

// Singleton instance
let gatewayInstance: AIGateway;

export function getAIGateway(config?: Partial<GatewayConfig>): AIGateway {
  if (!gatewayInstance) {
    gatewayInstance = new AIGateway(config);
  }
  return gatewayInstance;
}

// Helper function to create provider with fallback
export async function createAIProvider(provider: 'openai' | 'anthropic', config?: Partial<GatewayConfig>) {
  const gateway = getAIGateway(config);
  
  if (provider === 'openai') {
    return await gateway.getOpenAIClient();
  } else {
    return await gateway.getAnthropicClient();
  }
}