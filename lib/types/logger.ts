/**
 * Type definitions for logging functionality
 */

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}

export interface LoggerInterface {
  error(message: string, error?: unknown, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: unknown;
}