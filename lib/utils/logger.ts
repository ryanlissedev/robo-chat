import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
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
});

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