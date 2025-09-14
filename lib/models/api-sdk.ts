import type { LanguageModel } from 'ai';
import type { ModelConfig } from './types';

/**
 * Thin wrapper to obtain a provider-specific LanguageModel factory from a ModelConfig.
 * This indirection keeps ChatService decoupled from model data files and avoids
 * importing provider SDKs unless actually needed at runtime.
 */
export function requireApiSdk(modelConfig: ModelConfig) {
  const factory = modelConfig.apiSdk as
    | ((apiKey?: string, opts?: unknown) => LanguageModel)
    | undefined;

  if (typeof factory !== 'function') {
    throw new Error('Selected model does not provide an apiSdk factory');
  }

  return (apiKey?: string, settings?: unknown): LanguageModel => {
    return factory(apiKey, settings);
  };
}
