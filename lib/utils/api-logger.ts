import { type NextRequest } from 'next/server';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  duration?: number;
  statusCode?: number;
  error?: unknown;
  metadata?: Record<string, unknown>;
}

export interface APIMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastUpdated: Date;
  endpointStats: Record<string, {
    count: number;
    errors: number;
    avgTime: number;
  }>;
}

class APILogger {
  private logLevel: LogLevel;
  private metrics: APIMetrics;
  private requestTimes: Map<string, number>;

  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastUpdated: new Date(),
      endpointStats: {},
    };
    this.requestTimes = new Map();
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];

    const baseInfo = {
      timestamp,
      level: levelStr,
      message,
      ...(context && this.sanitizeContext(context)),
    };

    return JSON.stringify(baseInfo);
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized = { ...context };

    // Remove sensitive information
    if (sanitized.metadata) {
      const cleaned = { ...sanitized.metadata };
      // Remove potential sensitive keys
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization'];
      for (const key of Object.keys(cleaned)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          cleaned[key] = '[REDACTED]';
        }
      }
      sanitized.metadata = cleaned;
    }

    return sanitized;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatLog(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatLog(LogLevel.WARN, message, context));
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatLog(LogLevel.ERROR, message, context));
    }
    this.updateMetrics('error', context);
  }

  critical(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.CRITICAL)) {
      console.error(this.formatLog(LogLevel.CRITICAL, message, context));
    }
    this.updateMetrics('error', context);
  }

  startRequest(requestId: string): void {
    this.requestTimes.set(requestId, Date.now());
  }

  endRequest(requestId: string, context?: LogContext): number {
    const startTime = this.requestTimes.get(requestId);
    if (!startTime) {
      return 0;
    }

    const duration = Date.now() - startTime;
    this.requestTimes.delete(requestId);

    this.updateMetrics('request', { ...context, duration });

    return duration;
  }

  private updateMetrics(type: 'request' | 'error', context?: LogContext): void {
    this.metrics.lastUpdated = new Date();

    if (type === 'request') {
      this.metrics.requestCount++;

      if (context?.endpoint) {
        if (!this.metrics.endpointStats[context.endpoint]) {
          this.metrics.endpointStats[context.endpoint] = {
            count: 0,
            errors: 0,
            avgTime: 0,
          };
        }

        const stats = this.metrics.endpointStats[context.endpoint];
        stats.count++;

        if (context.duration) {
          stats.avgTime = (stats.avgTime * (stats.count - 1) + context.duration) / stats.count;
          this.metrics.averageResponseTime =
            (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + context.duration) /
            this.metrics.requestCount;
        }

        if (context.statusCode && context.statusCode >= 400) {
          stats.errors++;
        }
      }
    }

    if (type === 'error') {
      this.metrics.errorCount++;

      if (context?.endpoint && this.metrics.endpointStats[context.endpoint]) {
        this.metrics.endpointStats[context.endpoint].errors++;
      }
    }
  }

  getMetrics(): APIMetrics {
    return { ...this.metrics };
  }

  clearMetrics(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastUpdated: new Date(),
      endpointStats: {},
    };
  }
}

// Singleton instance
const logger = new APILogger();

// Helper functions
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function extractRequestContext(request: NextRequest, requestId?: string): LogContext {
  let endpoint = '/unknown';
  try {
    if (request.url) {
      const url = new URL(request.url);
      endpoint = url.pathname;
    }
  } catch {
    // Fallback for test environments where URL might not be valid
    endpoint = request.url || '/test';
  }

  return {
    requestId: requestId || generateRequestId(),
    endpoint,
    method: request.method,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: getClientIP(request),
  };
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // For Next.js/Vercel, IP is not directly available on request object
  return 'unknown';
}

export function logAPIRequest(
  request: NextRequest,
  context?: Partial<LogContext>
): string {
  const requestId = generateRequestId();
  const requestContext = {
    ...extractRequestContext(request, requestId),
    ...context,
  };

  logger.info(`API Request: ${request.method} ${requestContext.endpoint}`, requestContext);
  logger.startRequest(requestId);

  return requestId;
}

export function logAPIResponse(
  requestId: string,
  statusCode: number,
  context?: Partial<LogContext>
): void {
  const duration = logger.endRequest(requestId, { statusCode, ...context });

  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  const message = `API Response: ${statusCode} (${duration}ms)`;

  const responseContext: LogContext = {
    requestId,
    statusCode,
    duration,
    ...context,
  };

  if (level === 'error') {
    logger.error(message, responseContext);
  } else if (level === 'warn') {
    logger.warn(message, responseContext);
  } else {
    logger.info(message, responseContext);
  }
}

export function logAPIError(
  error: unknown,
  context?: LogContext
): void {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorContext: LogContext = {
    ...context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    } : error,
  };

  logger.error(`API Error: ${errorMessage}`, errorContext);
}

export function logSecurityEvent(
  event: string,
  context?: LogContext
): void {
  logger.warn(`Security Event: ${event}`, {
    ...context,
    metadata: { ...context?.metadata, type: 'security' },
  });
}

export function logPerformanceWarning(
  message: string,
  context?: LogContext
): void {
  logger.warn(`Performance Warning: ${message}`, {
    ...context,
    metadata: { ...context?.metadata, type: 'performance' },
  });
}

// Export the singleton logger instance
export { logger };

// Export default methods
export default {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  critical: logger.critical.bind(logger),
  getMetrics: logger.getMetrics.bind(logger),
  clearMetrics: logger.clearMetrics.bind(logger),
};