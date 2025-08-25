import pino from 'pino';
import { sanitizeLogEntry, redactErrorData } from '@/lib/utils/redaction';

const isDevelopment = process.env.NODE_ENV === 'development';

// Create logger with error handling and fallback, without pretty transports (to avoid require/worker threads)
const createLogger = () => {
  const baseConfig = {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    formatters: {
      level: (label: string) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'api_key',
        'apiKey',
        'password',
        'token',
        'authorization',
        'cookie',
        'session',
        'secret',
        'private',
        'req.headers["x-provider-api-key"]',
        'req.headers["X-Provider-Api-Key"]',
        'headers["x-provider-api-key"]',
        'headers["X-Provider-Api-Key"]',
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
      ],
      censor: '[REDACTED]',
    },
  };

  // Always use base pino without pretty printing to avoid CommonJS require
  return pino(baseConfig);
};

const logger = createLogger();

// Type guards to safely inspect unknown values
const hasMessage = (val: unknown): val is { message?: string } =>
  typeof val === 'object' && val !== null && 'message' in val;

const hasCode = (val: unknown): val is { code?: string } =>
  typeof val === 'object' && val !== null && 'code' in val;

// Add process-level error handlers to catch any remaining worker thread issues
if (typeof process !== 'undefined') {
  // Handle uncaught exceptions related to worker threads
  const originalUncaughtException = process.listeners('uncaughtException');
  
  process.removeAllListeners('uncaughtException');
  
  process.on('uncaughtException', (error: Error) => {
    // Check if this is a thread-stream/worker related error
    if (error.message.includes('worker thread') || 
        error.message.includes('thread-stream') ||
        error.message.includes('worker.js') ||
        (hasCode(error) && error.code === 'MODULE_NOT_FOUND' && error.message.includes('worker'))) {
      
      console.error('Logger worker thread error caught and handled:', error.message);
      // Don't exit the process for logger errors
      return;
    }
    
    // Re-emit for other uncaught exceptions
    originalUncaughtException.forEach(listener => {
      if (typeof listener === 'function') {
        listener.call(process, error, 'uncaughtException');
      }
    });
    
    // If no other handlers, log and exit
    if (originalUncaughtException.length === 0) {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections that might be related to worker threads
  process.on('unhandledRejection', (reason: unknown) => {
    if (hasMessage(reason) && 
        (reason.message?.includes('worker thread') || 
         reason.message?.includes('thread-stream') ||
         reason.message?.includes('worker.js'))) {
      
      console.error('Logger worker thread promise rejection caught and handled:', reason.message || reason);
      // Don't exit the process for logger errors
      return;
    }
    
    // Log other unhandled rejections but don't crash
    console.error('Unhandled Promise Rejection:', reason);
  });
}

export default logger;

export const logError = (error: unknown, context?: Record<string, unknown>) => {
  // Sanitize error and context before logging
  const safeError = redactErrorData(error);
  const safeContext = context ? sanitizeLogEntry(context) : {};
  
  if (error instanceof Error) {
    logger.error({ err: safeError, ...safeContext }, error.message);
  } else {
    logger.error({ error: safeError, ...safeContext }, 'Unknown error occurred');
  }
};

export const logWarning = (message: string, context?: Record<string, unknown>) => {
  const safeContext = context ? sanitizeLogEntry(context) : {};
  logger.warn(safeContext, message);
};

export const logInfo = (message: string, context?: Record<string, unknown>) => {
  const safeContext = context ? sanitizeLogEntry(context) : {};
  logger.info(safeContext, message);
};

export const logDebug = (message: string, context?: Record<string, unknown>) => {
  const safeContext = context ? sanitizeLogEntry(context) : {};
  logger.debug(safeContext, message);
};

export const logTrace = (message: string, context?: Record<string, unknown>) => {
  const safeContext = context ? sanitizeLogEntry(context) : {};
  logger.trace(safeContext, message);
};

export const createChildLogger = (name: string) => {
  return logger.child({ service: name });
};