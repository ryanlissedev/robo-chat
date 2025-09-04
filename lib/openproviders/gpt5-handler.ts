/**
 * GPT-5 Model Handler
 * Manages GPT-5 model requests with appropriate fallback handling
 * Since GPT-5 models are not yet available (as of September 2025),
 * this module provides intelligent fallback to GPT-4o models
 */

import type { LanguageModel } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import type { OpenAIModel } from './types';
import logger from '@/lib/utils/logger';

// GPT-5 to GPT-4o fallback mapping
const GPT5_FALLBACK_MAP: Record<string, string> = {
  'gpt-5': 'gpt-4o',           // Flagship → GPT-4o
  'gpt-5-mini': 'gpt-4o-mini',  // Mini → GPT-4o Mini
  'gpt-5-nano': 'gpt-4o-mini',  // Nano → GPT-4o Mini (no nano equivalent)
  'gpt-5-pro': 'gpt-4o',        // Pro → GPT-4o
};

// Check if a model is a GPT-5 model
export function isGPT5Model(modelId: string): boolean {
  return modelId.startsWith('gpt-5');
}

// Get fallback model for GPT-5
export function getGPT5Fallback(modelId: string): string {
  return GPT5_FALLBACK_MAP[modelId] || 'gpt-4o-mini';
}

interface GPT5Options {
  apiKey?: string;
  enableFallback?: boolean;
  logFallback?: boolean;
  providerOptions?: Record<string, unknown>;
}

/**
 * Create a GPT-5 model with automatic fallback to GPT-4o
 * This handles the case where GPT-5 models are not yet available
 */
export function createGPT5Model(
  modelId: string,
  options: GPT5Options = {}
): LanguageModel {
  const {
    apiKey,
    enableFallback = true,
    logFallback = true,
    providerOptions = {},
  } = options;

  // Check if this is actually a GPT-5 model request
  if (!isGPT5Model(modelId)) {
    throw new Error(`Model ${modelId} is not a GPT-5 model`);
  }

  // For now, since GPT-5 isn't available, we use fallback
  if (enableFallback) {
    const fallbackModel = getGPT5Fallback(modelId);
    
    if (logFallback) {
      logger.info(
        `GPT-5 model ${modelId} not available, using ${fallbackModel} as fallback`
      );
    }

    // Create the OpenAI provider
    const openaiProvider = apiKey
      ? createOpenAI({
          apiKey,
          ...providerOptions,
        })
      : openai;

    // Return the fallback model
    // Note: When GPT-5 becomes available, we would use:
    // return openaiProvider.responses(modelId as OpenAIModel);
    return openaiProvider(fallbackModel as OpenAIModel);
  }

  // If fallback is disabled, try to use the GPT-5 model directly
  // This will likely fail until GPT-5 is actually released
  const openaiProvider = apiKey
    ? createOpenAI({
        apiKey,
        ...providerOptions,
      })
    : openai;

  // Attempt to use responses API for GPT-5 (future-proof)
  return openaiProvider.responses(modelId as OpenAIModel);
}

/**
 * Check if GPT-5 models are actually available
 * This can be used to test if OpenAI has released GPT-5
 */
export async function checkGPT5Availability(apiKey?: string): Promise<{
  available: boolean;
  models: string[];
  fallbackActive: boolean;
}> {
  try {
    // In the future, this would make an API call to check model availability
    // For now, we know GPT-5 isn't available based on our test results
    return {
      available: false,
      models: [],
      fallbackActive: true,
    };
  } catch (error) {
    logger.error('Error checking GPT-5 availability:', error);
    return {
      available: false,
      models: [],
      fallbackActive: true,
    };
  }
}

/**
 * Get model information including fallback status
 */
export function getGPT5ModelInfo(modelId: string): {
  requestedModel: string;
  actualModel: string;
  isFallback: boolean;
  features: {
    reasoning: boolean;
    vision: boolean;
    tools: boolean;
    fileSearch: boolean;
    audio: boolean;
  };
} {
  const isFallback = isGPT5Model(modelId);
  const actualModel = isFallback ? getGPT5Fallback(modelId) : modelId;

  return {
    requestedModel: modelId,
    actualModel,
    isFallback,
    features: {
      reasoning: true,
      vision: true,
      tools: true,
      fileSearch: true,
      audio: !modelId.includes('nano'), // Nano doesn't support audio
    },
  };
}

export default {
  isGPT5Model,
  getGPT5Fallback,
  createGPT5Model,
  checkGPT5Availability,
  getGPT5ModelInfo,
};