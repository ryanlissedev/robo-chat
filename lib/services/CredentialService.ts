import { getGatewayConfig } from '@/lib/openproviders/env';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import {
  getEffectiveApiKey,
  type ProviderWithoutOllama,
} from '@/lib/user-keys';
import logger from '@/lib/utils/logger';
import {
  type Provider,
  trackCredentialError,
  trackCredentialUsage,
} from '@/lib/utils/metrics';
import {
  redactSensitiveHeaders,
  sanitizeLogEntry,
} from '@/lib/utils/redaction';
import type { CredentialResult, GuestCredentials } from './types';

/**
 * Service for handling credential resolution and management
 */
export class CredentialService {
  /**
   * Extracts guest credentials from request headers
   */
  static extractGuestCredentials(headers: Headers): GuestCredentials {
    try {
      const provider =
        headers.get('x-model-provider') || headers.get('X-Model-Provider');
      const apiKey =
        headers.get('x-provider-api-key') || headers.get('X-Provider-Api-Key');
      const source =
        headers.get('x-credential-source') ||
        headers.get('X-Credential-Source');

      return {
        provider: provider?.toLowerCase() || undefined,
        apiKey: apiKey || undefined,
        source: source || undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Validate API key format for different providers
   */
  static validateApiKeyFormat(apiKey: string, provider: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    switch (provider.toLowerCase()) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'anthropic':
        return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      case 'google':
        return apiKey.length > 20; // Google keys don't have a standard prefix
      case 'groq':
        return apiKey.startsWith('gsk_') && apiKey.length > 20;
      case 'perplexity':
        return apiKey.startsWith('pplx-') && apiKey.length > 20;
      default:
        return apiKey.length > 10; // Basic length check
    }
  }

  /**
   * Mask API key for logging purposes
   */
  static maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length <= 8) {
      return '***';
    }
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }

  /**
   * Resolve credentials with precedence logic
   * 1. Vercel AI Gateway (if configured) — default path
   * 2. Authenticated user BYOK
   * 3. Guest header override (if no user key)
   * 4. Environment variable fallback (handled downstream)
   *
   * SECURITY: Never log actual API key values
   */
  static async resolveCredentials(
    user: { isAuthenticated: boolean; userId: string } | null,
    model: string,
    headers: Headers
  ): Promise<CredentialResult> {
    const provider = getProviderForModel(model);

    // Log request context without sensitive data
    const logContext = sanitizeLogEntry({
      at: 'api.chat.resolveCredentials',
      provider,
      model,
      isAuthenticated: Boolean(user?.isAuthenticated),
      hasUserId: Boolean(user?.userId),
      headers: redactSensitiveHeaders(headers),
    });
    logger.info(logContext, 'Resolving credentials');

    // 1. Gateway first (default)
    try {
      const gateway = getGatewayConfig();
      if (gateway.enabled) {
        logger.info(
          sanitizeLogEntry({
            at: 'api.chat.resolveCredentials',
            source: 'gateway',
            provider,
            model,
          }),
          'Using Vercel AI Gateway credentials'
        );
        // Track gateway usage (success recorded on finish)
        trackCredentialUsage('gateway', provider as Provider, model, {
          success: true,
        });
        return { source: 'gateway' };
      }
    } catch {
      // silently ignore gateway config errors
    }

    // 2. Authenticated user BYOK
    if (user?.isAuthenticated && user.userId && user.userId.trim() !== '') {
      try {
        const userKey = await getEffectiveApiKey(
          user.userId,
          provider as ProviderWithoutOllama
        );

        if (userKey) {
          logger.info(
            sanitizeLogEntry({
              at: 'api.chat.resolveCredentials',
              source: 'user-byok',
              provider,
              hasKey: true,
            }),
            'Using user BYOK credentials'
          );

          // Track successful credential usage
          trackCredentialUsage('user-byok', provider as Provider, model, {
            userId: user.userId,
            success: true,
          });

          return {
            apiKey: userKey,
            source: 'user-byok',
          };
        }
      } catch (error) {
        logger.info(
          sanitizeLogEntry({
            at: 'api.chat.resolveCredentials',
            error: error instanceof Error ? error.message : String(error),
            provider,
          }),
          'Failed to retrieve user BYOK credentials'
        );

        // Track credential error
        trackCredentialError(error, provider as Provider, {
          source: 'user-byok',
          userId: user.userId,
          model,
        });
      }
    }

    // 3. Guest header override (if no user key)
    const guestCredentials = CredentialService.extractGuestCredentials(headers);
    if (guestCredentials.apiKey && guestCredentials.provider === provider) {
      logger.info(
        sanitizeLogEntry({
          at: 'api.chat.resolveCredentials',
          source: 'guest-header',
          provider,
          hasKey: true,
          credentialSource: guestCredentials.source,
        }),
        'Using guest header credentials'
      );

      // Track successful guest credential usage
      trackCredentialUsage('guest-header', provider as Provider, model, {
        success: true,
      });

      return {
        apiKey: guestCredentials.apiKey,
        source: 'guest-header',
      };
    }

    // 4. No credentials found - will fallback to environment downstream
    logger.info(
      sanitizeLogEntry({
        at: 'api.chat.resolveCredentials',
        source: 'environment',
        provider,
        hasKey: false,
      }),
      'No user or guest credentials found, falling back to environment'
    );

    // Track environment fallback usage
    trackCredentialUsage('environment', provider as Provider, model, {
      success: true,
    });

    return {
      source: 'environment',
    };
  }

  /**
   * Legacy function for backward compatibility
   */
  static async getApiKey(
    req: Request,
    isAuthenticated: boolean,
    userId: string,
    resolvedModel: string
  ): Promise<string | undefined> {
    const result = await CredentialService.resolveCredentials(
      { isAuthenticated, userId },
      resolvedModel,
      req.headers
    );

    return result.apiKey;
  }

  /**
   * Track credential errors for metrics and debugging
   */
  static trackCredentialError(
    error: unknown,
    model: string,
    userId?: string
  ): void {
    const provider = getProviderForModel(model);

    trackCredentialError(error, provider as Provider, {
      source: 'user-byok',
      userId,
      model,
    });
  }
}
