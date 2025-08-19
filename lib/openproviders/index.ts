import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI, google } from '@ai-sdk/google';
import { createGroq, groq } from '@ai-sdk/groq';
// import { createMistral, mistral } from '@ai-sdk/mistral';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { createPerplexity, perplexity } from '@ai-sdk/perplexity';
// AI SDK v5 provider types
import { createXai, xai } from '@ai-sdk/xai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getProviderForModel } from './provider-map';
import type {
  AnthropicModel,
  GeminiModel,
  GroqModel,
  OllamaModel,
  OpenAIModel,
  PerplexityModel,
  SupportedModel,
  XaiModel,
} from './types';

// AI SDK v5 provider settings - simplified to avoid parameter extraction issues
type OpenAIChatSettings = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  headers?: Record<string, string>;
  enableSearch?: boolean;
};

type ProviderSettings = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  headers?: Record<string, string>;
  enableSearch?: boolean;
};

type ModelSettings<T extends SupportedModel> = T extends OpenAIModel
  ? OpenAIChatSettings
  : ProviderSettings;

export type OpenProvidersOptions<T extends SupportedModel> = ModelSettings<T>;

// Get Ollama base URL from environment or use default
const getOllamaBaseURL = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use localhost
    return 'http://localhost:11434/v1';
  }

  // Server-side: check environment variables
  const base = process.env.OLLAMA_BASE_URL?.replace(/\/+$/, '');
  return base ? `${base}/v1` : 'http://localhost:11434/v1';
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
  settings?: OpenProvidersOptions<T>,
  apiKey?: string
): LanguageModel | LanguageModelV2 {
  const provider = getProviderForModel(modelId);

  if (provider === 'openai') {
    // AI SDK v5 compatible approach using .chat() method for chat models
    if (apiKey) {
      const openaiProvider = createOpenAI({ apiKey });
      return openaiProvider.chat(modelId as OpenAIModel);
    }
    
    // Use default OpenAI provider with .chat() method for environment API key  
    return openai.chat(modelId as OpenAIModel);
  }

  // if (provider === 'mistral') {
  //   if (apiKey) {
  //     const mistralProvider = createMistral({ apiKey });
  //     return mistralProvider(modelId as MistralModel);
  //   }
  //   return mistral(modelId as MistralModel);
  // }

  if (provider === 'groq') {
    if (apiKey) {
      const groqProvider = createGroq({ apiKey });
      return groqProvider(modelId as GroqModel);
    }
    return groq(modelId as GroqModel);
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
      return perplexityProvider(
        modelId as PerplexityModel
        // settings as PerplexityProviderSettings
      );
    }
    return perplexity(
      modelId as PerplexityModel
      // settings as PerplexityProviderSettings
    );
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

  if (provider === 'openrouter') {
    const openRouterProvider = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY || '',
    });
    // Map DeepSeek model IDs to OpenRouter format
    let openRouterModelId = modelId as string;
    if (modelId === 'deepseek-r1') {
      openRouterModelId = 'deepseek/deepseek-r1:free';
    } else if (modelId === 'deepseek-v3') {
      openRouterModelId = 'deepseek/deepseek-v3';
    }
    return openRouterProvider.chat(openRouterModelId);
  }

  if (provider === 'ollama') {
    const ollamaProvider = createOllamaProvider();
    return ollamaProvider(modelId as OllamaModel);
  }

  throw new Error(`Unsupported model: ${modelId}`);
}
