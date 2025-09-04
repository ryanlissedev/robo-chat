import { FREE_MODELS_IDS, NON_AUTH_ALLOWED_MODELS } from '../config';
import { claudeModels } from './data/claude';
import { deepseekModels } from './data/deepseek';
import { geminiModels } from './data/gemini';
import { grokModels } from './data/grok';
import { mistralModels } from './data/mistral';
import { getOllamaModels, ollamaModels } from './data/ollama';
import { openaiModels } from './data/openai';
import { openrouterModels } from './data/openrouter';
import { perplexityModels } from './data/perplexity';
import type { ModelConfig } from './types';

// Static models (always available)
const STATIC_MODELS: ModelConfig[] = [
  ...openaiModels,
  ...mistralModels,
  ...deepseekModels,
  ...claudeModels,
  ...grokModels,
  ...perplexityModels,
  ...geminiModels,
  ...ollamaModels, // Static fallback Ollama models
  ...openrouterModels,
];

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// // Function to get all models including dynamically detected ones
export async function getAllModels(): Promise<ModelConfig[]> {
  const now = Date.now();

  // Use cache if it's still valid
  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return dynamicModelsCache;
  }

  try {
    // Get dynamically detected Ollama models (includes enabled check internally)
    const detectedOllamaModels = await getOllamaModels();

    // Combine static models (excluding static Ollama models) with detected ones
    const staticModelsWithoutOllama = STATIC_MODELS.filter(
      (model) => model.providerId !== 'ollama'
    );

    dynamicModelsCache = [
      ...staticModelsWithoutOllama,
      ...detectedOllamaModels,
    ];

    lastFetchTime = now;
    return dynamicModelsCache;
  } catch {
    return STATIC_MODELS;
  }
}

export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const models = await getAllModels();

  // Check which provider API keys are available
  const availableProviders = new Set<string>();

  // Add providers that have API keys configured
  if (process.env.OPENAI_API_KEY) {
    availableProviders.add('openai');
  }
  if (process.env.MISTRAL_API_KEY) {
    availableProviders.add('mistral');
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    availableProviders.add('google');
  }
  if (process.env.PERPLEXITY_API_KEY) {
    availableProviders.add('perplexity');
  }
  if (process.env.ANTHROPIC_API_KEY) {
    availableProviders.add('anthropic');
  }
  if (process.env.XAI_API_KEY) {
    availableProviders.add('xai');
  }
  if (process.env.OPENROUTER_API_KEY) {
    availableProviders.add('openrouter');
  }

  // Check if AI Gateway is configured
  const hasAIGateway = Boolean(process.env.AI_GATEWAY_API_KEY);

  // Always include ollama and free models
  const accessibleModels = models.map((model) => {
    const isAlwaysFree =
      FREE_MODELS_IDS.includes(model.id) || model.providerId === 'ollama';
    const hasProviderKey = availableProviders.has(model.providerId);
    const isInNonAuthAllowed = NON_AUTH_ALLOWED_MODELS.includes(model.id);

    // When AI Gateway is configured, all models are accessible
    const isAccessibleViaGateway = hasAIGateway;

    return {
      ...model,
      accessible:
        isAlwaysFree ||
        hasProviderKey ||
        isInNonAuthAllowed ||
        isAccessibleViaGateway,
    };
  });

  return accessibleModels;
}

export async function getModelsForProvider(
  provider: string
): Promise<ModelConfig[]> {
  const models = STATIC_MODELS;

  const providerModels = models
    .filter((model) => model.providerId === provider)
    .map((model) => ({
      ...model,
      accessible: true,
    }));

  return providerModels;
}

// Function to get models based on user's available providers
export async function getModelsForUserProviders(
  providers: string[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider))
  );

  const flatProviderModels = providerModels.flat();

  return flatProviderModels;
}

// Synchronous function to get model info for simple lookups
// This uses cached data if available, otherwise falls back to static models
export function getModelInfo(modelId: string): ModelConfig | undefined {
  // First check the cache if it exists
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.id === modelId);
  }

  // Fall back to static models for immediate lookup
  return STATIC_MODELS.find((model) => model.id === modelId);
}

// For backward compatibility - static models only
export const MODELS: ModelConfig[] = STATIC_MODELS;

// Function to refresh the models cache
export function refreshModelsCache(): void {
  dynamicModelsCache = null;
  lastFetchTime = 0;
}
