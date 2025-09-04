import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createMistral, mistral } from '@ai-sdk/mistral';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createPerplexity, perplexity } from '@ai-sdk/perplexity';
import { createXai, xai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
// Import the actual LanguageModel type from AI SDK v5
import type { LanguageModel } from 'ai';
import { createGatewayOpenAIProvider } from './custom-openai-chat';
import { getGatewayConfig } from './env';
import { getProviderForModel } from './provider-map';
import type {
  AnthropicModel,
  GeminiModel,
  MistralModel,
  OpenAIModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from './types';

// Keep options loosely typed to avoid coupling to provider signatures
export type OpenProvidersOptions = unknown;

// Gateway configuration injection helper
function injectGatewayConfig<T extends Record<string, unknown>>(
  _provider: string,
  baseConfig: T
): T {
  const gateway = getGatewayConfig();

  // If gateway is not enabled or not configured, use direct API (BYOK)
  if (!gateway.enabled) {
    return baseConfig;
  }

  // The gateway uses a unified endpoint and the model name includes the provider
  const gatewayConfig = {
    ...baseConfig,
    baseURL: gateway.baseURL, // Use the base URL directly (https://ai-gateway.vercel.sh/v1)
    apiKey:
      gateway.headers.Authorization?.replace('Bearer ', '') ||
      baseConfig.apiKey,
    headers: {
      ...(typeof baseConfig === 'object' &&
      baseConfig &&
      'headers' in baseConfig
        ? (baseConfig.headers as Record<string, string> | undefined) || {}
        : {}),
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
      reasoningSummary?: 'auto' | 'detailed' | undefined;
      serviceTier?: 'auto' | 'flex' | 'priority';
      parallelToolCalls?: boolean;
      store?: boolean;
      previousResponseId?: string;
      forceDirect?: boolean; // force direct API (bypass gateway) for fallback
      headers?: Record<string, string>;
      vectorStoreIds?: string[];
      fileSearchOptions?: {
        maxNumResults?: number;
        // Accept latest ranker; map to current AI SDK supported value when needed
        ranker?: 'auto' | 'default-2024-11-15' | 'default-2024-08-21';
      };
    };
    const merged = (settings ?? {}) as GPT5Extras & Record<string, unknown>;
    const {
      enableSearch,
      reasoningEffort,
      verbosity,
      textVerbosity,
      reasoningSummary,
      serviceTier,
      headers,
      vectorStoreIds,
      fileSearchOptions,
      ...rest
    } = merged;
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
            // For GPT-5 and reasoning models, prefer provider-level options
            textVerbosity: textVerbosity || verbosity || 'low',
            reasoningSummary: reasoningSummary ?? 'auto',
            serviceTier: serviceTier || 'auto',
            parallelToolCalls: merged.parallelToolCalls ?? true,
            store: merged.store ?? false,
            previousResponseId: merged.previousResponseId,
            // Pass through reasoningEffort when available
            ...(reasoningEffort ? { reasoningEffort } : {}),
            ...(openaiSettings.openai || {}),
          },
        }
      : // Non-GPT5 OpenAI models still accept providerOptions.openai
        // (AI SDK forwards these to the provider);
        // include reasoningEffort if set
        ({
          ...openaiSettings,
          ...(reasoningEffort
            ? { openai: { reasoningEffort, ...(openaiSettings.openai || {}) } }
            : {}),
        } as Record<string, unknown>);

    // Configure file search tools if enabled
    const _tools =
      enableSearch && vectorStoreIds && vectorStoreIds.length > 0
        ? {
            file_search: openai.tools.fileSearch({
              vectorStoreIds,
              maxNumResults: fileSearchOptions?.maxNumResults || 10,
              ...(fileSearchOptions?.ranker
                ? {
                    ranking: {
                      // Map new default to currently supported constant until AI SDK updates
                      ranker: ((fileSearchOptions.ranker ===
                        'default-2024-11-15'
                        ? 'default-2024-08-21'
                        : fileSearchOptions.ranker) || 'auto') as
                        | 'auto'
                        | 'default-2024-08-21',
                    },
                  }
                : {}),
            }),
          }
        : undefined;

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
      // GPT-5 models have compatibility issues with the gateway in AI SDK v5.
      // Allow opt-in via ALLOW_GPT5_GATEWAY=true to attempt gateway first with fallback.
      const allowGpt5Gateway = process.env.ALLOW_GPT5_GATEWAY === 'true';
      const forceDirect = merged.forceDirect === true;
      const shouldUseGateway =
        gateway.enabled && (!isGPT5Model || allowGpt5Gateway) && !forceDirect;

      if (shouldUseGateway) {
        // When using gateway, use custom provider that forces chat completions API
        const gatewayProvider = createGatewayOpenAIProvider({
          apiKey,
          baseURL: gateway.baseURL || undefined,
          headers: {
            ...customHeaders,
            Authorization: `Bearer ${gateway.headers.Authorization?.replace('Bearer ', '') || apiKey}`,
          },
          ...providerOptions,
        });
        return gatewayProvider(effectiveModelId as OpenAIModel);
      } else {
        // Direct API: use standard provider with responses API for GPT-5
        if (isGPT5Model && gateway.enabled) {
        }
        const openaiProvider = createOpenAI({
          apiKey,
          headers: customHeaders,
          ...providerOptions,
        });
        // For direct API, use the original modelId without provider prefix
        const directModelId = modelId;

        // For GPT-5 models, use responses API
        if (isGPT5Model) {
          return openaiProvider.responses(directModelId as OpenAIModel);
        }
        return openaiProvider(directModelId as OpenAIModel);
      }
    }

    // For default OpenAI provider, use environment variable
    const envApiKey = process.env.OPENAI_API_KEY;
    if (envApiKey) {
      // Allow opt-in to route GPT-5 via Gateway if the project supports /v1/responses
      const allowGpt5Gateway = process.env.ALLOW_GPT5_GATEWAY === 'true';
      const shouldUseGateway = gateway.enabled && (!isGPT5Model || allowGpt5Gateway);

      if (shouldUseGateway) {
        // When using gateway, use custom provider that forces chat completions API
        const gatewayProvider = createGatewayOpenAIProvider({
          apiKey: envApiKey,
          baseURL: gateway.baseURL || undefined,
          headers: {
            ...customHeaders,
            Authorization: `Bearer ${gateway.headers.Authorization?.replace('Bearer ', '') || envApiKey}`,
          },
          ...providerOptions,
        });
        return gatewayProvider(effectiveModelId as OpenAIModel);
      } else {
        // Direct API: use standard provider with responses API for GPT-5
        const openaiProvider = createOpenAI({
          apiKey: envApiKey,
          headers: customHeaders,
          ...providerOptions,
        });
        // For direct API, use the original modelId without provider prefix
        const directModelId = modelId;
        return isGPT5Model
          ? openaiProvider.responses(directModelId as OpenAIModel)
          : openaiProvider(directModelId as OpenAIModel);
      }
    }
    if (gateway.enabled) {
      // When using gateway, use custom provider that forces chat completions API
      const gatewayProvider = createGatewayOpenAIProvider({
        baseURL: gateway.baseURL || undefined,
        headers: {
          ...customHeaders,
          Authorization: gateway.headers.Authorization || 'Bearer fallback-key',
        },
        ...providerOptions,
      });
      return gatewayProvider(effectiveModelId as OpenAIModel);
    } else {
      // Direct API: create explicit provider to avoid responses API default for non-GPT5
      const enhancedOpenAI =
        customHeaders || Object.keys(providerOptions).length > 0
          ? createOpenAI({
              headers: customHeaders,
              ...providerOptions,
            })
          : createOpenAI({});

      // For direct API, use openai.responses() for GPT-5 models as recommended in the cookbook
      // Use the original modelId without provider prefix for direct API
      const directModelId = modelId;
      return isGPT5Model
        ? enhancedOpenAI.responses(directModelId as OpenAIModel)
        : enhancedOpenAI(directModelId as OpenAIModel);
    }
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
