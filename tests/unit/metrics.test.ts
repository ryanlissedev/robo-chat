/**
 * Tests for metrics tracking utilities
 * Ensures proper tracking of credential usage and errors without exposing sensitive data
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type CredentialSource,
  clearMetrics,
  type ErrorType,
  getMetricsStorageInfo,
  getMetricsSummary,
  getRecentMetrics,
  type Provider,
  trackCredentialError,
  trackCredentialUsage,
} from '@/lib/utils/metrics';

describe('Metrics Utilities', () => {
  beforeEach(() => {
    // Clear metrics before each test
    clearMetrics();
  });

  afterEach(() => {
    // Clean up after each test
    clearMetrics();
    vi.restoreAllMocks();
  });

  describe('trackCredentialUsage', () => {
    it('should track basic credential usage', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4');

      const summary = getMetricsSummary();
      expect(summary.totalRequests).toBe(1);
      expect(summary.successfulRequests).toBe(1);
      expect(summary.errorRate).toBe(0);
      expect(summary.bySource['user-byok'].total).toBe(1);
      expect(summary.byProvider.openai.total).toBe(1);
    });

    it('should track with additional options', () => {
      trackCredentialUsage('guest-header', 'anthropic', 'claude-3', {
        userId: 'user123',
        success: false,
        responseTime: 1500,
      });

      const summary = getMetricsSummary();
      expect(summary.totalRequests).toBe(1);
      expect(summary.successfulRequests).toBe(0);
      expect(summary.errorRate).toBe(1);
      expect(summary.byProvider.anthropic.avgResponseTime).toBe(1500);
    });

    it('should track multiple requests and calculate rates', () => {
      // Track successful requests
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', { success: true });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', { success: true });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', { success: false });

      const summary = getMetricsSummary();
      expect(summary.totalRequests).toBe(3);
      expect(summary.successfulRequests).toBe(2);
      expect(summary.errorRate).toBeCloseTo(1 / 3);
      expect(summary.bySource['user-byok'].errorRate).toBeCloseTo(1 / 3);
    });

    it('should track different sources separately', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4');
      trackCredentialUsage('guest-header', 'openai', 'gpt-4');
      trackCredentialUsage('environment', 'openai', 'gpt-4');

      const summary = getMetricsSummary();
      expect(summary.totalRequests).toBe(3);
      expect(summary.bySource['user-byok'].total).toBe(1);
      expect(summary.bySource['guest-header'].total).toBe(1);
      expect(summary.bySource.environment.total).toBe(1);
    });

    it('should track different providers separately', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', {
        responseTime: 1000,
      });
      trackCredentialUsage('user-byok', 'anthropic', 'claude-3', {
        responseTime: 2000,
      });
      trackCredentialUsage('user-byok', 'openai', 'gpt-3.5', {
        responseTime: 500,
      });

      const summary = getMetricsSummary();
      expect(summary.byProvider.openai.total).toBe(2);
      expect(summary.byProvider.anthropic.total).toBe(1);
      expect(summary.byProvider.openai.avgResponseTime).toBe(750); // (1000 + 500) / 2
      expect(summary.byProvider.anthropic.avgResponseTime).toBe(2000);
    });
  });

  describe('trackCredentialError', () => {
    it('should track authentication errors', () => {
      const authError = new Error('Invalid API key');
      trackCredentialError(authError, 'openai', {
        source: 'user-byok',
        model: 'gpt-4',
      });

      const summary = getMetricsSummary();
      expect(summary.errors.total).toBe(1);
      expect(summary.errors.byType.authentication).toBe(1);
      expect(summary.errors.byProvider.openai).toBe(1);
    });

    it('should categorize different error types', () => {
      trackCredentialError(new Error('401 Unauthorized'), 'openai');
      trackCredentialError(new Error('403 Forbidden'), 'anthropic');
      trackCredentialError(new Error('429 Too Many Requests'), 'mistral');
      trackCredentialError(new Error('Network timeout'), 'google');
      trackCredentialError(new Error('Unknown error'), 'xai');

      const summary = getMetricsSummary();
      expect(summary.errors.total).toBe(5);
      expect(summary.errors.byType.authentication).toBe(1); // 401
      expect(summary.errors.byType.authorization).toBe(1); // 403
      expect(summary.errors.byType.rate_limit).toBe(1); // 429
      expect(summary.errors.byType.network).toBe(1); // timeout
      expect(summary.errors.byType.unknown).toBe(1); // unknown
    });

    it('should redact sensitive information from error messages', () => {
      const sensitiveError = new Error(
        'API key sk-1234567890abcdef is invalid'
      );
      trackCredentialError(sensitiveError, 'openai');

      const recentMetrics = getRecentMetrics();
      const errorMetric = recentMetrics.errors[0];
      expect(errorMetric.errorMessage).toContain('[API_KEY_REDACTED]');
      expect(errorMetric.errorMessage).not.toContain('sk-1234567890abcdef');
    });

    it('should handle non-Error objects', () => {
      trackCredentialError('String error', 'openai');
      trackCredentialError({ message: 'Object error' }, 'anthropic');
      trackCredentialError(null, 'mistral');

      const summary = getMetricsSummary();
      expect(summary.errors.total).toBe(3);
    });

    it('should limit error message length', () => {
      const longError = new Error('A'.repeat(500));
      trackCredentialError(longError, 'openai');

      const recentMetrics = getRecentMetrics();
      const errorMetric = recentMetrics.errors[0];
      expect(errorMetric.errorMessage.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getMetricsSummary', () => {
    beforeEach(() => {
      // Set up test data
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', {
        success: true,
        responseTime: 1000,
      });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', { success: false });
      trackCredentialUsage('guest-header', 'anthropic', 'claude-3', {
        success: true,
        responseTime: 2000,
      });
      trackCredentialError(new Error('Auth failed'), 'openai', {
        source: 'user-byok',
      });
    });

    it('should provide complete metrics summary', () => {
      const summary = getMetricsSummary();

      expect(summary.totalRequests).toBe(3);
      expect(summary.successfulRequests).toBe(2);
      expect(summary.errorRate).toBeCloseTo(1 / 3);

      expect(summary.bySource['user-byok'].total).toBe(2);
      expect(summary.bySource['guest-header'].total).toBe(1);
      expect(summary.bySource.environment.total).toBe(0);

      expect(summary.byProvider.openai.total).toBe(2);
      expect(summary.byProvider.anthropic.total).toBe(1);

      expect(summary.errors.total).toBe(1);
      expect(summary.timeRange.start).toBeDefined();
      expect(summary.timeRange.end).toBeDefined();
    });

    it('should filter by time range', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago

      const summary = getMetricsSummary(past);
      expect(summary.totalRequests).toBeGreaterThan(0);

      const future = new Date(now.getTime() + 60000); // 1 minute in future
      const emptySummary = getMetricsSummary(future);
      expect(emptySummary.totalRequests).toBe(0);
    });

    it('should handle empty metrics', () => {
      clearMetrics();
      const summary = getMetricsSummary();

      expect(summary.totalRequests).toBe(0);
      expect(summary.successfulRequests).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.errors.total).toBe(0);
    });
  });

  describe('getRecentMetrics', () => {
    it('should return recent metrics within time window', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4');
      trackCredentialError(new Error('Test error'), 'openai');

      const recent = getRecentMetrics(60); // Last 60 minutes
      expect(recent.usage.length).toBe(1);
      expect(recent.errors.length).toBe(1);
    });

    it('should filter old metrics', () => {
      // Mock Date to simulate old metrics
      const realDate = Date;
      const oldTime = new Date('2023-01-01').getTime();

      vi.spyOn(global, 'Date')
        .mockImplementationOnce(() => new realDate(oldTime) as any)
        .mockImplementationOnce(() => new realDate(oldTime) as any);

      trackCredentialUsage('user-byok', 'openai', 'gpt-4');
      trackCredentialError(new Error('Old error'), 'openai');

      // Restore Date for the query
      vi.restoreAllMocks();

      const recent = getRecentMetrics(1); // Last 1 minute
      expect(recent.usage.length).toBe(0);
      expect(recent.errors.length).toBe(0);
    });
  });

  describe('Storage Management', () => {
    it('should track storage size', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4');
      trackCredentialError(new Error('Test'), 'openai');

      const info = getMetricsStorageInfo();
      expect(info.usage).toBe(1);
      expect(info.errors).toBe(1);
    });

    it('should clear all metrics', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4');
      trackCredentialError(new Error('Test'), 'openai');

      expect(getMetricsStorageInfo().usage).toBe(1);
      expect(getMetricsStorageInfo().errors).toBe(1);

      clearMetrics();

      expect(getMetricsStorageInfo().usage).toBe(0);
      expect(getMetricsStorageInfo().errors).toBe(0);
    });
  });

  describe('Error Categorization', () => {
    const testCases: Array<[string, ErrorType]> = [
      ['401 Unauthorized', 'authentication'],
      ['Invalid API key', 'authentication'],
      ['unauthorized access', 'authentication'],
      ['403 Forbidden', 'authorization'],
      ['forbidden resource', 'authorization'],
      ['429 Too Many Requests', 'rate_limit'],
      ['rate limit exceeded', 'rate_limit'],
      ['Network timeout', 'network'],
      ['Connection refused', 'network'],
      ['ECONNREFUSED', 'network'],
      ['ENOTFOUND', 'network'],
      ['Random error', 'unknown'],
      ['', 'unknown'],
    ];

    testCases.forEach(([errorMessage, expectedType]) => {
      it(`should categorize "${errorMessage}" as ${expectedType}`, () => {
        trackCredentialError(new Error(errorMessage), 'openai');

        const summary = getMetricsSummary();
        expect(summary.errors.byType[expectedType]).toBe(1);
      });
    });
  });

  describe('Provider Types', () => {
    const providers: Provider[] = [
      'openai',
      'anthropic',
      'mistral',
      'google',
      'xai',
      'perplexity',
      'openrouter',
    ];

    providers.forEach((provider) => {
      it(`should track metrics for ${provider} provider`, () => {
        trackCredentialUsage('user-byok', provider, 'test-model');
        trackCredentialError(new Error('Test'), provider);

        const summary = getMetricsSummary();
        expect(summary.byProvider[provider].total).toBe(1);
        expect(summary.errors.byProvider[provider]).toBe(1);
      });
    });
  });

  describe('Credential Sources', () => {
    const sources: CredentialSource[] = [
      'user-byok',
      'guest-header',
      'environment',
    ];

    sources.forEach((source) => {
      it(`should track metrics for ${source} source`, () => {
        trackCredentialUsage(source, 'openai', 'test-model');

        const summary = getMetricsSummary();
        expect(summary.bySource[source].total).toBe(1);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle undefined/null values gracefully', () => {
      expect(() => {
        trackCredentialUsage(
          'user-byok' as any,
          undefined as any,
          'test-model'
        );
      }).not.toThrow();

      expect(() => {
        trackCredentialError(null, 'openai' as any);
      }).not.toThrow();
    });

    it('should handle very large datasets', () => {
      // Track many metrics
      for (let i = 0; i < 1000; i++) {
        trackCredentialUsage('user-byok', 'openai', `model-${i % 10}`, {
          success: i % 2 === 0,
          responseTime: 1000 + i,
        });
      }

      const summary = getMetricsSummary();
      expect(summary.totalRequests).toBe(1000);
      expect(summary.successfulRequests).toBe(500);
      expect(summary.errorRate).toBe(0.5);
    });

    it('should calculate average response times correctly', () => {
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', {
        responseTime: 1000,
      });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', {
        responseTime: 2000,
      });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', {
        responseTime: 3000,
      });
      trackCredentialUsage('user-byok', 'openai', 'gpt-4', { success: true }); // No response time

      const summary = getMetricsSummary();
      expect(summary.byProvider.openai.avgResponseTime).toBe(2000); // (1000 + 2000 + 3000) / 3
    });

    it('should handle time range edge cases', () => {
      const summary = getMetricsSummary();
      expect(summary.timeRange.start).toBeInstanceOf(Date);
      expect(summary.timeRange.end).toBeInstanceOf(Date);
      expect(summary.timeRange.end.getTime()).toBeGreaterThanOrEqual(
        summary.timeRange.start.getTime()
      );
    });
  });
});
