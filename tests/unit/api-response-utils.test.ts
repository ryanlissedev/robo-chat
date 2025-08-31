import { describe, it, expect } from 'vitest';
import {
  validateRequiredParams,
  executeWithErrorHandling,
  parseRequestBody,
} from '@/lib/utils/api-response-utils';

describe('api-response-utils', () => {
  describe('validateRequiredParams', () => {
    it('returns invalid when a required field is missing', () => {
      const result = validateRequiredParams({ a: 1 }, ['a', 'b']);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('b is required');
      expect(result.statusCode).toBe(400);
    });

    it('returns valid when all required fields are present', () => {
      const result = validateRequiredParams({ a: 1, b: 2 }, ['a', 'b']);
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ a: 1, b: 2 });
    });
  });

  describe('executeWithErrorHandling', () => {
    it('wraps successful operations', async () => {
      const result = await executeWithErrorHandling(async () => 42);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('wraps thrown errors with message and 500', async () => {
      const result = await executeWithErrorHandling(async () => {
        throw new Error('boom');
      }, 'Operation failed');
      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('parseRequestBody', () => {
    it('parses valid json and validates required fields', async () => {
      const req = new Request('http://test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'VecStore' }),
      });
      const res = await parseRequestBody<{ name: string }>(req, ['name']);
      expect(res.isValid).toBe(true);
      expect(res.data).toEqual({ name: 'VecStore' });
    });

    it('returns invalid for bad json', async () => {
      const req = new Request('http://test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad-json',
      });
      const res = await parseRequestBody(req);
      expect(res.isValid).toBe(false);
      expect(res.statusCode).toBe(400);
      expect(res.error).toBeDefined();
    });
  });
});

