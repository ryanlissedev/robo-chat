import { getEffectiveApiKey } from '@/lib/user-keys';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import logger from '@/lib/utils/logger';
import {
  type CredentialSource,
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
   * Resolves credentials with proper precedence logic
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

    // 1. Authenticated user BYOK (highest priority)
    if (user?.isAuthenticated && user.userId) {
      try {
        const userKey = await getEffectiveApiKey(
          user.userId,
          provider as any // ProviderWithoutOllama type
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

    // 2. Guest header override (if no user key)
    const guestCredentials = this.extractGuestCredentials(headers);
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

    // 3. No credentials found - will fallback to environment downstream
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
    const result = await this.resolveCredentials(
      { isAuthenticated, userId },
      resolvedModel,
      req.headers
    );

    return result.apiKey;
  }

  /**
   * Tracks credential errors for metrics
   */
  static trackCredentialError(
    err: unknown,
    modelToUse: string,
    userIdToUse: string
  ): void {
    try {
      const provider = getProviderForModel(modelToUse) as Provider;
      trackCredentialError(err, provider, {
        model: modelToUse,
        userId: userIdToUse,
      });
    } catch {
      // Silently handle provider resolution errors to prevent error loops
    }
  }
}
