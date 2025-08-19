import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  getOrCreateDefaultVectorStore,
  VectorStoreManager,
} from '../../lib/vector-store/manager';

/**
 * Vector Store Manager Unit Tests
 */

// Mock OpenAI
const mockOpenAI = {
  vectorStores: {
    list: mock(() => Promise.resolve({ data: [] })),
    create: mock(() =>
      Promise.resolve({ id: 'vs_test123', name: 'Test Store' })
    ),
    retrieve: mock(() =>
      Promise.resolve({ id: 'vs_test123', name: 'Test Store' })
    ),
    files: {
      create: mock(() => Promise.resolve({ id: 'file_test123' })),
    },
  },
  files: {
    create: mock(() => Promise.resolve({ id: 'file_test123' })),
  },
};

mock.module('openai', () => ({
  default: mock(() => mockOpenAI),
}));

describe('VectorStoreManager', () => {
  let manager: VectorStoreManager;

  beforeEach(() => {
    // Reset all mocks
    Object.values(mockOpenAI.vectorStores).forEach((mockFn) => {
      if (typeof mockFn === 'function') mockFn.mockClear();
    });
    mockOpenAI.vectorStores.files.create.mockClear();
    mockOpenAI.files.create.mockClear();

    manager = new VectorStoreManager('sk-test123');
  });

  test('should create default vector store when none exists', async () => {
    // Given: No existing vector stores
    (mockOpenAI.vectorStores.list as any).mockResolvedValue({ data: [] });
    (mockOpenAI.vectorStores.create as any).mockResolvedValue({
      id: 'vs_roborail123',
      name: 'RoboRail Documentation',
    });

    // When: Getting or creating default vector store
    const vectorStoreId = await manager.getOrCreateDefaultVectorStore();

    // Then: Should create new vector store
    expect(mockOpenAI.vectorStores.list).toHaveBeenCalledWith({ limit: 10 });
    expect(mockOpenAI.vectorStores.create).toHaveBeenCalledWith({
      name: 'RoboRail Documentation',
      metadata: expect.objectContaining({
        purpose: 'roborail_docs',
        created_by: 'roborail_assistant',
      }),
      chunking_strategy: {
        type: 'static',
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        },
      },
    });
    expect(vectorStoreId).toBe('vs_roborail123');
  });

  test('should return existing vector store when found', async () => {
    // Given: Existing RoboRail vector store
    (mockOpenAI.vectorStores.list as any).mockResolvedValue({
      data: [
        {
          id: 'vs_existing123',
          name: 'RoboRail Documentation',
          metadata: { purpose: 'roborail_docs' },
        },
      ],
    });

    // When: Getting or creating default vector store
    const vectorStoreId = await manager.getOrCreateDefaultVectorStore();

    // Then: Should return existing vector store
    expect(mockOpenAI.vectorStores.create).not.toHaveBeenCalled();
    expect(vectorStoreId).toBe('vs_existing123');
  });

  test('should create custom vector store with configuration', async () => {
    // Given: Custom vector store configuration
    const config = {
      name: 'Custom Documentation',
      fileIds: ['file_1', 'file_2'],
      metadata: { type: 'custom', version: '1.0' },
    };

    mockOpenAI.vectorStores.create.mockResolvedValue({
      id: 'vs_custom123',
      name: config.name,
    });

    // When: Creating custom vector store
    const vectorStoreId = await manager.createVectorStore(config);

    // Then: Should create vector store with custom config
    expect(mockOpenAI.vectorStores.create).toHaveBeenCalledWith({
      name: config.name,
      file_ids: config.fileIds,
      metadata: expect.objectContaining({
        type: 'custom',
        version: '1.0',
        created_at: expect.any(String),
      }),
      chunking_strategy: {
        type: 'static',
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 400,
        },
      },
    });
    expect(vectorStoreId).toBe('vs_custom123');
  });

  test('should add files to existing vector store', async () => {
    // Given: Vector store and file IDs
    const vectorStoreId = 'vs_test123';
    const fileIds = ['file_1', 'file_2'];

    (mockOpenAI.vectorStores.files.create as any).mockResolvedValue({ id: 'file_1' });

    // When: Adding files to vector store
    await manager.addFilesToVectorStore(vectorStoreId, fileIds);

    // Then: Should add each file to vector store
    expect(mockOpenAI.vectorStores.files.create).toHaveBeenCalledTimes(2);
    expect(mockOpenAI.vectorStores.files.create).toHaveBeenCalledWith(
      vectorStoreId,
      {
        file_id: 'file_1',
      }
    );
    expect(mockOpenAI.vectorStores.files.create).toHaveBeenCalledWith(
      vectorStoreId,
      {
        file_id: 'file_2',
      }
    );
  });

  test('should handle errors gracefully', async () => {
    // Given: OpenAI API error
    mockOpenAI.vectorStores.list.mockRejectedValue(new Error('API Error'));

    // When/Then: Should throw meaningful error
    await expect(manager.getOrCreateDefaultVectorStore()).rejects.toThrow(
      'Failed to get or create vector store'
    );
  });
});

describe('getOrCreateDefaultVectorStore utility', () => {
  test('should create and return default vector store', async () => {
    // Given: API key
    const apiKey = 'sk-test123';

    (mockOpenAI.vectorStores.list as any).mockResolvedValue({ data: [] });
    (mockOpenAI.vectorStores.create as any).mockResolvedValue({
      id: 'vs_default123',
      name: 'RoboRail Documentation',
    });

    // When: Using utility function
    const vectorStoreId = await getOrCreateDefaultVectorStore(apiKey);

    // Then: Should return vector store ID
    expect(vectorStoreId).toBe('vs_default123');
  });
});
