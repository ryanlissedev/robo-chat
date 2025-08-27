import type { LogContext } from '@/lib/types/logger';
import { sanitizeLogEntry } from '@/lib/utils/redaction';

const isDevelopment = process.env.NODE_ENV === 'development';

class ClientLogger {
  error(_message: string, error?: unknown, context?: LogContext) {
    // Sanitize error data before logging
    const _safeContext = context
      ? (sanitizeLogEntry(context) as LogContext)
      : undefined;
    const _safeError = error ? sanitizeLogEntry({ error }).error : undefined;

    if (isDevelopment) {
    } else {
    }
  }

  warn(_message: string, _context?: LogContext) {
    if (isDevelopment) {
    }
  }

  info(_message: string, _context?: LogContext) {
    if (isDevelopment) {
    }
  }

  debug(_message: string, _context?: LogContext) {
    if (isDevelopment) {
    }
  }
}

export const clientLogger = new ClientLogger();
