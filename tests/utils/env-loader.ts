/**
 * Shared utility for loading environment variables in tests
 * Eliminates duplicate environment loading code across test files
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load environment variables from .env files
 * This replaces the duplicate loadEnv functions across test files
 */
export function loadTestEnvironment(): void {
  const envFiles = ['.env.local', '.env.test.local', '.env'];

  for (const file of envFiles) {
    const envPath = resolve(process.cwd(), file);

    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, 'utf-8');

      envContent.split('\n').forEach((line) => {
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          let value = valueParts.join('=');

          // Remove quotes if present
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }

          // Only set if not already defined
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
    }
  }
}

/**
 * Check if required environment variables are present
 */
export function validateTestEnvironment(requiredVars: string[]): {
  isValid: boolean;
  missingVars: string[];
} {
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(name: string, fallback?: string): string | undefined {
  return process.env[name] || fallback;
}

/**
 * Check if environment variable is set and non-empty
 */
export function hasEnvVar(name: string): boolean {
  return Boolean(process.env[name]);
}

/**
 * Load environment and validate required variables
 */
export function setupTestEnvironment(requiredVars: string[] = []): void {
  loadTestEnvironment();

  if (requiredVars.length > 0) {
    const validation = validateTestEnvironment(requiredVars);

    if (!validation.isValid) {
      console.warn(
        `Missing environment variables: ${validation.missingVars.join(', ')}`
      );
    }
  }
}

/**
 * Common environment variables for AI/ML tests
 */
export const COMMON_AI_ENV_VARS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
] as const;

/**
 * Common environment variables for database tests
 */
export const COMMON_DB_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
] as const;

/**
 * Setup environment for AI/ML tests
 */
export function setupAITestEnvironment(): void {
  setupTestEnvironment([...COMMON_AI_ENV_VARS]);
}

/**
 * Setup environment for database tests
 */
export function setupDatabaseTestEnvironment(): void {
  setupTestEnvironment([...COMMON_DB_ENV_VARS]);
}

/**
 * Setup environment for full integration tests
 */
export function setupIntegrationTestEnvironment(): void {
  setupTestEnvironment([...COMMON_AI_ENV_VARS, ...COMMON_DB_ENV_VARS]);
}
