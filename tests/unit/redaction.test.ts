/**
 * Tests for redaction utilities
 * Ensures sensitive data is properly redacted from logs and API responses
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createHeaderSummary,
  maskSensitiveValue,
  REDACTION_PLACEHOLDER,
  redactErrorData,
  redactSensitive,
  redactSensitiveHeaders,
  SENSITIVE_HEADERS,
  SENSITIVE_KEYS,
  sanitizeLogEntry,
} from '@/lib/utils/redaction';

describe('Redaction Utilities', () => {
  describe('redactSensitiveHeaders', () => {
    it('should redact sensitive headers', () => {
      const headers = new Headers();
      headers.set('X-Provider-Api-Key', 'sk-1234567890abcdef');
      headers.set('Authorization', 'Bearer token123');
      headers.set('Content-Type', 'application/json');
      headers.set('User-Agent', 'test-agent');

      const result = redactSensitiveHeaders(headers);

      // Headers API normalizes keys to lowercase
      expect(result['x-provider-api-key']).toBe(REDACTION_PLACEHOLDER);
      expect(result.authorization).toBe(REDACTION_PLACEHOLDER);
      expect(result['content-type']).toBe('application/json');
      expect(result['user-agent']).toBe('test-agent');
    });

    it('should handle case-insensitive headers', () => {
      const headers = new Headers();
      headers.set('x-provider-api-key', 'sk-1234567890abcdef');
      headers.set('authorization', 'Bearer token123');
      headers.set('X-API-KEY', 'api-key-123');

      const result = redactSensitiveHeaders(headers);

      expect(result['x-provider-api-key']).toBe(REDACTION_PLACEHOLDER);
      expect(result.authorization).toBe(REDACTION_PLACEHOLDER);
      expect(result['X-API-KEY']).toBe(REDACTION_PLACEHOLDER);
    });

    it('should handle empty headers', () => {
      const headers = new Headers();
      const result = redactSensitiveHeaders(headers);
      expect(result).toEqual({});
    });

    it('should handle headers iteration failure gracefully', () => {
      // Mock console.error to suppress error output during test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Create a mock headers object that throws on forEach
      const mockHeaders = {
        forEach: () => {
          throw new Error('Headers iteration failed');
        },
      } as unknown as Headers;

      const result = redactSensitiveHeaders(mockHeaders);
      expect(result).toEqual({});

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('redactSensitive', () => {
    it('should redact sensitive keys in objects', () => {
      const obj = {
        apiKey: 'sk-1234567890abcdef',
        password: 'secret123',
        normalField: 'normal value',
        user: {
          name: 'John',
          token: 'token123',
        },
      };

      const result = redactSensitive(obj);

      expect(result.apiKey).toBe(REDACTION_PLACEHOLDER);
      expect(result.password).toBe(REDACTION_PLACEHOLDER);
      expect(result.normalField).toBe('normal value');
      expect((result.user as any).name).toBe('John');
      expect((result.user as any).token).toBe(REDACTION_PLACEHOLDER);
    });

    it('should handle nested objects and arrays', () => {
      const obj = {
        config: {
          apiKey: 'sk-123',
          settings: {
            OPENAI_API_KEY: 'key-456',
          },
        },
        users: [
          { name: 'Alice', password: 'secret1' },
          { name: 'Bob', secret: 'secret2' },
        ],
      };

      const result = redactSensitive(obj);

      expect((result.config as any).apiKey).toBe(REDACTION_PLACEHOLDER);
      expect((result.config as any).settings.OPENAI_API_KEY).toBe(
        REDACTION_PLACEHOLDER
      );
      expect((result.users as any)[0].name).toBe('Alice');
      expect((result.users as any)[0].password).toBe(REDACTION_PLACEHOLDER);
      expect((result.users as any)[1].secret).toBe(REDACTION_PLACEHOLDER);
    });

    it('should handle custom sensitive keys', () => {
      const obj = {
        customSecret: 'secret123',
        normalField: 'normal',
        apiKey: 'key123',
      };

      const result = redactSensitive(obj, ['customSecret']);

      expect(result.customSecret).toBe(REDACTION_PLACEHOLDER);
      expect(result.normalField).toBe('normal');
      expect(result.apiKey).toBe('key123'); // Not in custom keys
    });

    it('should handle non-object inputs', () => {
      expect(redactSensitive(null as any)).toBeNull();
      expect(redactSensitive(undefined as any)).toBeUndefined();
      expect(redactSensitive('string' as any)).toBe('string');
      expect(redactSensitive(123 as any)).toBe(123);
    });

    it('should handle case-insensitive matching', () => {
      const obj = {
        API_KEY: 'key1',
        api_key: 'key2',
        ApiKey: 'key3',
        APIKEY: 'key4',
        normalField: 'normal',
      };

      const result = redactSensitive(obj);

      expect(result.API_KEY).toBe(REDACTION_PLACEHOLDER);
      expect(result.api_key).toBe(REDACTION_PLACEHOLDER);
      expect(result.ApiKey).toBe(REDACTION_PLACEHOLDER);
      expect(result.APIKEY).toBe(REDACTION_PLACEHOLDER);
      expect(result.normalField).toBe('normal');
    });
  });

  describe('sanitizeLogEntry', () => {
    it('should sanitize complete log entries', () => {
      const logEntry = {
        message: 'API request',
        headers: new Headers([
          ['X-Provider-Api-Key', 'sk-123'],
          ['Content-Type', 'application/json'],
        ]),
        error: new Error('Authentication failed'),
        context: {
          userId: 'user123',
          apiKey: 'secret-key',
        },
      };

      const result = sanitizeLogEntry(logEntry);

      expect((result.headers as any)['X-Provider-Api-Key']).toBe(
        REDACTION_PLACEHOLDER
      );
      expect((result.headers as any)['Content-Type']).toBe('application/json');
      expect((result.context as any).userId).toBe('user123');
      expect((result.context as any).apiKey).toBe(REDACTION_PLACEHOLDER);
    });

    it('should handle headers as plain objects', () => {
      const logEntry = {
        headers: {
          'X-Provider-Api-Key': 'sk-123',
          'Content-Type': 'application/json',
        },
      };

      const result = sanitizeLogEntry(logEntry);

      expect((result.headers as any)['X-Provider-Api-Key']).toBe(
        REDACTION_PLACEHOLDER
      );
      expect((result.headers as any)['Content-Type']).toBe('application/json');
    });

    it('should handle non-object inputs', () => {
      expect(sanitizeLogEntry(null as any)).toBeNull();
      expect(sanitizeLogEntry('string' as any)).toBe('string');
      expect(sanitizeLogEntry(123 as any)).toBe(123);
    });
  });

  describe('maskSensitiveValue', () => {
    it('should handle different value types', () => {
      expect(maskSensitiveValue(null)).toBe('absent');
      expect(maskSensitiveValue(undefined)).toBe('absent');
      expect(maskSensitiveValue('')).toBe('empty');
      expect(maskSensitiveValue('a')).toBe('present-1chars');
      expect(maskSensitiveValue('ab')).toBe('present-2chars');
      expect(maskSensitiveValue('abc')).toBe('present-3chars');
      expect(maskSensitiveValue('abcd')).toBe('present-4chars');
    });

    it('should mask longer values correctly', () => {
      const result = maskSensitiveValue('sk-1234567890abcdef');
      const expected = `sk${'*'.repeat('sk-1234567890abcdef'.length - 4)}ef`;
      expect(result).toBe(expected);
      expect(result).toMatch(/^sk\*+ef$/);
    });

    it('should handle non-string values', () => {
      expect(maskSensitiveValue(123 as any)).toBe('present-non-string');
    });
  });

  describe('createHeaderSummary', () => {
    it('should create safe header summaries', () => {
      const headers = new Headers();
      headers.set('X-Provider-Api-Key', 'sk-1234567890abcdef');
      headers.set('Content-Type', 'application/json');
      headers.set('Authorization', 'Bearer token123');

      const result = createHeaderSummary(headers);

      expect(result['X-Provider-Api-Key']).toMatch(/^sk\*+ef$/);
      expect(result['Content-Type']).toBe('application/json');
      expect(result.Authorization).toMatch(/^Be\*+23$/);
    });

    it('should handle headers processing failure', () => {
      // Mock console.error to suppress error output during test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const mockHeaders = {
        forEach: () => {
          throw new Error('Headers processing failed');
        },
      } as unknown as Headers;

      const result = createHeaderSummary(mockHeaders);
      expect(result).toEqual({ error: 'failed-to-process' });

      // Restore console.error
      consoleSpy.mockRestore();
    });
  });

  describe('redactErrorData', () => {
    it('should redact Error objects', () => {
      const error = new Error('Invalid API key: sk-1234567890abcdef');
      const result = redactErrorData(error);

      expect(result.name).toBe('Error');
      expect(result.message).toBe('Invalid API key: sk-1234567890abcdef');
      expect(result.stack).toBeDefined();
    });

    it('should redact error objects with sensitive data', () => {
      const error = {
        message: 'Auth failed',
        apiKey: 'sk-123',
        details: {
          token: 'secret-token',
        },
      };

      const result = redactErrorData(error);

      expect(result.message).toBe('Auth failed');
      expect(result.apiKey).toBe(REDACTION_PLACEHOLDER);
      expect((result.details as any).token).toBe(REDACTION_PLACEHOLDER);
    });

    it('should handle null/undefined errors', () => {
      expect(redactErrorData(null)).toEqual({});
      expect(redactErrorData(undefined)).toEqual({});
    });

    it('should handle string errors', () => {
      const result = redactErrorData('Something went wrong');
      expect(result).toEqual({ error: 'Something went wrong' });
    });

    it('should handle errors with additional properties', () => {
      const error = new Error('Test error');
      (error as any).code = 'AUTH_FAILED';
      (error as any).cause = new Error('Root cause');
      (error as any).apiKey = 'sk-123';

      const result = redactErrorData(error);

      expect(result.name).toBe('Error');
      expect(result.message).toBe('Test error');
      expect(result.code).toBe('AUTH_FAILED');
      expect(result.cause).toBeDefined();
      expect(result.apiKey).toBe(REDACTION_PLACEHOLDER);
    });
  });

  describe('Constants', () => {
    it('should have expected sensitive headers', () => {
      expect(SENSITIVE_HEADERS).toContain('x-provider-api-key');
      expect(SENSITIVE_HEADERS).toContain('X-Provider-Api-Key');
      expect(SENSITIVE_HEADERS).toContain('authorization');
      expect(SENSITIVE_HEADERS).toContain('Authorization');
    });

    it('should have expected sensitive keys', () => {
      expect(SENSITIVE_KEYS).toContain('api_key');
      expect(SENSITIVE_KEYS).toContain('apiKey');
      expect(SENSITIVE_KEYS).toContain('password');
      expect(SENSITIVE_KEYS).toContain('OPENAI_API_KEY');
      expect(SENSITIVE_KEYS).toContain('ANTHROPIC_API_KEY');
    });

    it('should use consistent redaction placeholder', () => {
      expect(REDACTION_PLACEHOLDER).toBe('[REDACTED]');
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular references safely', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      obj.apiKey = 'secret';

      // Should not throw with circular reference handling
      const result = redactSensitive(obj);
      expect(result.apiKey).toBe(REDACTION_PLACEHOLDER);
      expect(result.name).toBe('test');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should handle very large objects', () => {
      const largeObj: any = {};
      for (let i = 0; i < 1000; i++) {
        largeObj[`field${i}`] = `value${i}`;
      }
      largeObj.apiKey = 'secret';

      const result = redactSensitive(largeObj);
      expect(result.apiKey).toBe(REDACTION_PLACEHOLDER);
      expect(result.field0).toBe('value0');
      expect(result.field999).toBe('value999');
    });

    it('should handle mixed case and special characters in keys', () => {
      const obj = {
        'API-KEY': 'secret1',
        api_key_test: 'secret2',
        'X-Provider-Api-Key': 'secret3',
        'normal-field': 'normal',
      };

      const result = redactSensitive(obj);

      expect(result['API-KEY']).toBe(REDACTION_PLACEHOLDER);
      expect(result.api_key_test).toBe(REDACTION_PLACEHOLDER);
      expect(result['X-Provider-Api-Key']).toBe(REDACTION_PLACEHOLDER);
      expect(result['normal-field']).toBe('normal');
    });
  });
});
