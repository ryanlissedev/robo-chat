import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateJsonPayload,
  createStreamingErrorResponse,
  parseRequestBody,
  ResponseError,
  ApiErrorType,
} from '@/lib/utils/api-response-utils';

describe('api-response-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createErrorResponse', () => {
    it('should create error response with correct structure', () => {
      const response = createErrorResponse(
        'validation_error',
        'Invalid input data',
        400
      );

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      return response.json().then((body) => {
        expect(body).toEqual({
          error: 'validation_error',
          message: 'Invalid input data',
          timestamp: expect.any(String),
        });
        expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
      });
    });

    it('should default to 500 status when not provided', () => {
      const response = createErrorResponse(
        'internal_error',
        'Something went wrong'
      );

      expect(response.status).toBe(500);
    });

    it('should handle different error types', () => {
      const types: ApiErrorType[] = [
        'validation_error',
        'authentication_error',
        'authorization_error',
        'rate_limit_error',
        'api_key_error',
        'model_error',
        'internal_error',
        'external_service_error',
      ];

      types.forEach((type) => {
        const response = createErrorResponse(type, `Test ${type}`, 400);
        expect(response.status).toBe(400);

        return response.json().then((body) => {
          expect(body.error).toBe(type);
          expect(body.message).toBe(`Test ${type}`);
        });
      });
    });

    it('should include custom details when provided', () => {
      const details = { field: 'username', code: 'INVALID_FORMAT' };
      const response = createErrorResponse(
        'validation_error',
        'Invalid format',
        400,
        details
      );

      return response.json().then((body) => {
        expect(body.details).toEqual(details);
      });
    });

    it('should handle empty message gracefully', () => {
      const response = createErrorResponse('internal_error', '');

      return response.json().then((body) => {
        expect(body.message).toBe('');
      });
    });

    it('should handle very long error messages', () => {
      const longMessage = 'A'.repeat(1000);
      const response = createErrorResponse(
        'validation_error',
        longMessage,
        400
      );

      return response.json().then((body) => {
        expect(body.message).toBe(longMessage);
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      return response.json().then((body) => {
        expect(body).toEqual(data);
      });
    });

    it('should handle custom status codes', () => {
      const data = { created: true };
      const response = createSuccessResponse(data, 201);

      expect(response.status).toBe(201);

      return response.json().then((body) => {
        expect(body).toEqual(data);
      });
    });

    it('should handle null data', () => {
      const response = createSuccessResponse(null);

      expect(response.status).toBe(200);

      return response.json().then((body) => {
        expect(body).toBeNull();
      });
    });

    it('should handle undefined data', () => {
      const response = createSuccessResponse(undefined);

      expect(response.status).toBe(200);

      return response.json().then((body) => {
        expect(body).toBeNull();
      });
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        user: {
          id: 1,
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
              notifications: ['email', 'push'],
            },
          },
        },
        metadata: {
          timestamp: '2023-01-01T00:00:00Z',
          version: '1.0.0',
        },
      };

      const response = createSuccessResponse(complexData);

      return response.json().then((body) => {
        expect(body).toEqual(complexData);
      });
    });

    it('should handle arrays', () => {
      const arrayData = [1, 2, 3, { name: 'test' }];
      const response = createSuccessResponse(arrayData);

      return response.json().then((body) => {
        expect(body).toEqual(arrayData);
      });
    });
  });

  describe('handleApiError', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
      vi.clearAllMocks();
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle ResponseError instances', () => {
      const error = new ResponseError('validation_error', 'Invalid data', 400);
      const response = handleApiError(error, 'test-operation');

      expect(response.status).toBe(400);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'API Error in test-operation:',
        {
          type: 'validation_error',
          message: 'Invalid data',
          status: 400,
        }
      );

      return response.json().then((body) => {
        expect(body.error).toBe('validation_error');
        expect(body.message).toBe('Invalid data');
      });
    });

    it('should handle generic Error instances', () => {
      const error = new Error('Generic error');
      const response = handleApiError(error, 'test-operation');

      expect(response.status).toBe(500);

      return response.json().then((body) => {
        expect(body.error).toBe('internal_error');
        expect(body.message).toBe('Generic error');
      });
    });

    it('should handle unknown error types', () => {
      const error = 'String error';
      const response = handleApiError(error, 'test-operation');

      expect(response.status).toBe(500);

      return response.json().then((body) => {
        expect(body.error).toBe('internal_error');
        expect(body.message).toBe('An unexpected error occurred');
      });
    });

    it('should handle null/undefined errors', () => {
      const nullResponse = handleApiError(null, 'test-operation');
      const undefinedResponse = handleApiError(undefined, 'test-operation');

      expect(nullResponse.status).toBe(500);
      expect(undefinedResponse.status).toBe(500);

      return Promise.all([nullResponse.json(), undefinedResponse.json()]).then(
        ([nullBody, undefinedBody]) => {
          expect(nullBody.message).toBe('An unexpected error occurred');
          expect(undefinedBody.message).toBe('An unexpected error occurred');
        }
      );
    });

    it('should include operation context in logs', () => {
      const error = new Error('Test error');
      handleApiError(error, 'custom-operation-name');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'API Error in custom-operation-name:',
        expect.any(Object)
      );
    });

    it('should handle ResponseError with custom details', () => {
      const error = new ResponseError(
        'validation_error',
        'Field validation failed',
        422,
        { field: 'email', code: 'INVALID_EMAIL' }
      );

      const response = handleApiError(error, 'validate-user');

      expect(response.status).toBe(422);

      return response.json().then((body) => {
        expect(body.details).toEqual({
          field: 'email',
          code: 'INVALID_EMAIL',
        });
      });
    });
  });

  describe('validateJsonPayload', () => {
    it('should validate required fields successfully', () => {
      const payload = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const result = validateJsonPayload(payload, ['name', 'email']);

      expect(result).toEqual({ valid: true });
    });

    it('should return missing field error', () => {
      const payload = {
        name: 'John',
        // email missing
      };

      const result = validateJsonPayload(payload, ['name', 'email']);

      expect(result).toEqual({
        valid: false,
        error: 'Missing required field: email',
      });
    });

    it('should return first missing field when multiple are missing', () => {
      const payload = {
        // name and email both missing
        age: 25,
      };

      const result = validateJsonPayload(payload, ['name', 'email']);

      expect(result).toEqual({
        valid: false,
        error: 'Missing required field: name',
      });
    });

    it('should handle empty required fields array', () => {
      const payload = { anything: 'value' };

      const result = validateJsonPayload(payload, []);

      expect(result).toEqual({ valid: true });
    });

    it('should handle null/undefined payload', () => {
      const nullResult = validateJsonPayload(null, ['field']);
      const undefinedResult = validateJsonPayload(undefined, ['field']);

      expect(nullResult).toEqual({
        valid: false,
        error: 'Missing required field: field',
      });
      expect(undefinedResult).toEqual({
        valid: false,
        error: 'Missing required field: field',
      });
    });

    it('should treat empty string as missing', () => {
      const payload = {
        name: '',
        email: 'valid@email.com',
      };

      const result = validateJsonPayload(payload, ['name', 'email']);

      expect(result).toEqual({
        valid: false,
        error: 'Missing required field: name',
      });
    });

    it('should treat zero as valid', () => {
      const payload = {
        count: 0,
        active: false,
      };

      const result = validateJsonPayload(payload, ['count', 'active']);

      expect(result).toEqual({ valid: true });
    });

    it('should handle nested field validation', () => {
      const payload = {
        user: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      const result = validateJsonPayload(payload, ['user']);

      expect(result).toEqual({ valid: true });
    });
  });

  describe('createStreamingErrorResponse', () => {
    it('should create streaming error response', () => {
      const response = createStreamingErrorResponse(
        'Stream interrupted',
        'stream_error'
      );

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('text/plain');

      return response.text().then((body) => {
        expect(body).toBe(
          'data: {"error":"stream_error","message":"Stream interrupted"}\n\n'
        );
      });
    });

    it('should handle custom error types', () => {
      const response = createStreamingErrorResponse(
        'Rate limited',
        'rate_limit_error'
      );

      return response.text().then((body) => {
        expect(body).toContain('"error":"rate_limit_error"');
        expect(body).toContain('"message":"Rate limited"');
      });
    });

    it('should handle empty messages', () => {
      const response = createStreamingErrorResponse('', 'internal_error');

      return response.text().then((body) => {
        expect(body).toContain('"message":""');
      });
    });

    it('should format as SSE (Server-Sent Events)', () => {
      const response = createStreamingErrorResponse(
        'Test error',
        'validation_error'
      );

      return response.text().then((body) => {
        expect(body.startsWith('data: ')).toBe(true);
        expect(body.endsWith('\n\n')).toBe(true);
      });
    });
  });

  describe('parseRequestBody', () => {
    it('should parse valid JSON request body', async () => {
      const requestData = { name: 'test', value: 123 };
      const request = new Request('http://test.com', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseRequestBody(request);

      expect(result).toEqual({
        success: true,
        data: requestData,
      });
    });

    it('should handle empty request body', async () => {
      const request = new Request('http://test.com', {
        method: 'POST',
        body: '',
      });

      const result = await parseRequestBody(request);

      expect(result).toEqual({
        success: false,
        error: 'Empty request body',
      });
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://test.com', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseRequestBody(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should handle network errors during parsing', async () => {
      const mockRequest = {
        text: vi.fn().mockRejectedValue(new Error('Network error')),
      } as any;

      const result = await parseRequestBody(mockRequest);

      expect(result).toEqual({
        success: false,
        error: 'Failed to parse request body: Network error',
      });
    });

    it('should handle large JSON payloads', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
        })),
      };

      const request = new Request('http://test.com', {
        method: 'POST',
        body: JSON.stringify(largeData),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseRequestBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(1000);
      }
    });

    it('should handle different content types gracefully', async () => {
      const request = new Request('http://test.com', {
        method: 'POST',
        body: '{"valid": "json"}',
        headers: { 'Content-Type': 'text/plain' },
      });

      const result = await parseRequestBody(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ valid: 'json' });
      }
    });
  });

  describe('ResponseError class', () => {
    it('should create ResponseError with all properties', () => {
      const error = new ResponseError('validation_error', 'Test error', 400, {
        field: 'test',
      });

      expect(error.type).toBe('validation_error');
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.name).toBe('ResponseError');
    });

    it('should default status to 500 when not provided', () => {
      const error = new ResponseError('internal_error', 'Test error');

      expect(error.status).toBe(500);
      expect(error.details).toBeUndefined();
    });

    it('should inherit from Error', () => {
      const error = new ResponseError('validation_error', 'Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ResponseError).toBe(true);
    });

    it('should have proper stack trace', () => {
      const error = new ResponseError('validation_error', 'Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ResponseError');
    });
  });

  describe('integration and edge cases', () => {
    it('should handle circular JSON references in error details', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      // This should not throw due to circular reference
      expect(() => {
        const error = new ResponseError(
          'validation_error',
          'Test',
          400,
          circularObj
        );
        createErrorResponse(
          error.type,
          error.message,
          error.status,
          error.details
        );
      }).not.toThrow();
    });

    it('should maintain response immutability', async () => {
      const originalData = { count: 1 };
      const response = createSuccessResponse(originalData);

      const parsedData = await response.json();
      parsedData.count = 999; // Modify parsed data

      // Original data should remain unchanged
      expect(originalData.count).toBe(1);
    });

    it('should handle Unicode and special characters in messages', () => {
      const unicodeMessage =
        'Error with émojis 🚀 and unicode characters: 日本語';
      const response = createErrorResponse(
        'validation_error',
        unicodeMessage,
        400
      );

      return response.json().then((body) => {
        expect(body.message).toBe(unicodeMessage);
      });
    });

    it('should preserve error context across different utility functions', async () => {
      const originalError = new ResponseError(
        'authentication_error',
        'Invalid credentials',
        401,
        { user: 'john@example.com' }
      );

      const handledResponse = handleApiError(originalError, 'login');
      const responseBody = await handledResponse.json();

      expect(responseBody.error).toBe('authentication_error');
      expect(responseBody.message).toBe('Invalid credentials');
      expect(responseBody.details).toEqual({ user: 'john@example.com' });
    });
  });
});
