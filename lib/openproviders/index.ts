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
  
  // If gateway is not enabled or not configured, use direct API (BYOK)
  if (!gateway.enabled) {
    console.log(`[Gateway] Not enabled, using direct ${provider} API`);
    return baseConfig;
  }

  // For Vercel AI Gateway, we use the unified endpoint
  // The gateway API key replaces the provider API key
  console.log(`[Gateway] Using Vercel AI Gateway for ${provider}`);
  
  // The gateway uses a unified endpoint and the model name includes the provider
  const gatewayConfig = {
    ...baseConfig,
    baseURL: gateway.baseURL, // Use the base URL directly (https://ai-gateway.vercel.sh/v1)
    apiKey: gateway.headers['Authorization']?.replace('Bearer ', '') || baseConfig.apiKey,
    headers: {
      ...((baseConfig as any).headers || {}),
      // Don't include gateway headers here, the SDK will add Authorization automatically
    },
  } as T;
  
  return gatewayConfig;
}

export function openproviders<T extends SupportedModel>(
  modelId: T,
  settings?: OpenProvidersOptions,
  apiKey?: string
): LanguageModel {
  const provider = getProviderForModel(modelId);
  const gateway = getGatewayConfig();
  
  // When using gateway, prefix model with provider name
  const effectiveModelId = gateway.enabled ? `${provider}/${modelId}` : modelId;

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
      // When using gateway, always use standard API (gateway doesn't support /responses endpoint)
      // For direct API, use openai.responses() for GPT-5 models as recommended in the cookbook
      return isGPT5Model && !gateway.enabled
        ? openaiProvider.responses(effectiveModelId as OpenAIModel)
        : openaiProvider(effectiveModelId as OpenAIModel);
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
      // When using gateway, always use standard API (gateway doesn't support /responses endpoint)
      // For direct API, use openai.responses() for GPT-5 models as recommended in the cookbook
      return isGPT5Model && !gateway.enabled
        ? openaiProvider.responses(effectiveModelId as OpenAIModel)
        : openaiProvider(effectiveModelId as OpenAIModel);
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

    // When using gateway, always use standard API (gateway doesn't support /responses endpoint)
    // For direct API, use openai.responses() for GPT-5 models as recommended in the cookbook
    return isGPT5Model && !gateway.enabled
      ? enhancedOpenAI.responses(effectiveModelId as OpenAIModel)
      : enhancedOpenAI(effectiveModelId as OpenAIModel);
  }

  if (provider === 'mistral') {
    if (apiKey) {
      const mistralProvider = createMistral(
        injectGatewayConfig('mistral', { apiKey })
      );
      return mistralProvider(effectiveModelId as MistralModel);
    }
    return mistral(effectiveModelId as MistralModel);
  }

  if (provider === 'google') {
    if (apiKey) {
      const googleProvider = createGoogleGenerativeAI(
        injectGatewayConfig('google', { apiKey })
      );
      return googleProvider(effectiveModelId as GeminiModel);
    }
    return google(effectiveModelId as GeminiModel);
  }

  if (provider === 'perplexity') {
    if (apiKey) {
      const perplexityProvider = createPerplexity(
        injectGatewayConfig('perplexity', { apiKey })
      );
      return perplexityProvider(effectiveModelId as PerplexityModel);
    }
    return perplexity(effectiveModelId as PerplexityModel);
  }

  if (provider === 'anthropic') {
    if (apiKey) {
      const anthropicProvider = createAnthropic(
        injectGatewayConfig('anthropic', { apiKey })
      );
      return anthropicProvider(effectiveModelId as AnthropicModel);
    }
    return anthropic(effectiveModelId as AnthropicModel);
  }

  if (provider === 'xai') {
    if (apiKey) {
      const xaiProvider = createXai(injectGatewayConfig('xai', { apiKey }));
      return xaiProvider(effectiveModelId as XaiModel);
    }
    return xai(effectiveModelId as XaiModel);
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
