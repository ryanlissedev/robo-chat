import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createMistral, mistral } from '@ai-sdk/mistral';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createPerplexity, perplexity } from '@ai-sdk/perplexity';

// Align to AI SDK v5 naming used across the project
// Use unknown to tolerate provider SDK return types across versions
type LanguageModel = unknown;

import { createXai, xai } from '@ai-sdk/xai';
import { getProviderForModel } from './provider-map';
import type {
  AnthropicModel,
  GeminiModel,
  MistralModel,
  OllamaModel,
  OpenAIModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from './types';

// Keep options loosely typed to avoid coupling to provider signatures  
export type OpenProvidersOptions = unknown;

// Get Ollama base URL from environment or use default
const getOllamaBaseURL = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use localhost
    return 'http://localhost:11434/v1';
  }

  // Server-side: check environment variables
  return (
    `${process.env.OLLAMA_BASE_URL?.replace(/\/+$/, '')}/v1` ||
    'http://localhost:11434/v1'
  );
};

// Create Ollama provider instance with configurable baseURL
const createOllamaProvider = () => {
  return createOpenAI({
    baseURL: getOllamaBaseURL(),
    apiKey: 'ollama', // Ollama doesn't require a real API key
    name: 'ollama',
  });
};

export function openproviders<T extends SupportedModel>(
  modelId: T,
  settings?: OpenProvidersOptions,
  apiKey?: string
): LanguageModel {
  const provider = getProviderForModel(modelId);

  if (provider === 'openai') {
    type GPT5Extras = {
      enableSearch?: boolean;
      reasoningEffort?: 'low' | 'medium' | 'high';
      verbosity?: 'low' | 'medium' | 'high';
      headers?: Record<string, string>;
    };
    const merged = (settings ?? {}) as GPT5Extras &
      Record<string, unknown>;
    const {
      enableSearch: _,
      reasoningEffort,
      verbosity,
      headers,
      ...rest
    } = merged;
    void _; // Mark as intentionally unused
    const openaiSettings = rest as Record<string, unknown>;

    // Configure headers for GPT-5 extras (reasoning + verbosity)
    const customHeaders = modelId.startsWith('gpt-5')
      ? {
          ...headers,
          ...(reasoningEffort ? { 'X-Reasoning-Effort': reasoningEffort } : {}),
          ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
        }
      : headers;

    if (apiKey) {
      const openaiProvider = createOpenAI({
        apiKey,
        headers: customHeaders,
        ...openaiSettings,
      });
      return openaiProvider(modelId as OpenAIModel);
    }

    // For default OpenAI provider, we need to pass headers through provider configuration
    const enhancedOpenAI = customHeaders
      ? createOpenAI({ headers: customHeaders, ...openaiSettings })
      : openai;

    return enhancedOpenAI(modelId as OpenAIModel);
  }

  if (provider === 'mistral') {
    if (apiKey) {
      const mistralProvider = createMistral({ apiKey });
      return mistralProvider(modelId as MistralModel);
    }
    return mistral(modelId as MistralModel);
  }

  if (provider === 'google') {
    if (apiKey) {
      const googleProvider = createGoogleGenerativeAI({ apiKey });
      return googleProvider(modelId as GeminiModel);
    }
    return google(modelId as GeminiModel);
  }

  if (provider === 'perplexity') {
    if (apiKey) {
      const perplexityProvider = createPerplexity({ apiKey });
      return perplexityProvider(modelId as PerplexityModel);
    }
    return perplexity(modelId as PerplexityModel);
  }

  if (provider === 'anthropic') {
    if (apiKey) {
      const anthropicProvider = createAnthropic({ apiKey });
      return anthropicProvider(modelId as AnthropicModel);
    }
    return anthropic(modelId as AnthropicModel);
  }

  if (provider === 'xai') {
    if (apiKey) {
      const xaiProvider = createXai({ apiKey });
      return xaiProvider(modelId as XaiModel);
    }
    return xai(modelId as XaiModel);
  }

  if (provider === 'ollama') {
    const ollamaProvider = createOllamaProvider();
    return ollamaProvider(modelId as OllamaModel);
  }

  throw new Error(`Unsupported model: ${modelId}`);
}
