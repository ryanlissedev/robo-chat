const isDevelopment = process.env.NODE_ENV === 'development';

interface LogContext {
  [key: string]: any;
}

class ClientLogger {
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (isDevelopment) {
      console.error(this.formatMessage('ERROR', message, context), error);
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