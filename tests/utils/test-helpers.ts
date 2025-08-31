/**
 * Shared test utilities and patterns
 * Eliminates duplicate test setup code across test files
 */

import { loadTestEnvironment } from './env-loader';

export interface MockFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface RequestLog {
  url: string;
  method: string;
  test: string;
  timestamp: number;
}

/**
 * Mock fetch implementation for testing
 */
export class MockFetch {
  private logs: RequestLog[] = [];
  private currentTest = 'unknown';

  constructor() {
    this.setupMock();
  }

  setCurrentTest(testName: string): void {
    this.currentTest = testName;
  }

  getLogs(): RequestLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  private setupMock(): void {
    global.fetch = this.mockFetch.bind(this);
  }

  private mockFetch(
    url: string,
    options: MockFetchOptions = {}
  ): Promise<Response> {
    this.logs.push({
      url,
      method: options.method || 'GET',
      test: this.currentTest,
      timestamp: Date.now(),
    });

    // Return a mock response
    return Promise.resolve(
      new Response(
        JSON.stringify({
          success: true,
          data: 'mock response',
          url,
          method: options.method || 'GET',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
  }
}

/**
 * Common test setup for AI provider tests
 */
export function setupProviderTest(provider: string): {
  apiKey: string | undefined;
  isConfigured: boolean;
} {
  loadTestEnvironment();

  const envKeyMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    groq: 'GROQ_API_KEY',
    perplexity: 'PERPLEXITY_API_KEY',
  };

  const envKey = envKeyMap[provider.toLowerCase()];
  const apiKey = process.env[envKey];

  return {
    apiKey,
    isConfigured: Boolean(apiKey),
  };
}

/**
 * Create OpenAI client configuration for tests
 */
export function createTestOpenAIConfig(
  options: { baseURL?: string; apiKey?: string; provider?: string } = {}
) {
  return {
    baseURL: options.baseURL || 'https://api.openai.com/v1',
    apiKey: options.apiKey || process.env.OPENAI_API_KEY || 'test-key',
    headers: {
      'X-Provider': options.provider || 'openai',
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Common gateway configuration for tests
 */
export function getTestGatewayConfig() {
  const gatewayEnabled = process.env.AI_GATEWAY_ENABLED === 'true';
  const gatewayBaseURL =
    process.env.AI_GATEWAY_BASE_URL || 'http://localhost:3000/api/gateway';
  const gatewayApiKey = process.env.AI_GATEWAY_API_KEY || 'test-gateway-key';

  return {
    enabled: gatewayEnabled,
    baseURL: gatewayBaseURL,
    apiKey: gatewayApiKey,
  };
}

/**
 * Test result formatter
 */
export interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration?: number;
  data?: any;
}

export function formatTestResults(results: TestResult[]): void {
  console.log('\n=== Test Results Summary ===');

  const passed = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Passed: ${passed.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed.length > 0) {
    console.log('\n=== Failed Tests ===');
    failed.forEach((result) => {
      console.log(`❌ ${result.name}: ${result.error}`);
    });
  }

  console.log('='.repeat(30));
}

/**
 * Async test runner with timeout
 */
export async function runTestWithTimeout<T>(
  testFn: () => Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    testFn()
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Common test patterns for API endpoints
 */
export class APITestHelper {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(
    baseURL: string = 'http://localhost:3000',
    headers: Record<string, string> = {}
  ) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  async testEndpoint(
    path: string,
    method: string = 'GET',
    body?: any,
    expectedStatus: number = 200
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: this.defaultHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      const duration = Date.now() - startTime;
      const data = await response.json();

      if (response.status !== expectedStatus) {
        return {
          name: `${method} ${path}`,
          success: false,
          error: `Expected status ${expectedStatus}, got ${response.status}`,
          duration,
          data,
        };
      }

      return {
        name: `${method} ${path}`,
        success: true,
        duration,
        data,
      };
    } catch (error) {
      return {
        name: `${method} ${path}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }
}

/**
 * Utility to skip tests when environment is not configured
 */
export function skipIfNotConfigured(
  envVars: string[],
  testName: string
): boolean {
  const missing = envVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.log(`⏭️  Skipping ${testName} - missing: ${missing.join(', ')}`);
    return true;
  }

  return false;
}
