import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Function to create safe transport configuration
function createTransportConfig() {
  // Only use transport in development and NOT in production/serverless environments
  if (isDevelopment && typeof window === 'undefined') {
    try {
      // Use sync transport to avoid worker thread issues
      const pretty = require('pino-pretty');
      return pretty({
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
        sync: true, // Important: Prevents worker thread issues
      });
    } catch (error) {
      // Fallback if pino-pretty is not available
      console.warn('pino-pretty not available, using default logger format');
      return undefined;
    }
  }
  
  return undefined;
}

// Create logger with error handling and fallback
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

  try {
    const transport = createTransportConfig();
    
    if (transport) {
      // Development mode with pretty printing (as stream, not transport)
      return pino(baseConfig, transport);
    } else {
      // Production mode or fallback - no transport/pretty printing
      return pino(baseConfig);
    }
  } catch (error) {
    // Ultimate fallback - create basic logger
    console.warn('Failed to create pino logger with transport, using basic logger:', error);
    return pino(baseConfig);
  }
};

const logger = createLogger();

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
        ('code' in error && (error as any).code === 'MODULE_NOT_FOUND' && error.message.includes('worker'))) {
      
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
  process.on('unhandledRejection', (reason: any) => {
    if (reason && typeof reason === 'object' && 
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
  if (error instanceof Error) {
    logger.error({ err: error, ...context }, error.message);
  } else {
    logger.error({ error, ...context }, 'Unknown error occurred');
  }
};

export const logWarning = (message: string, context?: Record<string, unknown>) => {
  logger.warn(context, message);
};

export const logInfo = (message: string, context?: Record<string, unknown>) => {
  logger.info(context, message);
};

export const logDebug = (message: string, context?: Record<string, unknown>) => {
  logger.debug(context, message);
};

export const logTrace = (message: string, context?: Record<string, unknown>) => {
  logger.trace(context, message);
};

export const createChildLogger = (name: string) => {
  return logger.child({ service: name });
};