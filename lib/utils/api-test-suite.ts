/**
 * Comprehensive API test suite for backend validation
 * This utility helps verify all API endpoints are functioning correctly
 */

import { NextRequest } from 'next/server';

export interface APITestResult {
  endpoint: string;
  method: string;
  status: 'success' | 'error' | 'warning';
  statusCode?: number;
  responseTime?: number;
  error?: string;
  details?: unknown;
}

export interface APITestSuite {
  name: string;
  baseUrl: string;
  tests: APITest[];
}

export interface APITest {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: unknown;
  expectedStatus?: number;
  skipTest?: boolean;
  timeout?: number;
}

/**
 * API endpoint test configurations
 */
export const API_TEST_SUITES: APITestSuite[] = [
  {
    name: 'Authentication & Authorization',
    baseUrl: '/api',
    tests: [
      {
        name: 'Health check',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
      },
      {
        name: 'CSRF token generation',
        endpoint: '/csrf',
        method: 'GET',
        expectedStatus: 200,
      },
      {
        name: 'Guest user preferences (GET)',
        endpoint: '/user-preferences',
        method: 'GET',
        headers: {
          'x-guest-user': 'true',
        },
        expectedStatus: 200,
      },
      {
        name: 'Guest user preferences (PUT)',
        endpoint: '/user-preferences',
        method: 'PUT',
        headers: {
          'x-guest-user': 'true',
          'content-type': 'application/json',
        },
        body: {
          layout: 'sidebar',
          prompt_suggestions: false,
        },
        expectedStatus: 200,
      },
    ],
  },
  {
    name: 'User Preferences',
    baseUrl: '/api',
    tests: [
      {
        name: 'Get favorite models (guest)',
        endpoint: '/user-preferences/favorite-models',
        method: 'GET',
        headers: {
          'x-guest-user': 'true',
        },
        expectedStatus: 200,
      },
      {
        name: 'Update favorite models (guest)',
        endpoint: '/user-preferences/favorite-models',
        method: 'POST',
        headers: {
          'x-guest-user': 'true',
          'content-type': 'application/json',
        },
        body: {
          favorite_models: ['gpt-4o', 'claude-3.5-sonnet'],
        },
        expectedStatus: 200,
      },
    ],
  },
  {
    name: 'Projects & Data',
    baseUrl: '/api',
    tests: [
      {
        name: 'Get projects (guest)',
        endpoint: '/projects',
        method: 'GET',
        headers: {
          'x-guest-user': 'true',
        },
        expectedStatus: 200,
      },
      {
        name: 'Create project (guest)',
        endpoint: '/projects',
        method: 'POST',
        headers: {
          'x-guest-user': 'true',
          'content-type': 'application/json',
        },
        body: {
          name: 'Test Project',
        },
        expectedStatus: 200,
      },
      {
        name: 'Get user key status',
        endpoint: '/user-key-status',
        method: 'GET',
        expectedStatus: 200,
      },
      {
        name: 'Get rate limits',
        endpoint: '/rate-limits',
        method: 'GET',
        expectedStatus: 400, // Missing userId parameter
      },
    ],
  },
  {
    name: 'Models & Providers',
    baseUrl: '/api',
    tests: [
      {
        name: 'Get available models',
        endpoint: '/models',
        method: 'GET',
        expectedStatus: 200,
      },
      {
        name: 'Get providers',
        endpoint: '/providers',
        method: 'GET',
        expectedStatus: 200,
      },
    ],
  },
  {
    name: 'Security Tests',
    baseUrl: '/api',
    tests: [
      {
        name: 'Rate limiting test',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        skipTest: true, // Would require multiple rapid requests
      },
      {
        name: 'Invalid JSON test',
        endpoint: '/user-preferences',
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
        },
        body: 'invalid json',
        expectedStatus: 400,
        skipTest: true, // Would require special handling
      },
      {
        name: 'CORS test',
        endpoint: '/health',
        method: 'OPTIONS',
        expectedStatus: 204,
      },
    ],
  },
];

/**
 * Execute a single API test
 */
export async function executeAPITest(
  test: APITest,
  baseUrl: string = ''
): Promise<APITestResult> {
  const startTime = Date.now();
  const fullUrl = `${baseUrl}${test.endpoint}`;

  try {
    if (test.skipTest) {
      return {
        endpoint: test.endpoint,
        method: test.method,
        status: 'warning',
        error: 'Test skipped',
      };
    }

    const requestInit: RequestInit = {
      method: test.method,
      headers: {
        'User-Agent': 'API-Test-Suite/1.0',
        ...test.headers,
      },
    };

    if (test.body && ['POST', 'PUT', 'PATCH'].includes(test.method)) {
      if (typeof test.body === 'string') {
        requestInit.body = test.body;
      } else {
        requestInit.body = JSON.stringify(test.body);
        if (!requestInit.headers) requestInit.headers = {};
        (requestInit.headers as Record<string, string>)['content-type'] = 'application/json';
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), test.timeout || 10000);

    requestInit.signal = controller.signal;

    const response = await fetch(fullUrl, requestInit);
    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const isSuccess = test.expectedStatus
      ? response.status === test.expectedStatus
      : response.status >= 200 && response.status < 300;

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return {
      endpoint: test.endpoint,
      method: test.method,
      status: isSuccess ? 'success' : 'error',
      statusCode: response.status,
      responseTime,
      details: responseData,
      ...(test.expectedStatus && response.status !== test.expectedStatus
        ? { error: `Expected ${test.expectedStatus}, got ${response.status}` }
        : {}),
    };
  } catch (error) {
    return {
      endpoint: test.endpoint,
      method: test.method,
      status: 'error',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a complete test suite
 */
export async function executeTestSuite(
  suite: APITestSuite,
  options: {
    baseUrl?: string;
    concurrent?: boolean;
    stopOnError?: boolean;
  } = {}
): Promise<{
  suiteName: string;
  results: APITestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    totalTime: number;
  };
}> {
  const startTime = Date.now();
  const { baseUrl = '', concurrent = false, stopOnError = false } = options;

  let results: APITestResult[];

  if (concurrent) {
    // Execute all tests concurrently
    const promises = suite.tests.map(test =>
      executeAPITest(test, baseUrl + suite.baseUrl)
    );
    results = await Promise.all(promises);
  } else {
    // Execute tests sequentially
    results = [];
    for (const test of suite.tests) {
      const result = await executeAPITest(test, baseUrl + suite.baseUrl);
      results.push(result);

      if (stopOnError && result.status === 'error') {
        break;
      }
    }
  }

  const totalTime = Date.now() - startTime;
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length,
    warnings: results.filter(r => r.status === 'warning').length,
    totalTime,
  };

  return {
    suiteName: suite.name,
    results,
    summary,
  };
}

/**
 * Execute all test suites
 */
export async function executeAllTestSuites(
  options: {
    baseUrl?: string;
    concurrent?: boolean;
    stopOnError?: boolean;
  } = {}
): Promise<{
  suites: Awaited<ReturnType<typeof executeTestSuite>>[];
  overallSummary: {
    totalSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalWarnings: number;
    totalTime: number;
  };
}> {
  const startTime = Date.now();
  const suiteResults = [];

  for (const suite of API_TEST_SUITES) {
    const result = await executeTestSuite(suite, options);
    suiteResults.push(result);

    if (options.stopOnError && result.summary.failed > 0) {
      break;
    }
  }

  const overallSummary = {
    totalSuites: suiteResults.length,
    totalTests: suiteResults.reduce((sum, suite) => sum + suite.summary.total, 0),
    totalPassed: suiteResults.reduce((sum, suite) => sum + suite.summary.passed, 0),
    totalFailed: suiteResults.reduce((sum, suite) => sum + suite.summary.failed, 0),
    totalWarnings: suiteResults.reduce((sum, suite) => sum + suite.summary.warnings, 0),
    totalTime: Date.now() - startTime,
  };

  return {
    suites: suiteResults,
    overallSummary,
  };
}

/**
 * Format test results for console output
 */
export function formatTestResults(
  results: Awaited<ReturnType<typeof executeAllTestSuites>>
): string {
  let output = '=== API Test Suite Results ===\n\n';

  for (const suite of results.suites) {
    output += `📁 ${suite.suiteName}\n`;
    output += `   Tests: ${suite.summary.total} | ✅ ${suite.summary.passed} | ❌ ${suite.summary.failed} | ⚠️  ${suite.summary.warnings}\n`;
    output += `   Time: ${suite.summary.totalTime}ms\n\n`;

    for (const result of suite.results) {
      const statusIcon = result.status === 'success' ? '✅' :
                         result.status === 'error' ? '❌' : '⚠️';

      output += `   ${statusIcon} ${result.method} ${result.endpoint}`;

      if (result.statusCode) {
        output += ` (${result.statusCode})`;
      }

      if (result.responseTime) {
        output += ` - ${result.responseTime}ms`;
      }

      if (result.error) {
        output += ` - ${result.error}`;
      }

      output += '\n';
    }

    output += '\n';
  }

  output += '=== Overall Summary ===\n';
  output += `Suites: ${results.overallSummary.totalSuites}\n`;
  output += `Tests: ${results.overallSummary.totalTests}\n`;
  output += `✅ Passed: ${results.overallSummary.totalPassed}\n`;
  output += `❌ Failed: ${results.overallSummary.totalFailed}\n`;
  output += `⚠️  Warnings: ${results.overallSummary.totalWarnings}\n`;
  output += `⏱️  Total Time: ${results.overallSummary.totalTime}ms\n`;

  const successRate = results.overallSummary.totalTests > 0
    ? ((results.overallSummary.totalPassed / results.overallSummary.totalTests) * 100).toFixed(1)
    : '0';

  output += `📊 Success Rate: ${successRate}%\n`;

  return output;
}