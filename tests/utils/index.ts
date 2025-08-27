/**
 * Test utilities index - centralized exports for all test utilities
 * Provides a single import point for all test helpers, builders, and matchers
 */

// Export all mock factories
export * from './mock-factories';

// Export all test builders
export * from './test-builders';

// Import specific functions for internal use
import {
  cleanupMockEnvironment,
  createMockApiResponse,
  createMockChatMessage,
  createMockEnvironment,
  createMockError,
  createMockFile,
  createMockFileList,
  createMockLocalStorage,
  createMockSession,
  createMockStreamingResponse,
  createMockSupabaseClient,
  createMockUser,
  createMockWebSocket,
  resetAllMocks,
} from './mock-factories';

import {
  ChatMessageBuilder,
  ConversationBuilder,
  FileUploadBuilder,
  SessionBuilder,
  UserBuilder,
} from './test-builders';

export {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
// Re-export commonly used testing utilities
export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from 'vitest';
// Export custom matchers (they auto-register when imported)
export * from './custom-matchers';
// Export mock factories with shorter names for convenience
export {
  cleanupMockEnvironment,
  createMockApiResponse as mockApiResponse,
  createMockChatMessage as mockMessage,
  createMockEnvironment as mockEnvironment,
  createMockError as mockError,
  createMockFile as mockFile,
  createMockFileList as mockFileList,
  createMockLocalStorage as mockLocalStorage,
  createMockSession as mockSession,
  createMockStreamingResponse as mockStreamingResponse,
  createMockSupabaseClient as mockSupabase,
  createMockUser as mockUser,
  createMockWebSocket as mockWebSocket,
  resetAllMocks,
} from './mock-factories';
// Export test data builders with shorter names for convenience
export {
  ChatMessageBuilder as Message,
  ConversationBuilder as Conversation,
  FileUploadBuilder as FileUpload,
  SessionBuilder as Session,
  UserBuilder as User,
} from './test-builders';

// Test setup utilities
export const setupTest = {
  /**
   * Set up a clean test environment with common mocks
   */
  withMocks: () => {
    createMockEnvironment();
    return {
      supabase: createMockSupabaseClient({ isAuthenticated: false }),
      localStorage: createMockLocalStorage(),
    };
  },

  /**
   * Set up authenticated test environment
   */
  withAuth: (_userOverrides = {}) => {
    const user = UserBuilder.create().build();
    const session = SessionBuilder.withUser(user).build();
    const supabase = createMockSupabaseClient({
      user,
      session,
      isAuthenticated: true,
    });

    createMockEnvironment();

    return { user, session, supabase };
  },

  /**
   * Set up test with conversation data
   */
  withConversation: (messageCount = 5) => {
    const conversation = ConversationBuilder.simple().build();
    const messages = Array.from({ length: messageCount }, (_, i) =>
      ChatMessageBuilder.create()
        .withRole(i % 2 === 0 ? 'user' : 'assistant')
        .withContent(`Message ${i + 1}`)
        .build()
    );

    return { conversation: { ...conversation, messages }, messages };
  },

  /**
   * Clean up after test
   */
  cleanup: () => {
    resetAllMocks();
    cleanupMockEnvironment([
      'NODE_ENV',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ENCRYPTION_KEY',
    ]);
  },
};

// Test assertion helpers
export const assertions = {
  /**
   * Assert that an async function throws with specific error
   */
  async toThrowAsync<T>(
    asyncFn: () => Promise<T>,
    expectedError?: string | RegExp | Error
  ): Promise<void> {
    let error: Error | null = null;

    try {
      await asyncFn();
    } catch (e) {
      error = e as Error;
    }

    if (!error) {
      throw new Error('Expected function to throw, but it did not');
    }

    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error.message).toContain(expectedError);
      } else if (expectedError instanceof RegExp) {
        expect(error.message).toMatch(expectedError);
      } else if (expectedError instanceof Error) {
        expect(error.message).toBe(expectedError.message);
      }
    }
  },

  /**
   * Assert that a promise resolves within timeout
   */
  async toResolveWithin<T>(
    promise: Promise<T>,
    timeout: number = 5000
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Promise did not resolve within ${timeout}ms`)),
        timeout
      )
    );

    return Promise.race([promise, timeoutPromise]);
  },

  /**
   * Assert that multiple promises resolve in order
   */
  async toResolveInOrder<T>(promises: Array<Promise<T>>): Promise<T[]> {
    const results: T[] = [];
    const startTimes: number[] = [];

    // Start all promises and record start times
    const promisesWithTiming = promises.map((promise, index) => {
      startTimes[index] = Date.now();
      return promise.then((result) => {
        results[index] = result;
        return { result, index, resolveTime: Date.now() };
      });
    });

    const resolveOrder: number[] = [];
    for await (const { index } of promisesWithTiming) {
      resolveOrder.push(index);
    }

    // Verify they resolved in order
    for (let i = 1; i < resolveOrder.length; i++) {
      if (resolveOrder[i] < resolveOrder[i - 1]) {
        throw new Error(
          `Promises resolved out of order: expected ${resolveOrder[i - 1]} before ${resolveOrder[i]}`
        );
      }
    }

    return results;
  },
};

// Performance testing utilities
export const perfUtils = {
  /**
   * Measure execution time of a function
   */
  async measure<T>(
    fn: () => Promise<T> | T
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;

    return { result, duration };
  },

  /**
   * Assert that function executes within time limit
   */
  async expectWithinTime<T>(
    fn: () => Promise<T> | T,
    maxDuration: number
  ): Promise<T> {
    const { result, duration } = await this.measure(fn);

    if (duration > maxDuration) {
      throw new Error(
        `Function took ${duration.toFixed(2)}ms, expected less than ${maxDuration}ms`
      );
    }

    return result;
  },

  /**
   * Run function multiple times and get average execution time
   */
  async benchmark<T>(
    fn: () => Promise<T> | T,
    iterations: number = 10
  ): Promise<{ averageDuration: number; results: T[] }> {
    const results: T[] = [];
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measure(fn);
      results.push(result);
      durations.push(duration);
    }

    const averageDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    return { averageDuration, results };
  },
};

// Memory testing utilities
export const memory = {
  /**
   * Get current memory usage
   */
  getUsage(): NodeJS.MemoryUsage {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }

    // Fallback for browser environment
    return {
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0,
    };
  },

  /**
   * Assert that memory usage doesn't exceed threshold after function execution
   */
  async expectMemoryUsage<T>(
    fn: () => Promise<T> | T,
    maxHeapUsedMB: number = 100
  ): Promise<T> {
    const initialMemory = this.getUsage();
    const result = await fn();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = this.getUsage();
    const heapIncreaseMB =
      (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    if (heapIncreaseMB > maxHeapUsedMB) {
      throw new Error(
        `Memory usage increased by ${heapIncreaseMB.toFixed(2)}MB, ` +
          `expected less than ${maxHeapUsedMB}MB`
      );
    }

    return result;
  },
};

// Test data generators
export const generators = {
  /**
   * Generate random string of specified length
   */
  randomString(length: number = 10): string {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
  },

  /**
   * Generate random email
   */
  randomEmail(): string {
    return `${this.randomString(8)}@${this.randomString(5)}.com`;
  },

  /**
   * Generate random UUID v4
   */
  randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Generate array of test data
   */
  array<T>(generator: () => T, count: number = 5): T[] {
    return Array.from({ length: count }, generator);
  },

  /**
   * Generate random date within range
   */
  randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  },
};

// Export everything as default for convenience
export default {
  setupTest,
  assertions,
  performance: perfUtils,
  memory,
  generators,
  // Re-export builders and factories
  User: UserBuilder,
  Session: SessionBuilder,
  Message: ChatMessageBuilder,
  Conversation: ConversationBuilder,
  FileUpload: FileUploadBuilder,
  mockSupabase: createMockSupabaseClient,
  mockUser: createMockUser,
  mockSession: createMockSession,
  mockMessage: createMockChatMessage,
  mockApiResponse: createMockApiResponse,
  mockStreamingResponse: createMockStreamingResponse,
  mockFile: createMockFile,
  mockFileList: createMockFileList,
  mockError: createMockError,
  mockLocalStorage: createMockLocalStorage,
  mockWebSocket: createMockWebSocket,
  mockEnvironment: createMockEnvironment,
  resetAllMocks,
  cleanupMockEnvironment,
};
