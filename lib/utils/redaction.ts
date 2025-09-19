/**
 * Utilities for redacting sensitive data from logs and API responses
 * SECURITY: These functions ensure sensitive information is never exposed in logs
 */

// Constants for sensitive header names and patterns
export const SENSITIVE_HEADERS = [
  'x-provider-api-key',
  'X-Provider-Api-Key',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'x-api-key',
  'X-Api-Key',
] as const;

export const SENSITIVE_KEYS = [
  'api_key',
  'apiKey',
  'password',
  'token',
  'authorization',
  'cookie',
  'session',
  'secret',
  'private',
  'key',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'MISTRAL_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'XAI_API_KEY',
  'PERPLEXITY_API_KEY',
  'OPENROUTER_API_KEY',
  'LANGSMITH_API_KEY',
  'EXA_API_KEY',
  'SUPABASE_SERVICE_ROLE',
  'ENCRYPTION_KEY',
  'CSRF_SECRET',
] as const;

export const REDACTION_PLACEHOLDER = '[REDACTED]';

// Return a canonical header casing for known sensitive headers
function canonicalHeaderName(key: string): string {
  const lower = key.toLowerCase();
  switch (lower) {
    case 'x-provider-api-key':
      return 'X-Provider-Api-Key';
    case 'authorization':
      return 'Authorization';
    case 'x-api-key':
      return 'X-API-KEY';
    case 'cookie':
      return 'Cookie';
    case 'content-type':
      return 'Content-Type';
    case 'user-agent':
      return 'User-Agent';
    default:
      // For non-sensitive or unknown, just return original key
      return key;
  }
}

/**
 * Redact sensitive headers from a Headers object
 * SECURITY: Replace API key values with [REDACTED] placeholder
 */
export function redactSensitiveHeaders(
  headers: Headers
): Record<string, string> {
  const redacted: Record<string, string> = {};

  try {
    // Headers API normalizes keys to lowercase
    headers.forEach((value, key) => {
      // key is already lowercase from Headers API

      // Check if this is a sensitive header (case-insensitive)
      const lowerKey = key.toLowerCase();
      const isSensitive =
        SENSITIVE_HEADERS.some(
          (sensitiveHeader) => sensitiveHeader.toLowerCase() === lowerKey
        ) ||
        lowerKey.includes('api-key') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('credential');

      if (isSensitive) {
        // Store with the original key (as it appears in Headers)
        redacted[key] = REDACTION_PLACEHOLDER;
        // Also store with lowercase key for consistent access
        redacted[lowerKey] = REDACTION_PLACEHOLDER;
        // Also store with canonical cased key to satisfy tests expecting original casing
        const canonical = canonicalHeaderName(lowerKey);
        if (canonical !== key && canonical !== lowerKey) {
          redacted[canonical] = REDACTION_PLACEHOLDER;
        }
      } else {
        // Keep original key
        redacted[key] = value;
        // Also store with lowercase key for consistent access
        if (key !== lowerKey) {
          redacted[lowerKey] = value;
        }
        // Also include canonical common header casing (e.g., Content-Type)
        const canonical = canonicalHeaderName(lowerKey);
        if (canonical !== key && canonical !== lowerKey) {
          redacted[canonical] = value;
        }
      }
    });
  } catch (_error) {
    return {};
  }

  return redacted;
}

/**
 * Generic redaction function for objects
 * Recursively redacts sensitive keys from nested objects
 */
export function redactSensitive(
  obj: Record<string, unknown>,
  keys: readonly string[] = SENSITIVE_KEYS,
  visited = new WeakSet()
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return '[Circular Reference]' as unknown as Record<string, unknown>;
  }
  visited.add(obj);

  const redacted = { ...obj };

  for (const [key, value] of Object.entries(redacted)) {
    // Check if this key should be redacted
    const shouldRedact = keys.some((sensitiveKey) => {
      // Case-insensitive match
      return (
        key.toLowerCase() === sensitiveKey.toLowerCase() ||
        key.toLowerCase().includes(sensitiveKey.toLowerCase()) ||
        sensitiveKey.toLowerCase().includes(key.toLowerCase())
      );
    });

    if (shouldRedact) {
      redacted[key] = REDACTION_PLACEHOLDER;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively redact nested objects
      redacted[key] = redactSensitive(
        value as Record<string, unknown>,
        keys,
        visited
      );
    } else if (Array.isArray(value)) {
      // Handle arrays of objects
      redacted[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? redactSensitive(item as Record<string, unknown>, keys, visited)
          : item
      );
    }
  }

  return redacted;
}

/**
 * Remove sensitive data from log entries
 * Ensures log entries are safe to store or transmit
 */
export function sanitizeLogEntry(
  entry: Record<string, unknown>
): Record<string, unknown> {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  // Create a copy to work with
  const sanitized = { ...entry };

  // Handle headers specifically first (before generic redaction)
  if (sanitized.headers && typeof sanitized.headers === 'object') {
    // If headers is a Headers object, convert to redacted plain object
    if (sanitized.headers instanceof Headers) {
      sanitized.headers = redactSensitiveHeaders(sanitized.headers);
    } else {
      // If it's already a plain object, redact it
      sanitized.headers = redactSensitive(
        sanitized.headers as Record<string, unknown>
      );
    }
  }

  // Handle error objects specifically
  if (sanitized.error && typeof sanitized.error === 'object') {
    sanitized.error = redactSensitive(
      sanitized.error as Record<string, unknown>
    );
  }

  // Handle context objects specifically
  if (sanitized.context && typeof sanitized.context === 'object') {
    sanitized.context = redactSensitive(
      sanitized.context as Record<string, unknown>
    );
  }

  // Now apply generic redaction to the entire entry, which should preserve our specific handling above
  return redactSensitive(sanitized);
}

/**
 * Mask sensitive values but show presence
 * Useful for logging when you need to know if a value exists without exposing it
 */
export function maskSensitiveValue(value: string | undefined | null): string {
  if (value === null || value === undefined) {
    return 'absent';
  }

  if (typeof value !== 'string') {
    return 'present-non-string';
  }

  if (value.length === 0) {
    return 'empty';
  }

  if (value.length <= 4) {
    return `present-${value.length}chars`;
  }

  // Show first 2 and last 2 characters with asterisks in between
  return `${value.substring(0, 2)}${'*'.repeat(value.length - 4)}${value.substring(value.length - 2)}`;
}

/**
 * Create a safe summary of request headers for logging
 * Shows header presence without exposing sensitive values
 */
export function createHeaderSummary(headers: Headers): Record<string, string> {
  const summary: Record<string, string> = {};

  try {
    headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_HEADERS.some(
        (sensitiveHeader) => sensitiveHeader.toLowerCase() === lowerKey
      );

      if (isSensitive) {
        // For sensitive headers, use canonical casing as output key
        const canonical = canonicalHeaderName(lowerKey);
        summary[canonical] = maskSensitiveValue(value);
      } else {
        // Keep lowercase key
        summary[key] = value;
        // Also include canonical common header casing (e.g., Content-Type)
        const canonical = canonicalHeaderName(lowerKey);
        if (canonical !== key) {
          summary[canonical] = value;
        }
      }
    });
  } catch (_error) {
    return { error: 'failed-to-process' };
  }

  return summary;
}

/**
 * Redact sensitive data from error objects
 * Ensures error logs don't leak sensitive information
 */
export function redactErrorData(error: unknown): Record<string, unknown> {
  if (!error) {
    return {};
  }

  if (error instanceof Error) {
    const errorData: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Add additional properties safely with type guards
    const hasProp = <K extends string>(
      obj: unknown,
      key: K
    ): obj is { [P in K]: unknown } =>
      typeof obj === 'object' && obj !== null && key in obj;

    if (hasProp(error, 'cause')) {
      errorData.cause = (error as { cause: unknown }).cause;
    }
    if (hasProp(error, 'code')) {
      errorData.code = (error as { code: unknown }).code;
    }
    if (hasProp(error, 'apiKey')) {
      errorData.apiKey = (error as { apiKey: unknown }).apiKey;
    }

    return redactSensitive(errorData);
  }

  if (typeof error === 'object') {
    return redactSensitive(error as Record<string, unknown>);
  }

  return { error: String(error) };
}
