import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks to ensure stable references
const enhancedRetrievalMock = vi.fn();
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: enhancedRetrievalMock,
}));
vi.mock('openai', () => ({
  __esModule: true,
  default: class OpenAI {
    vectorStores = { list: vi.fn().mockResolvedValue({ data: [] }), create: vi.fn().mockResolvedValue({ id: 'vs_mock', name: 'Mock' }) };
    files = { create: vi.fn() };
    constructor(..._args: any[]) {}
  },
}));

describe('fileSearchTool retry/backoff', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // no timers manipulation
  });

  it('retries retriable errors and eventually succeeds', async () => {
    enhancedRetrievalMock.mockReset();
    let calls = 0;
    const retriable = Object.assign(new Error('Server error'), { status: 500 });
    enhancedRetrievalMock
      .mockImplementationOnce(() => { calls++; return Promise.reject(retriable); })
      .mockImplementationOnce(() => { calls++; return Promise.reject(retriable); })
      .mockImplementationOnce(() => { calls++; return Promise.resolve([] as any); });

    const { fileSearchTool } = await import('@/lib/tools/file-search');
    const exec = (fileSearchTool as any).execute as Function;
    const result = await exec(
      {
        query: 'hello',
        vector_store_id: 'vs_123',
        enable_rewriting: false,
        enable_reranking: false,
        max_results: 3,
      },
      {}
    );

    expect(calls).toBe(3);
    expect(result.success).toBe(true);
    expect(result.total_results).toBe(0);
  });

  it('does not retry on non-retriable error and returns failure payload', async () => {
    enhancedRetrievalMock.mockReset();
    let calls = 0;
    const nonRetriable = Object.assign(new Error('Bad request'), { status: 400 });
    enhancedRetrievalMock
      .mockImplementationOnce(() => { calls++; return Promise.reject(nonRetriable); });

    const { fileSearchTool } = await import('@/lib/tools/file-search');
    const exec = (fileSearchTool as any).execute as Function;
    const result = await exec(
      {
        query: 'hello',
        vector_store_id: 'vs_123',
        enable_rewriting: false,
        enable_reranking: false,
      },
      {}
    );

    expect(calls).toBe(1);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
