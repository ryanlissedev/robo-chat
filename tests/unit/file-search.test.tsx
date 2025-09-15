import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock the retrieval module with specific behavior
const mockEnhancedRetrieval = vi.fn();
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: mockEnhancedRetrieval,
}));

// Override the global OpenAI mock for this test file
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

describe('File Search Tool', () => {
  beforeEach(async () => {
    // Set environment variable
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    // Clear all mocks
    vi.clearAllMocks();

    // Configure default mock responses
    mockOpenAIInstance.vectorStores.list.mockResolvedValue({
      data: [{ id: 'vs_test', name: 'Test Store' }],
    });

    mockOpenAIInstance.vectorStores.create.mockResolvedValue({
      id: 'vs_new',
      name: 'New Store',
    });

    // Default enhanced retrieval response
    mockEnhancedRetrieval.mockResolvedValue([
      {
        id: 'doc1',
        file_id: 'file1',
        file_name: 'test.pdf',
        content: 'This is a test document with relevant information.',
        score: 0.95,
        metadata: { fileType: 'pdf' },
      },
      {
        id: 'doc2',
        file_id: 'file2',
        file_name: 'example.txt',
        content: 'Another document with some content.',
        score: 0.85,
        metadata: { fileType: 'txt' },
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('should successfully search with query rewriting enabled', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test search',
      vector_store_id: 'vs_123',
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: false,
      max_results: 5,
    });

    expect(result.success).toBe(true);
    expect(result.total_results).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].file_name).toBe('test.pdf');
    expect(result.summary).toContain('Found 2 relevant documents');
    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test search',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        queryRewriting: true,
        rewriteStrategy: 'expansion',
        reranking: false,
        topK: 5,
      })
    );
  });

  it('should work with query rewriting disabled', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'simple search',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: true,
      reranking_method: 'semantic',
      max_results: 3,
    });

    expect(result.success).toBe(true);
    expect(result.total_results).toBe(2);
    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'simple search',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        queryRewriting: false,
        reranking: true,
        rerankingMethod: 'semantic',
        topK: 3,
      })
    );
  });

  it('should handle file type filtering', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      file_types: ['pdf'],
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(true);
    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        metadataFilters: { fileTypes: ['pdf'] },
      })
    );
  });

  it('should create vector store when none exists', async () => {
    mockOpenAIInstance.vectorStores.list.mockResolvedValue({ data: [] });

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      enable_rewriting: false,
      enable_reranking: false,
    });

    expect(result.success).toBe(true);
    expect(mockOpenAIInstance.vectorStores.create).toHaveBeenCalledWith({
      name: 'Base Chat Default Store',
      metadata: {
        created_by: 'Base Chat',
        purpose: 'file_search',
      },
    });
    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test',
      'vs_new',
      expect.any(Object),
      expect.any(Object)
    );
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

  it('should handle missing API key error', async () => {
    // Temporarily unset the API key
    vi.stubEnv('OPENAI_API_KEY', '');

    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('OpenAI API key is required');

    // Restore the API key for other tests
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
  });

  it('should handle retrieval errors gracefully', async () => {
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

  it('should support different reranking methods', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    // Test cross-encoder reranking
    await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: true,
      reranking_method: 'cross-encoder',
    });

    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        rerankingMethod: 'cross-encoder',
      })
    );

    // Test diversity reranking
    await file_search.execute({
      query: 'test',
      vector_store_id: 'vs_123',
      enable_rewriting: false,
      enable_reranking: true,
      reranking_method: 'diversity',
    });

    expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
      'test',
      'vs_123',
      expect.any(Object),
      expect.objectContaining({
        rerankingMethod: 'diversity',
      })
    );
  });

  it('should support different rewrite strategies', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const strategies = ['expansion', 'refinement', 'decomposition', 'multi-perspective'] as const;

    for (const strategy of strategies) {
      mockEnhancedRetrieval.mockClear();

      await file_search.execute({
        query: 'test',
        vector_store_id: 'vs_123',
        enable_rewriting: true,
        rewrite_strategy: strategy,
        enable_reranking: false,
      });

      expect(mockEnhancedRetrieval).toHaveBeenCalledWith(
        'test',
        'vs_123',
        expect.any(Object),
        expect.objectContaining({
          rewriteStrategy: strategy,
        })
      );
    }
  });

  it('should format results correctly with sources and thinking', async () => {
    const { file_search } = await import('@/lib/tools/file-search');

    const result = await file_search.execute({
      query: 'test search',
      vector_store_id: 'vs_123',
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: true,
      reranking_method: 'semantic',
    });

    expect(result.success).toBe(true);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toMatchObject({
      id: 'file1',
      name: 'test.pdf',
      score: 0.95,
      url: '/api/files/file1',
    });

    expect(result.thinking).toContain('Searching for: "test search"');
    expect(result.thinking).toContain('Enhanced query with expansion strategy');
    expect(result.thinking).toContain('Applied semantic reranking');
    expect(result.thinking).toContain('Top result: test.pdf');

    expect(result.search_config).toMatchObject({
      vector_store_id: 'vs_123',
      query_rewriting: true,
      rewrite_strategy: 'expansion',
      reranking: true,
      reranking_method: 'semantic',
    });
  });
});