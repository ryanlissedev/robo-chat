export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY ?? '',
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '',
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY ?? '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
  XAI_API_KEY: process.env.XAI_API_KEY ?? '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? '',
  // Support both AI_GATEWAY_API_KEY and VERCEL_AI_GATEWAY_API_KEY for compatibility
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_GATEWAY_API_KEY ?? '',
  AI_GATEWAY_BASE_URL:
    process.env.AI_GATEWAY_BASE_URL ?? 'https://ai-gateway.vercel.sh/v1',
};

export function createEnvWithUserKeys(
  userKeys: Record<string, string> = {}
): typeof env {
  return {
    OPENAI_API_KEY: userKeys.openai || env.OPENAI_API_KEY,
    MISTRAL_API_KEY: userKeys.mistral || env.MISTRAL_API_KEY,
    PERPLEXITY_API_KEY: userKeys.perplexity || env.PERPLEXITY_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY:
      userKeys.google || env.GOOGLE_GENERATIVE_AI_API_KEY,
    ANTHROPIC_API_KEY: userKeys.anthropic || env.ANTHROPIC_API_KEY,
    XAI_API_KEY: userKeys.xai || env.XAI_API_KEY,
    OPENROUTER_API_KEY: userKeys.openrouter || env.OPENROUTER_API_KEY,
    AI_GATEWAY_API_KEY: userKeys.ai_gateway || env.AI_GATEWAY_API_KEY,
    AI_GATEWAY_BASE_URL: env.AI_GATEWAY_BASE_URL,
  };
}

export function getGatewayConfig(): {
  enabled: boolean;
  baseURL: string | null;
  headers: Record<string, string>;
} {
  // Read dynamic env for testability and runtime overrides
  // Support both AI_GATEWAY_API_KEY and VERCEL_AI_GATEWAY_API_KEY
  const key = process.env.AI_GATEWAY_API_KEY || 
              process.env.VERCEL_AI_GATEWAY_API_KEY || 
              env.AI_GATEWAY_API_KEY;
  const enabled = !!key;
  return {
    enabled,
    baseURL: enabled
      ? process.env.AI_GATEWAY_BASE_URL || env.AI_GATEWAY_BASE_URL
      : null,
    headers: enabled ? { Authorization: `Bearer ${key}` } : {},
  };
}
