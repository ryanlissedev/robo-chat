#!/usr/bin/env node

/**
 * Test script to verify the Pino logger works in development mode with pretty printing
 */

// Set environment to development BEFORE importing
process.env.NODE_ENV = 'development';

const path = require('path');

console.log('Testing Pino logger in development mode...');
console.log('Environment:', process.env.NODE_ENV);

try {
  // Import the fixed logger
  const loggerPath = path.join(__dirname, '..', 'lib', 'utils', 'logger.ts');
  
  // Use require to import TypeScript file (for testing)
  require('tsx/cjs');
  
  // Clear require cache to ensure fresh import with new NODE_ENV
  delete require.cache[require.resolve(loggerPath)];
  
  const logger = require(loggerPath).default;
  
  console.log('✅ Logger imported successfully in development mode');
  
  // Test basic logging functionality - should show pretty printed output
  logger.info('Test info message - should be pretty printed in development');
  logger.warn('Test warning message with colors');
  logger.error('Test error message');
  logger.debug('Test debug message (should be visible in dev mode)');
  
  // Test error logging function
  const { logError } = require(loggerPath);
  const testError = new Error('Test error for pretty logging');
  logError(testError, { context: 'development-test' });
  
  console.log('✅ Development mode logging working correctly');
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Development test failed:', error);
  process.exit(1);
}