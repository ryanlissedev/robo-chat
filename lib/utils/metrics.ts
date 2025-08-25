/**
 * In-memory metrics tracking for credential usage and API performance
 * SECURITY: Tracks usage patterns without exposing actual credentials
 */

export type CredentialSource = 'user-byok' | 'guest-header' | 'environment';
export type Provider = 'openai' | 'anthropic' | 'mistral' | 'google' | 'xai' | 'perplexity' | 'openrouter';
export type ErrorType = 'authentication' | 'authorization' | 'rate_limit' | 'network' | 'unknown';

export interface CredentialUsageMetric {
  timestamp: Date;
  source: CredentialSource;
  provider: Provider;
  model: string;
  userId?: string;
  success: boolean;
  responseTime?: number;
}

export interface CredentialErrorMetric {
  timestamp: Date;
  provider: Provider;
  errorType: ErrorType;
  errorMessage: string;
  source?: CredentialSource;
  userId?: string;
  model?: string;
}

export interface MetricsSummary {
  totalRequests: number;
  successfulRequests: number;
  errorRate: number;
  bySource: Record<CredentialSource, {
    total: number;
    successful: number;
    errorRate: number;
  }>;
  byProvider: Record<string, {
    total: number;
    successful: number;
    errorRate: number;
    avgResponseTime: number;
  }>;
  errors: {
    total: number;
    byType: Record<ErrorType, number>;
    byProvider: Record<string, number>;
  };
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * In-memory storage for metrics
 * Note: In production, this could be replaced with Redis, database, or analytics service
 */
class MetricsStore {
  private usageMetrics: CredentialUsageMetric[] = [];
  private errorMetrics: CredentialErrorMetric[] = [];
  private readonly maxMetrics = 10000; // Prevent memory bloat
  private readonly cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Clean up old metrics periodically
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  addUsageMetric(metric: CredentialUsageMetric): void {
    this.usageMetrics.push(metric);
    
    // Keep only the most recent metrics
    if (this.usageMetrics.length > this.maxMetrics) {
      this.usageMetrics = this.usageMetrics.slice(-this.maxMetrics);
    }
  }

  addErrorMetric(metric: CredentialErrorMetric): void {
    this.errorMetrics.push(metric);
    
    // Keep only the most recent errors
    if (this.errorMetrics.length > this.maxMetrics) {
      this.errorMetrics = this.errorMetrics.slice(-this.maxMetrics);
    }
  }

  getUsageMetrics(since?: Date): CredentialUsageMetric[] {
    if (!since) {
      return [...this.usageMetrics];
    }
    
    return this.usageMetrics.filter(metric => metric.timestamp >= since);
  }

  getErrorMetrics(since?: Date): CredentialErrorMetric[] {
    if (!since) {
      return [...this.errorMetrics];
    }
    
    return this.errorMetrics.filter(metric => metric.timestamp >= since);
  }

  clear(): void {
    this.usageMetrics = [];
    this.errorMetrics = [];
  }

  private cleanup(): void {
    const cutoff = new Date(Date.now() - this.cleanupInterval);
    
    this.usageMetrics = this.usageMetrics.filter(metric => metric.timestamp >= cutoff);
    this.errorMetrics = this.errorMetrics.filter(metric => metric.timestamp >= cutoff);
  }

  getSize(): { usage: number; errors: number } {
    return {
      usage: this.usageMetrics.length,
      errors: this.errorMetrics.length,
    };
  }
}

// Global metrics store instance
const metricsStore = new MetricsStore();

/**
 * Track credential usage for analytics
 * SECURITY: Never logs actual API keys, only usage patterns
 */
export function trackCredentialUsage(
  source: CredentialSource,
  provider: Provider,
  model: string,
  options: {
    userId?: string;
    success?: boolean;
    responseTime?: number;
  } = {}
): void {
  const metric: CredentialUsageMetric = {
    timestamp: new Date(),
    source,
    provider,
    model,
    userId: options.userId,
    success: options.success ?? true,
    responseTime: options.responseTime,
  };

  metricsStore.addUsageMetric(metric);
}

/**
 * Track credential-related errors
 * SECURITY: Logs error patterns without exposing sensitive data
 */
export function trackCredentialError(
  error: unknown,
  provider: Provider,
  options: {
    source?: CredentialSource;
    userId?: string;
    model?: string;
  } = {}
): void {
  const errorType = categorizeError(error);
  const errorMessage = getErrorMessage(error);

  const metric: CredentialErrorMetric = {
    timestamp: new Date(),
    provider,
    errorType,
    errorMessage,
    source: options.source,
    userId: options.userId,
    model: options.model,
  };

  metricsStore.addErrorMetric(metric);
}

/**
 * Get aggregated metrics summary
 * Provides insights without exposing sensitive information
 */
export function getMetricsSummary(since?: Date): MetricsSummary {
  const usageMetrics = metricsStore.getUsageMetrics(since);
  const errorMetrics = metricsStore.getErrorMetrics(since);

  const totalRequests = usageMetrics.length;
  const successfulRequests = usageMetrics.filter(m => m.success).length;
  const errorRate = totalRequests > 0 ? (totalRequests - successfulRequests) / totalRequests : 0;

  // Aggregate by source
  const bySource: Record<CredentialSource, { total: number; successful: number; errorRate: number }> = {
    'user-byok': { total: 0, successful: 0, errorRate: 0 },
    'guest-header': { total: 0, successful: 0, errorRate: 0 },
    'environment': { total: 0, successful: 0, errorRate: 0 },
  };

  usageMetrics.forEach(metric => {
    bySource[metric.source].total++;
    if (metric.success) {
      bySource[metric.source].successful++;
    }
  });

  Object.keys(bySource).forEach(source => {
    const sourceKey = source as CredentialSource;
    const data = bySource[sourceKey];
    data.errorRate = data.total > 0 ? (data.total - data.successful) / data.total : 0;
  });

  // Aggregate by provider
  const byProvider: Record<string, { total: number; successful: number; errorRate: number; avgResponseTime: number }> = {};

  usageMetrics.forEach(metric => {
    if (!byProvider[metric.provider]) {
      byProvider[metric.provider] = { total: 0, successful: 0, errorRate: 0, avgResponseTime: 0 };
    }
    
    byProvider[metric.provider].total++;
    if (metric.success) {
      byProvider[metric.provider].successful++;
    }
  });

  // Calculate error rates and average response times
  Object.keys(byProvider).forEach(provider => {
    const data = byProvider[provider];
    data.errorRate = data.total > 0 ? (data.total - data.successful) / data.total : 0;
    
    // Calculate average response time
    const providerMetrics = usageMetrics.filter(m => m.provider === provider && m.responseTime);
    const totalResponseTime = providerMetrics.reduce((sum, m) => sum + (m.responseTime || 0), 0);
    data.avgResponseTime = providerMetrics.length > 0 ? totalResponseTime / providerMetrics.length : 0;
  });

  // Aggregate errors
  const errorsByType: Record<ErrorType, number> = {
    authentication: 0,
    authorization: 0,
    rate_limit: 0,
    network: 0,
    unknown: 0,
  };

  const errorsByProvider: Record<string, number> = {};

  errorMetrics.forEach(metric => {
    errorsByType[metric.errorType]++;
    
    if (!errorsByProvider[metric.provider]) {
      errorsByProvider[metric.provider] = 0;
    }
    errorsByProvider[metric.provider]++;
  });

  // Determine time range
  const allTimestamps = [
    ...usageMetrics.map(m => m.timestamp),
    ...errorMetrics.map(m => m.timestamp),
  ];
  
  const timeRange = {
    start: allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps.map(t => t.getTime()))) : new Date(),
    end: allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps.map(t => t.getTime()))) : new Date(),
  };

  return {
    totalRequests,
    successfulRequests,
    errorRate,
    bySource,
    byProvider,
    errors: {
      total: errorMetrics.length,
      byType: errorsByType,
      byProvider: errorsByProvider,
    },
    timeRange,
  };
}

/**
 * Get recent metrics for monitoring
 */
export function getRecentMetrics(minutes: number = 60): {
  usage: CredentialUsageMetric[];
  errors: CredentialErrorMetric[];
} {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  
  return {
    usage: metricsStore.getUsageMetrics(since),
    errors: metricsStore.getErrorMetrics(since),
  };
}

/**
 * Clear all stored metrics (useful for testing)
 */
export function clearMetrics(): void {
  metricsStore.clear();
}

/**
 * Get storage size information
 */
export function getMetricsStorageInfo(): { usage: number; errors: number } {
  return metricsStore.getSize();
}

/**
 * Categorize errors by type for better analytics
 */
function categorizeError(error: unknown): ErrorType {
  if (!error) {
    return 'unknown';
  }

  const errorStr = String(error).toLowerCase();
  const errorMessage = error instanceof Error ? error.message.toLowerCase() : errorStr;

  if (errorMessage.includes('unauthorized') || 
      errorMessage.includes('invalid api key') || 
      errorMessage.includes('authentication') ||
      errorMessage.includes('401')) {
    return 'authentication';
  }

  if (errorMessage.includes('forbidden') || 
      errorMessage.includes('403') ||
      errorMessage.includes('authorization')) {
    return 'authorization';
  }

  if (errorMessage.includes('rate limit') || 
      errorMessage.includes('too many requests') || 
      errorMessage.includes('429')) {
    return 'rate_limit';
  }

  if (errorMessage.includes('network') || 
      errorMessage.includes('timeout') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')) {
    return 'network';
  }

  return 'unknown';
}

/**
 * Extract safe error message for logging
 */
function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (error instanceof Error) {
    // Redact potentially sensitive information from error messages
    let message = error.message;
    
    // Remove any potential API keys or tokens from error messages
    message = message.replace(/sk-[a-zA-Z0-9-_]+/g, '[API_KEY_REDACTED]');
    message = message.replace(/[a-zA-Z0-9]{32,}/g, '[TOKEN_REDACTED]');
    
    return message.substring(0, 200); // Limit message length
  }

  return String(error).substring(0, 200);
}