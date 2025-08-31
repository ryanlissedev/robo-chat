/**
 * Custom OpenAI provider that explicitly uses the chat completions API instead of responses API
 * This is needed because gateways don't support the responses API
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { OpenAIModel } from './types';

export interface ChatCompletionsConfig {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  organization?: string;
  project?: string;
}

/**
 * Creates a custom OpenAI provider that forces chat completions API usage
 * This uses the .chat() method which explicitly uses chat completions instead of responses API
 */
export function createOpenAIChatCompletions(config: ChatCompletionsConfig) {
  // Create the OpenAI provider instance
  const provider = createOpenAI({
    ...config,
    // Ensure baseURL doesn't end with /responses (for gateway compatibility)
    baseURL:
      config.baseURL?.replace(/\/responses$/, '') ||
      'https://api.openai.com/v1',
  });

  return (modelId: OpenAIModel): LanguageModel => {
    // Use the .chat() method which explicitly uses chat completions API
    return provider.chat(modelId);
  };
}

/**
 * Creates a chat completions provider specifically for gateway usage
 * This ensures compatibility with Vercel AI Gateway
 */
export function createGatewayOpenAIProvider(config: ChatCompletionsConfig) {
  return createOpenAIChatCompletions({
    ...config,
    // Gateway URLs should point to the base gateway URL
    baseURL: config.baseURL || 'https://ai-gateway.vercel.sh/v1',
  });
}
