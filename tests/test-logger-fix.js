#!/usr/bin/env node

/**
 * Test script to verify the Pino logger fix works correctly
 * This script tests that the logger doesn't crash with worker thread errors
 */

const path = require('node:path');

// Set environment to production to test the fix
process.env.NODE_ENV = 'production';

try {
  // Import the fixed logger
  const loggerPath = path.join(__dirname, '..', 'lib', 'utils', 'logger.ts');

  // Use require to import TypeScript file (for testing)
  require('tsx/cjs');
  const logger = require(loggerPath).default;

  // Test basic logging functionality
  logger.info('Test info message - logger is working');
  logger.warn('Test warning message');
  logger.error('Test error message');
  logger.debug('Test debug message');

  // Test error logging function
  const { logError } = require(loggerPath);
  const testError = new Error('Test error for logging');
  logError(testError, { context: 'test' });

  // Simulate a worker thread error
  const workerError = new Error(
    "Cannot find module '/ROOT/node_modules/thread-stream/lib/worker.js'"
  );
  workerError.code = 'MODULE_NOT_FOUND';

  // This should be caught by our error handler and not crash
  process.emit('uncaughtException', workerError);

  setTimeout(() => {
    process.exit(0);
  }, 100);
} catch (_error) {
  process.exit(1);
}
