import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createMistral, mistral } from '@ai-sdk/mistral';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createPerplexity, perplexity } from '@ai-sdk/perplexity';
import { createXai, xai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
// Import the actual LanguageModel type from AI SDK v5
import type { LanguageModel } from 'ai';
import { getGatewayConfig } from './env';
import { getProviderForModel } from './provider-map';
import type {
  AnthropicModel,
  GeminiModel,
  MistralModel,
  OpenAIModel,
  OpenRouterModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from './types';

// Keep options loosely typed to avoid coupling to provider signatures
export type OpenProvidersOptions = unknown;

// Gateway configuration injection helper
function injectGatewayConfig<T extends Record<string, unknown>>(
  provider: string,
  baseConfig: T
): T {
  const gateway = getGatewayConfig();
  if (!gateway.enabled) {
    return baseConfig;
  }

  // Map provider names to gateway endpoints
  const gatewayEndpoints: Record<string, string> = {
    openai: 'openai',
    anthropic: 'anthropic',
    mistral: 'mistral',
    google: 'google',
    perplexity: 'perplexity',
    xai: 'xai',
    openrouter: 'openrouter',
  };

  const endpoint = gatewayEndpoints[provider];
  if (!endpoint) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    baseURL: `${gateway.baseURL}/${endpoint}`,
    headers: {
      ...((baseConfig as any).headers || {}),
      ...gateway.headers,
    },
  } as T;
}

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

    // Configure provider options for GPT-5 models with low verbosity defaults
    const providerOptions = isGPT5Model
      ? {
          ...openaiSettings,
          openai: {
            textVerbosity: textVerbosity || verbosity || 'low', // Default to low verbosity
            reasoningSummary: reasoningSummary || 'concise', // Default to concise reasoning
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
      const openaiProvider = createOpenAI(
        injectGatewayConfig('openai', {
          apiKey,
          headers: customHeaders,
          ...providerOptions,
        })
      );
      // Use openai.responses() for GPT-5 models as recommended in the cookbook
      return isGPT5Model
        ? openaiProvider.responses(modelId as OpenAIModel)
        : openaiProvider(modelId as OpenAIModel);
    }

    // For default OpenAI provider, use environment variable
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) {
      const openaiProvider = createOpenAI(
        injectGatewayConfig('openai', {
          apiKey: envApiKey,
          headers: customHeaders,
          ...providerOptions,
        })
      );
      // Use openai.responses() for GPT-5 models as recommended in the cookbook
      return isGPT5Model
        ? openaiProvider.responses(modelId as OpenAIModel)
        : openaiProvider(modelId as OpenAIModel);
    }

    // Fallback to default provider
    const enhancedOpenAI =
      customHeaders || Object.keys(providerOptions).length > 0
        ? createOpenAI(
            injectGatewayConfig('openai', {
              headers: customHeaders,
              ...providerOptions,
            })
          )
        : openai;

    // Use openai.responses() for GPT-5 models as recommended in the cookbook
    return isGPT5Model
      ? enhancedOpenAI.responses(modelId as OpenAIModel)
      : enhancedOpenAI(modelId as OpenAIModel);
  }

  if (provider === 'mistral') {
    if (apiKey) {
      const mistralProvider = createMistral(
        injectGatewayConfig('mistral', { apiKey })
      );
      return mistralProvider(modelId as MistralModel);
    }
    return mistral(modelId as MistralModel);
  }

  if (provider === 'google') {
    if (apiKey) {
      const googleProvider = createGoogleGenerativeAI(
        injectGatewayConfig('google', { apiKey })
      );
      return googleProvider(modelId as GeminiModel);
    }
    return google(modelId as GeminiModel);
  }

  if (provider === 'perplexity') {
    if (apiKey) {
      const perplexityProvider = createPerplexity(
        injectGatewayConfig('perplexity', { apiKey })
      );
      return perplexityProvider(modelId as PerplexityModel);
    }
    return perplexity(modelId as PerplexityModel);
  }

  if (provider === 'anthropic') {
    if (apiKey) {
      const anthropicProvider = createAnthropic(
        injectGatewayConfig('anthropic', { apiKey })
      );
      return anthropicProvider(modelId as AnthropicModel);
    }
    return anthropic(modelId as AnthropicModel);
  }

  if (provider === 'xai') {
    if (apiKey) {
      const xaiProvider = createXai(injectGatewayConfig('xai', { apiKey }));
      return xaiProvider(modelId as XaiModel);
    }
    return xai(modelId as XaiModel);
  }

  if (provider === 'openrouter') {
    // OpenRouter models use the format "openrouter:provider/model"
    // Extract the actual model part after "openrouter:"
    const actualModel = modelId.startsWith('openrouter:') 
      ? modelId.slice('openrouter:'.length) 
      : modelId;
    
    if (apiKey) {
      const openrouterProvider = createOpenRouter(
        injectGatewayConfig('openrouter', { apiKey })
      );
      return openrouterProvider.chat(actualModel);
    }

    // Use environment variable
    const envApiKey = process.env.OPENROUTER_API_KEY;
    if (envApiKey) {
      const openrouterProvider = createOpenRouter(
        injectGatewayConfig('openrouter', { apiKey: envApiKey })
      );
      return openrouterProvider.chat(actualModel);
    }

    // Fallback without API key (will likely fail for actual requests)
    const openrouterProvider = createOpenRouter(
      injectGatewayConfig('openrouter', {})
    );
    return openrouterProvider.chat(actualModel);
  }

  throw new Error(`Unsupported model: ${modelId}`);
}
