import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the retrieval module with specific behavior for retry testing
const enhancedRetrievalMock = vi.fn();
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: enhancedRetrievalMock,
}));

// Override the global OpenAI mock for retry testing
const mockOpenAIInstance = {
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

vi.mock('openai', () => ({
  __esModule: true,
  default: vi.fn(() => mockOpenAIInstance),
}));

describe.sequential('fileSearchTool retry/backoff', () => {
  beforeEach(async () => {
    // Set environment variable
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    // Clear all mocks
    vi.clearAllMocks();
    enhancedRetrievalMock.mockReset();

    // Set up default mocks
    mockOpenAIInstance.vectorStores.list.mockResolvedValue({
      data: [{ id: 'vs_123', name: 'Test Store' }],
    });
    mockOpenAIInstance.vectorStores.create.mockResolvedValue({
      id: 'vs_new',
      name: 'New Store',
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      return Promise.resolve([
        {
          id: 'doc1',
          file_id: 'file1',
          file_name: 'test.pdf',
          content: 'Test document content',
          score: 0.9,
          metadata: {},
        },
      ]);
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
    expect(result.total_results).toBe(1);
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
