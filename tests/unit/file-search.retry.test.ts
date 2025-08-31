import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks to ensure stable references
const enhancedRetrievalMock = vi.fn();
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: enhancedRetrievalMock,
}));
vi.mock('openai', () => ({
  __esModule: true,
  default: class OpenAI {
    vectorStores = {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'vs_mock', name: 'Mock' }),
    };
    files = { create: vi.fn() };
  },
}));

describe.sequential('fileSearchTool retry/backoff', () => {
  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    enhancedRetrievalMock.mockReset();
    vi.clearAllMocks();
    // Clear module cache to ensure fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('retries retriable errors and eventually succeeds', async () => {
    let calls = 0;
    const retriable = Object.assign(new Error('Server error'), { status: 500 });

    // Mock the function to track calls and simulate retry behavior
    enhancedRetrievalMock.mockImplementation(() => {
      calls++;
      if (calls < 3) {
        throw retriable;
      }
      return Promise.resolve([]);
    });

    const { file_search } = await import('@/lib/tools/file-search');
    const result = await file_search.execute({
      query: 'hello',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
      max_results: 3,
    });

    expect(calls).toBe(3);
    expect(result.success).toBe(true);
    expect(result.total_results).toBe(0);
  });

  it('does not retry on non-retriable error and returns failure payload', async () => {
    let calls = 0;
    const nonRetriable = Object.assign(new Error('Bad request'), {
      status: 400,
    });

    // Mock the function to throw non-retriable error immediately
    enhancedRetrievalMock.mockImplementation(() => {
      calls++;
      throw nonRetriable;
    });

    const { file_search } = await import('@/lib/tools/file-search');
    const result = await file_search.execute({
      query: 'hello',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(calls).toBe(1);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toBe('Bad request');
  });
});
