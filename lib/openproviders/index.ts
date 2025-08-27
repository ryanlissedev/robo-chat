import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createMistral, mistral } from '@ai-sdk/mistral';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createPerplexity, perplexity } from '@ai-sdk/perplexity';
import { createXai, xai } from '@ai-sdk/xai';
// Import the actual LanguageModel type from AI SDK v5
import type { LanguageModel } from 'ai';
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
      textVerbosity?: 'low' | 'medium' | 'high';
      reasoningSummary?: 'auto' | 'none';
      serviceTier?: 'auto' | 'flex' | 'priority';
      headers?: Record<string, string>;
    };
    const merged = (settings ?? {}) as GPT5Extras & Record<string, unknown>;
    const {
      enableSearch: _,
      reasoningEffort,
      verbosity,
      textVerbosity,
      reasoningSummary,
      serviceTier,
      headers,
      ...rest
    } = merged;
    void _; // Mark as intentionally unused
    const openaiSettings = rest as Record<string, unknown>;

    // For GPT-5 models, use the Responses API format
    // According to the cookbook, we should use openai.responses() for GPT-5
    const isGPT5Model = modelId.startsWith('gpt-5');
    const isReasoningModel = /^(o1|o3|o4)/.test(modelId);

    // Configure provider options for GPT-5 models
    const providerOptions = isGPT5Model
      ? {
          ...openaiSettings,
          openai: {
            textVerbosity: textVerbosity || verbosity || 'medium',
            reasoningSummary: reasoningSummary || 'auto',
            serviceTier: serviceTier || 'auto',
            ...(openaiSettings.openai || {}),
          },
        }
      : openaiSettings;

    // Configure headers (for backwards compatibility)
    // - GPT-5: add reasoning/text verbosity headers
    // - OpenAI o-series reasoning models (o1/o3/o4): require beta header
    let customHeaders: Record<string, string> | undefined = headers as
      | Record<string, string>
      | undefined;

    if (isGPT5Model) {
      customHeaders = {
        ...(customHeaders || {}),
        ...(reasoningEffort ? { 'X-Reasoning-Effort': reasoningEffort } : {}),
        ...(verbosity ? { 'X-Text-Verbosity': verbosity } : {}),
      };
    }

    if (isReasoningModel) {
      customHeaders = {
        ...(customHeaders || {}),
        'OpenAI-Beta': 'reasoning=v1',
      };
    }

    if (apiKey) {
      const openaiProvider = createOpenAI({
        apiKey,
        headers: customHeaders,
        ...providerOptions,
      });
      // Use the actual GPT-5 model ID (no mapping needed in August 2025)
      return openaiProvider(modelId as OpenAIModel);
    }

    // For default OpenAI provider, use environment variable
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) {
      const openaiProvider = createOpenAI({
        apiKey: envApiKey,
        headers: customHeaders,
        ...providerOptions,
      });
      return openaiProvider(modelId as OpenAIModel);
    }

    // Fallback to default provider
    const enhancedOpenAI =
      customHeaders || Object.keys(providerOptions).length > 0
        ? createOpenAI({ headers: customHeaders, ...providerOptions })
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
