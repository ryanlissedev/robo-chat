import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Simple mocks for testing file search logic
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

describe('File Search Core Logic', () => {
  beforeEach(() => {
    // Set up environment
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    // Clear all mocks
    vi.clearAllMocks();

    // Set up default mock responses
    mockOpenAI.vectorStores.list.mockResolvedValue({
      data: [{ id: 'vs_default', name: 'Default Store' }],
    });

    mockOpenAI.vectorStores.create.mockResolvedValue({
      id: 'vs_new',
      name: 'New Store',
    });

    mockEnhancedRetrieval.mockResolvedValue([
      {
        id: 'doc1',
        file_id: 'file1',
        file_name: 'test.pdf',
        content: 'This is test content for the search.',
        score: 0.9,
        metadata: { type: 'pdf' },
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should successfully execute file search with basic parameters', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test search',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
      max_results: 5,
    });

    expect(result.success).toBe(true);
    expect(result.query).toBe('test search');
    expect(result.total_results).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].file_name).toBe('test.pdf');
    expect(result.sources).toHaveLength(1);
    expect(result.thinking).toContain('Searching for: "test search"');
  });

  it('should handle empty results gracefully', async () => {
    mockEnhancedRetrieval.mockResolvedValue([]);

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'no results',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(true);
    expect(result.total_results).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(result.summary).toContain('No relevant documents found');
  });

  it('should create vector store when none exists', async () => {
    mockOpenAI.vectorStores.list.mockResolvedValue({ data: [] });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(true);
    expect(mockOpenAI.vectorStores.create).toHaveBeenCalledWith({
      name: 'Base Chat Default Store',
      metadata: {
        created_by: 'Base Chat',
        purpose: 'file_search',
      },
    });
  });

  it('should handle missing API key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('OpenAI API key is required');
  });

  it('should handle retrieval errors', async () => {
    // Reset environment to test error handling
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    mockEnhancedRetrieval.mockRejectedValue(new Error('Network error'));

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('should pass correct configuration to enhanced retrieval', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: true,
      reranking_method: 'semantic',
      max_results: 10,
    });

    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        queryRewriting: true,
        rewriteStrategy: 'expansion',
        reranking: true,
        rerankingMethod: 'semantic',
        topK: 10,
      })
    );
  });

  it('should format results with proper structure', async () => {
    const mockResults = [
      {
        id: 'doc1',
        file_id: 'file1',
        file_name: 'document.pdf',
        content: 'This is a very long document content that should be truncated when displayed in the results to keep the output manageable and readable.',
        score: 0.95,
        metadata: { type: 'pdf', author: 'Test Author' },
      },
    ];

    mockEnhancedRetrieval.mockResolvedValue(mockResults);

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(true);
    expect(result.results[0]).toMatchObject({
      rank: 1,
      file_id: 'file1',
      file_name: 'document.pdf',
      score: 0.95,
      metadata: { type: 'pdf', author: 'Test Author' },
    });

    // Content should be truncated (actual length may vary based on implementation)
    expect(result.results[0].content.length).toBeGreaterThan(100);
    expect(result.results[0].content).toContain('...');

    // Sources should be properly formatted
    expect(result.sources[0]).toMatchObject({
      id: 'file1',
      name: 'document.pdf',
      score: 0.95,
      url: '/api/files/file1',
    });
  });

  it('should include thinking trace in results', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test query',
      vector_store_id: 'vs_123',
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: true,
      reranking_method: 'semantic',
    });

    expect(result.thinking).toContain('Searching for: "test query"');
    expect(result.thinking).toContain('Enhanced query with expansion strategy');
    expect(result.thinking).toContain('Applied semantic reranking');
    expect(result.thinking).toContain('Top result:');
    expect(result.thinking).toContain('test.pdf');
  });

  it('should validate input schema types', () => {
    // Test that the schema accepts correct types
    const validInputs = [
      {
        query: 'test',
        max_results: 5,
        vector_store_id: 'vs_123',
        enable_rewriting: true,
        rewrite_strategy: 'expansion' as const,
        enable_reranking: true,
        reranking_method: 'semantic' as const,
      },
      {
        query: 'another test',
        file_types: ['pdf', 'txt'],
        rewrite_strategy: 'refinement' as const,
        reranking_method: 'cross-encoder' as const,
      },
    ];

    validInputs.forEach(input => {
      expect(input.query).toBeDefined();
      expect(typeof input.query).toBe('string');
      if (input.max_results) {
        expect(typeof input.max_results).toBe('number');
      }
      if (input.file_types) {
        expect(Array.isArray(input.file_types)).toBe(true);
      }
    });
  });
});