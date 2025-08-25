import type { LogContext } from '@/lib/types/logger';
import { sanitizeLogEntry } from '@/lib/utils/redaction';

const isDevelopment = process.env.NODE_ENV === 'development';

class ClientLogger {
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    
    // Sanitize context to remove sensitive data
    const safeContext = context ? sanitizeLogEntry(context) : undefined;
    const contextStr = safeContext ? ` ${JSON.stringify(safeContext)}` : '';
    
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  error(message: string, error?: unknown, context?: LogContext) {
    // Sanitize error data before logging
    const safeContext = context ? sanitizeLogEntry(context) as LogContext : undefined;
    const safeError = error ? sanitizeLogEntry({ error }).error : undefined;
    
    if (isDevelopment) {
      console.error(this.formatMessage('ERROR', message, safeContext), safeError);
    } else {
      // In production, you might want to send to an error tracking service
      console.error(message);
    }
  }

  warn(message: string, context?: LogContext) {
    if (isDevelopment) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (isDevelopment) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  debug(message: string, context?: LogContext) {
    if (isDevelopment) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }
}

export const clientLogger = new ClientLogger();