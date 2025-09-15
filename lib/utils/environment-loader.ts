/**
 * Utility functions for loading and validating environment variables
 * Reduces code duplication across the application
 */

export interface EnvironmentConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  vectorStoreIds?: string[];
  langsmithConfig?: {
    apiKey?: string;
    project?: string;
    endpoint?: string;
    tracing?: string;
    tracingV2?: string;
  };
}

/**
 * Load and validate environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    // Support both plural and singular env vars and provide a sane default
    // Default requested by user: vs_6849955367a88191bf89d7660230325f
    vectorStoreIds: (() => {
      const plural = process.env.OPENAI_VECTOR_STORE_IDS;
      const singular = process.env.OPENAI_VECTORSTORE;
      const fromPlural = plural?.split(',').filter(Boolean);
      const fromSingular = singular?.split(',').filter(Boolean);
      const resolved =
        fromPlural && fromPlural.length > 0
          ? fromPlural
          : fromSingular && fromSingular.length > 0
            ? fromSingular
            : ['vs_6849955367a88191bf89d7660230325f'];
      return resolved;
    })(),
    langsmithConfig: {
      apiKey: process.env.LANGSMITH_API_KEY,
      project: process.env.LANGSMITH_PROJECT,
      endpoint: process.env.LANGSMITH_ENDPOINT,
      tracing: process.env.LANGSMITH_TRACING,
      tracingV2: process.env.LANGSMITH_TRACING_V2,
    },
  };
}

/**
 * Check if required environment variables are present
 */
export function validateEnvironmentConfig(
  config: EnvironmentConfig,
  requiredKeys: (keyof EnvironmentConfig)[]
): string | null {
  for (const key of requiredKeys) {
    const value = config[key];

    // Handle different types of required fields
    if (key === 'vectorStoreIds') {
      if (!Array.isArray(value) || value.length === 0) {
        return `Missing required environment variable for ${key}`;
      }
    } else if (key === 'langsmithConfig') {
      if (!value || typeof value !== 'object') {
        return `Missing required environment variable for ${key}`;
      }
    } else {
      // String fields
      if (!value || value === '') {
        return `Missing required environment variable for ${key}`;
      }
    }
  }
  return null;
}

/**
 * Get API key for a specific provider
 */
export function getProviderApiKey(provider: string): string | undefined {
  const config = loadEnvironmentConfig();
  const cleanProvider = provider.trim().toLowerCase();

  switch (cleanProvider) {
    case 'openai':
      return config.openaiApiKey;
    case 'anthropic':
      return config.anthropicApiKey;
    case 'google':
      return config.googleApiKey;
    default:
      return undefined;
  }
}

/**
 * Check if LangSmith is properly configured
 */
export function isLangSmithConfigured(): boolean {
  const config = loadEnvironmentConfig();
  return !!(config.langsmithConfig?.apiKey && config.langsmithConfig?.project);
}

/**
 * Get vector store configuration
 */
export function getVectorStoreConfig(): {
  vectorStoreIds: string[];
  hasVectorStores: boolean;
} {
  const config = loadEnvironmentConfig();
  const vectorStoreIds = config.vectorStoreIds || [];

  return {
    vectorStoreIds,
    hasVectorStores: vectorStoreIds.length > 0,
  };
}
