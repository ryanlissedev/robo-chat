/**
 * Utility functions for resolving API credentials
 * Reduces duplicate credential resolution logic
 */

import { getProviderApiKey } from './environment-loader';

export interface UserContext {
  isAuthenticated: boolean;
  userId?: string;
}

export interface CredentialResolution {
  apiKey: string;
  source: 'environment' | 'user' | 'default';
  provider: string;
}

/**
 * Resolve API credentials for a given model and user context
 */
export async function resolveCredentials(
  userContext: UserContext,
  modelId: string
): Promise<CredentialResolution> {
  const provider = getProviderForModel(modelId);

  // Try environment variable first
  const envApiKey = getProviderApiKey(provider);
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      source: 'environment',
      provider,
    };
  }

  // Try user-specific credentials if authenticated
  if (userContext.isAuthenticated && userContext.userId) {
    const userApiKey = await getUserApiKey(userContext.userId, provider);
    if (userApiKey) {
      return {
        apiKey: userApiKey,
        source: 'user',
        provider,
      };
    }
  }

  throw new Error(`No API key found for provider: ${provider}`);
}

/**
 * Get provider name from model ID
 */
export function getProviderForModel(modelId: string): string {
  if (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('o1-') ||
    modelId.startsWith('o3-')
  ) {
    return 'openai';
  }
  if (modelId.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gemini-')) {
    return 'google';
  }
  if (modelId.startsWith('llama-')) {
    return 'meta';
  }

  // Default to openai for unknown models
  return 'openai';
}

/**
 * Get user-specific API key from database/storage
 * This is a placeholder - implement based on your user storage system
 */
async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  // TODO: Implement user-specific API key retrieval
  // This would typically query your database or user settings
  return null;
}

/**
 * Validate API key format for different providers
 */
export function validateApiKeyFormat(
  apiKey: string,
  provider: string
): boolean {
  switch (provider.toLowerCase()) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
    case 'google':
      return apiKey.length > 20; // Google keys don't have a standard prefix
    default:
      return apiKey.length > 10; // Basic length check
  }
}

/**
 * Mask API key for logging purposes
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '***';
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

/**
 * Check if API key is available for a provider
 */
export function hasApiKeyForProvider(provider: string): boolean {
  const apiKey = getProviderApiKey(provider);
  return !!apiKey && validateApiKeyFormat(apiKey, provider);
}
