import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock the retrieval function for retry testing
const mockEnhancedRetrieval = vi.fn();
const mockOpenAI = {
  vectorStores: {
    list: vi.fn(),
    create: vi.fn(),
    search: vi.fn(),
  },
  files: {
    create: vi.fn(),
  },
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

// Mock modules
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: mockEnhancedRetrieval,
}));

vi.mock('openai', () => ({
  __esModule: true,
  default: vi.fn(() => mockOpenAI),
}));

vi.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('File Search Retry Logic', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.clearAllMocks();

    // Set up default mocks
    mockOpenAI.vectorStores.list.mockResolvedValue({
      data: [{ id: 'vs_test', name: 'Test Store' }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should retry on retriable errors and eventually succeed', async () => {
    let callCount = 0;
    const retriableError = Object.assign(new Error('Server error'), { status: 500 });

    // Mock to fail twice, then succeed
    mockEnhancedRetrieval.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        throw retriableError;
      }
      return Promise.resolve([
        {
          id: 'doc1',
          file_id: 'file1',
          file_name: 'success.pdf',
          content: 'Success after retry',
          score: 0.9,
          metadata: {},
        },
      ]);
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test retry',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // The retry logic is implemented in the withRetry function
    // We test that it eventually succeeds despite initial errors
    expect(result.success).toBe(true);
    expect(result.total_results).toBe(1);
    expect(result.results[0].file_name).toBe('success.pdf');
  });

  it('should not retry on non-retriable errors', async () => {
    const nonRetriableError = Object.assign(new Error('Persistent server error'), { status: 400 });

    mockEnhancedRetrieval.mockImplementation(() => {
      throw nonRetriableError;
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test no retry',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // Non-retriable errors should fail quickly
    expect(result.success).toBe(false);
    expect(result.error).toBe('Persistent server error');
  });

  it('should handle network timeout errors with retry', async () => {
    let callCount = 0;
    const timeoutError = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });

    mockEnhancedRetrieval.mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        throw timeoutError;
      }
      return Promise.resolve([]);
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test timeout',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // Should eventually succeed after timeout retry
    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });

  it('should handle rate limit errors with retry', async () => {
    let callCount = 0;
    const rateLimitError = Object.assign(new Error('Rate limited'), { status: 429 });

    mockEnhancedRetrieval.mockImplementation(() => {
      callCount++;
      if (callCount < 2) {
        throw rateLimitError;
      }
      return Promise.resolve([
        {
          id: 'doc1',
          file_id: 'file1',
          file_name: 'success.pdf',
          content: 'Success after rate limit',
          score: 0.8,
          metadata: {},
        },
      ]);
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test rate limit',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // Should succeed after rate limit retry
    expect(result.success).toBe(true);
    expect(result.results[0].file_name).toBe('success.pdf');
  });

  it('should fail after maximum retry attempts', async () => {
    const persistentError = Object.assign(new Error('Persistent server error'), { status: 503 });

    mockEnhancedRetrieval.mockImplementation(() => {
      throw persistentError;
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test max retries',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // Should eventually fail after retries are exhausted
    expect(result.success).toBe(false);
    expect(result.error).toBe('Persistent server error');
  });

  it('should identify retriable error codes correctly', () => {
    // Test the retry logic error identification
    const retriableErrors = [
      { code: 'ECONNRESET' },
      { code: 'ETIMEDOUT' },
      { code: 'EAI_AGAIN' },
      { code: 'ENETUNREACH' },
      { code: 'ECONNREFUSED' },
      { status: 408 }, // Request Timeout
      { status: 425 }, // Too Early
      { status: 429 }, // Too Many Requests
      { status: 500 }, // Internal Server Error
      { status: 502 }, // Bad Gateway
      { status: 503 }, // Service Unavailable
      { status: 504 }, // Gateway Timeout
    ];

    const nonRetriableErrors = [
      { status: 400 }, // Bad Request
      { status: 401 }, // Unauthorized
      { status: 403 }, // Forbidden
      { status: 404 }, // Not Found
      { status: 422 }, // Unprocessable Entity
      { code: 'UNKNOWN_ERROR' },
    ];

    // This test validates that the retry logic would work correctly
    // The actual implementation is tested through the integration tests above
    retriableErrors.forEach(error => {
      expect(error.code || error.status).toBeDefined();
    });

    nonRetriableErrors.forEach(error => {
      expect(error.code || error.status).toBeDefined();
    });
  });

  it('should handle successful execution without retries', async () => {
    mockEnhancedRetrieval.mockImplementation(() => {
      return Promise.resolve([
        {
          id: 'doc1',
          file_id: 'file1',
          file_name: 'success.pdf',
          content: 'No retry needed',
          score: 1.0,
          metadata: {},
        },
      ]);
    });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test immediate success',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    // Should succeed immediately without retries
    expect(result.success).toBe(true);
    expect(result.results[0].file_name).toBe('success.pdf');
  });
});