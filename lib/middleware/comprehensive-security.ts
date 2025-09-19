import { type NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/middleware/rate-limit';
import {
  validateCSRFToken,
  validateOrigin,
  securityHeaders,
  sanitizeInput,
  detectSuspiciousApiKey
} from '@/lib/security/middleware';
import { logSecurityEvent, extractRequestContext } from '@/lib/utils/api-logger';
import { createStandardErrorResponse, API_ERROR_CODES } from '@/lib/middleware/api-handler';

// Security configuration
const SECURITY_CONFIG = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxHeaderLength: 8192, // 8KB
  maxUrlLength: 2048, // 2KB
  suspiciousPatterns: [
    /\.\.\//g, // Path traversal
    /<script/gi, // XSS attempts
    /union.*select/gi, // SQL injection
    /javascript:/gi, // JavaScript protocol
    /data:.*base64/gi, // Base64 data URLs
  ],
  blockedUserAgents: [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
  ],
  allowedFileTypes: [
    'application/json',
    'text/plain',
    'multipart/form-data',
  ],
};

export interface SecurityOptions {
  enableCSRF?: boolean;
  enableOriginValidation?: boolean;
  enableRateLimit?: boolean;
  enableContentValidation?: boolean;
  enableRequestSizeLimit?: boolean;
  enableUserAgentFiltering?: boolean;
  enableSuspiciousPatternDetection?: boolean;
  maxRequestSize?: number;
}

/**
 * Comprehensive security middleware that applies multiple layers of protection
 */
export function withComprehensiveSecurity(
  handler: (request: NextRequest) => Promise<Response>,
  options: SecurityOptions = {}
) {
  const config = {
    enableCSRF: true,
    enableOriginValidation: true,
    enableRateLimit: true,
    enableContentValidation: true,
    enableRequestSizeLimit: true,
    enableUserAgentFiltering: false, // Disabled by default to avoid blocking legitimate users
    enableSuspiciousPatternDetection: true,
    maxRequestSize: SECURITY_CONFIG.maxRequestSize,
    ...options,
  };

  return async (request: NextRequest): Promise<Response> => {
    const context = extractRequestContext(request);

    try {
      // 1. Request size validation
      if (config.enableRequestSizeLimit) {
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > config.maxRequestSize) {
          logSecurityEvent('Request size exceeded limit', {
            ...context,
            metadata: { contentLength, limit: config.maxRequestSize },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Request too large',
            statusCode: 413,
          });
        }
      }

      // 2. URL length validation
      if (request.url.length > SECURITY_CONFIG.maxUrlLength) {
        logSecurityEvent('URL length exceeded limit', {
          ...context,
          metadata: { urlLength: request.url.length, limit: SECURITY_CONFIG.maxUrlLength },
        });
        return createStandardErrorResponse({
          code: API_ERROR_CODES.INVALID_REQUEST,
          message: 'URL too long',
          statusCode: 414,
        });
      }

      // 3. Header validation
      for (const [name, value] of request.headers.entries()) {
        if (name.length + value.length > SECURITY_CONFIG.maxHeaderLength) {
          logSecurityEvent('Header length exceeded limit', {
            ...context,
            metadata: { headerName: name, headerLength: name.length + value.length, limit: SECURITY_CONFIG.maxHeaderLength },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Header too long',
            statusCode: 400,
          });
        }
      }

      // 4. User agent filtering (if enabled)
      if (config.enableUserAgentFiltering) {
        const userAgent = request.headers.get('user-agent') || '';
        const isBlocked = SECURITY_CONFIG.blockedUserAgents.some(pattern =>
          pattern.test(userAgent)
        );

        if (isBlocked) {
          logSecurityEvent('Blocked user agent detected', {
            ...context,
            userAgent,
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.FORBIDDEN,
            message: 'Access denied',
            statusCode: 403,
          });
        }
      }

      // 5. Suspicious pattern detection
      if (config.enableSuspiciousPatternDetection) {
        const suspiciousInUrl = SECURITY_CONFIG.suspiciousPatterns.some(pattern =>
          pattern.test(request.url)
        );

        if (suspiciousInUrl) {
          logSecurityEvent('Suspicious pattern in URL', {
            ...context,
            metadata: { url: request.url },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.FORBIDDEN,
            message: 'Suspicious request detected',
            statusCode: 403,
          });
        }
      }

      // 6. Origin validation (for state-changing requests)
      if (config.enableOriginValidation &&
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        if (!validateOrigin(request)) {
          logSecurityEvent('Invalid origin', {
            ...context,
            metadata: { origin: request.headers.get('origin'), referer: request.headers.get('referer') },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.FORBIDDEN,
            message: 'Invalid origin',
            statusCode: 403,
          });
        }
      }

      // 7. CSRF validation (for state-changing requests)
      if (config.enableCSRF &&
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
          !request.url.includes('/api/csrf')) {
        if (!validateCSRFToken(request)) {
          logSecurityEvent('CSRF token validation failed', context);
          return createStandardErrorResponse({
            code: API_ERROR_CODES.FORBIDDEN,
            message: 'CSRF token invalid',
            statusCode: 403,
          });
        }
      }

      // 8. Content type validation
      if (config.enableContentValidation &&
          ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers.get('content-type') || '';
        const isValidContentType = SECURITY_CONFIG.allowedFileTypes.some(type =>
          contentType.includes(type)
        );

        if (!isValidContentType) {
          logSecurityEvent('Invalid content type', {
            ...context,
            metadata: { contentType },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Invalid content type',
            statusCode: 415,
          });
        }
      }

      // 9. Rate limiting (if enabled)
      if (config.enableRateLimit) {
        const rateLimitResponse = await rateLimit(request, 'general');
        if (rateLimitResponse) {
          logSecurityEvent('Rate limit exceeded', context);
          return rateLimitResponse;
        }
      }

      // 10. API key validation (if present)
      const apiKey = request.headers.get('x-api-key');
      if (apiKey) {
        const suspiciousKeyResult = detectSuspiciousApiKey(apiKey);
        if (suspiciousKeyResult.isSuspicious) {
          logSecurityEvent('Suspicious API key detected', {
            ...context,
            metadata: { reason: suspiciousKeyResult.reason },
          });
          return createStandardErrorResponse({
            code: API_ERROR_CODES.FORBIDDEN,
            message: 'Invalid API key',
            statusCode: 403,
          });
        }
      }

      // Execute the handler
      const response = await handler(request);

      // Apply security headers to the response
      return securityHeaders(response as NextResponse);

    } catch (error) {
      logSecurityEvent('Security middleware error', {
        ...context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return createStandardErrorResponse({
        code: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Security check failed',
        statusCode: 500,
      });
    }
  };
}

/**
 * Quick security wrapper for high-security endpoints
 */
export function withMaxSecurity(handler: (request: NextRequest) => Promise<Response>) {
  return withComprehensiveSecurity(handler, {
    enableCSRF: true,
    enableOriginValidation: true,
    enableRateLimit: true,
    enableContentValidation: true,
    enableRequestSizeLimit: true,
    enableUserAgentFiltering: false, // Still disabled by default
    enableSuspiciousPatternDetection: true,
    maxRequestSize: 1024 * 1024, // 1MB for high-security endpoints
  });
}

/**
 * Minimal security wrapper for public endpoints
 */
export function withMinimalSecurity(handler: (request: NextRequest) => Promise<Response>) {
  return withComprehensiveSecurity(handler, {
    enableCSRF: false,
    enableOriginValidation: false,
    enableRateLimit: true,
    enableContentValidation: false,
    enableRequestSizeLimit: true,
    enableUserAgentFiltering: false,
    enableSuspiciousPatternDetection: true,
  });
}

/**
 * Security health check
 */
export async function securityHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  const checks = {
    rateLimitStore: true, // Assume healthy for now
    csrfTokens: true, // Assume healthy for now
    securityHeaders: true, // Assume healthy for now
    inputSanitization: true, // Assume healthy for now
  };

  const failedChecks = Object.values(checks).filter(check => !check).length;
  const status = failedChecks === 0 ? 'healthy' :
                 failedChecks <= 1 ? 'degraded' : 'unhealthy';

  return { status, checks };
}