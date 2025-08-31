/**
 * Utility functions for handling temperature settings across different model types
 */

/**
 * Check if a model is a reasoning model that doesn't support temperature
 */
export function isReasoningModel(modelId: string): boolean {
  // GPT-5 models are reasoning models
  if (modelId.startsWith('gpt-5')) {
    return true;
  }

  // o1, o3, o4 series are reasoning models
  if (/^(o1|o3|o4)/.test(modelId)) {
    return true;
  }

  // Grok models with reasoning tag
  if (modelId.includes('grok') && modelId.includes('reasoning')) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate temperature for a model, or undefined if not supported
 */
export function getModelTemperature(
  modelId: string,
  requestedTemperature?: number
): number | undefined {
  // Reasoning models don't support temperature
  if (isReasoningModel(modelId)) {
    return undefined;
  }

  // Return requested temperature or undefined for other models
  return requestedTemperature;
}

/**
 * Check if a model supports temperature parameter
 */
export function supportsTemperature(modelId: string): boolean {
  return !isReasoningModel(modelId);
}

/**
 * Get optimal temperature based on task type (only for non-reasoning models)
 */
export function getOptimalTemperature(
  modelId: string,
  taskType: 'creative' | 'analytical' | 'code' | 'factual'
): number | undefined {
  if (isReasoningModel(modelId)) {
    return undefined;
  }

  const temperatures = {
    creative: 0.8,
    analytical: 0.3,
    code: 0.2,
    factual: 0.1,
  };

  return temperatures[taskType];
}
