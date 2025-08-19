import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type OpenAI from 'openai';
import { enhancedRetrieval } from '../../../lib/retrieval/query-rewriting';

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: mock(() =>
        Promise.resolve({ choices: [{ message: { content: 'test' } }] })
      ),
    },
  },
  beta: {
    assistants: {
      create: mock(() => Promise.resolve({ id: 'asst_test123' })),
      delete: mock(() => Promise.resolve()),
    },
    threads: {
      create: mock(() => Promise.resolve({ id: 'thread_test123' })),
      runs: {
        create: mock(() =>
          Promise.resolve({ id: 'run_test123', status: 'completed' })
        ),
        retrieve: mock(() =>
          Promise.resolve({ id: 'run_test123', status: 'completed' })
        ),
      },
      messages: {
        list: mock(() => Promise.resolve({ data: [] })),
      },
    },
  },
} as unknown as OpenAI;

describe('enhancedRetrieval', () => {
  beforeEach(() => {
    // Reset all mocks
    (mockOpenAI.beta.assistants.create as any).mockClear();
    (mockOpenAI.beta.assistants.delete as any).mockClear();
    (mockOpenAI.beta.threads.create as any).mockClear();
    (mockOpenAI.beta.threads.runs.create as any).mockClear();
    (mockOpenAI.beta.threads.runs.retrieve as any).mockClear();
    (mockOpenAI.beta.threads.messages.list as any).mockClear();
  });

  describe('when using OpenAI Assistants API for file search', () => {
    test('should use OpenAI Assistants API instead of non-existent vectorStores.search', async () => {
      // Arrange
      const query = 'How to operate RoboRail?';
      const vectorStoreId = 'vs_test123';

      // Mock assistant creation
      (mockOpenAI.beta.assistants.create as any).mockResolvedValue({
        id: 'asst_test123',
      });

      // Mock thread creation
      (mockOpenAI.beta.threads.create as any).mockResolvedValue({
        id: 'thread_test123',
      });

      // Mock run creation
      (mockOpenAI.beta.threads.runs.create as any).mockResolvedValue({
        id: 'run_test123',
        status: 'completed',
      });

      // Mock run retrieval
      (mockOpenAI.beta.threads.runs.retrieve as any).mockResolvedValue({
        id: 'run_test123',
        status: 'completed',
      });

      // Mock messages list
      (mockOpenAI.beta.threads.messages.list as any).mockResolvedValue({
        data: [
          {
            id: 'msg_test123',
            content: [
              {
                type: 'text',
                text: {
                  value: 'RoboRail operation instructions...',
                  annotations: [
                    {
                      type: 'file_citation',
                      text: '[1]',
                      file_citation: {
                        file_id: 'file_test123',
                        quote: 'operation instructions',
                      },
                    },
                  ],
                },
              },
            ],
            role: 'assistant',
          },
        ],
      });

      // Act
      const results = await enhancedRetrieval(query, vectorStoreId, mockOpenAI);

      // Assert
      expect(mockOpenAI.beta.assistants.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      });

      expect(mockOpenAI.beta.threads.create).toHaveBeenCalledWith({
        messages: [
          {
            role: 'user',
            content: query,
          },
        ],
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: expect.any(String),
        content: expect.stringContaining('operation instructions'),
        score: expect.any(Number),
        file_id: 'file_test123',
      });
    });

    test('should handle errors gracefully and return empty results', async () => {
      // Arrange
      const query = 'test query';
      const vectorStoreId = 'vs_test123';

      (mockOpenAI.beta.assistants.create as any).mockRejectedValue(
        new Error('API key invalid')
      );

      // Act
      const results = await enhancedRetrieval(query, vectorStoreId, mockOpenAI);

      // Assert
      expect(results).toEqual([]);
    });

    test('should extract file citations from assistant responses', async () => {
      // Arrange
      const query = 'safety procedures';
      const vectorStoreId = 'vs_test123';

      (mockOpenAI.beta.assistants.create as any).mockResolvedValue({
        id: 'asst_test123',
      });

      (mockOpenAI.beta.threads.create as any).mockResolvedValue({
        id: 'thread_test123',
      });

      (mockOpenAI.beta.threads.runs.create as any).mockResolvedValue({
        id: 'run_test123',
        status: 'completed',
      });

      (mockOpenAI.beta.threads.runs.retrieve as any).mockResolvedValue({
        id: 'run_test123',
        status: 'completed',
      });

      (mockOpenAI.beta.threads.messages.list as any).mockResolvedValue({
        data: [
          {
            id: 'msg_test123',
            content: [
              {
                type: 'text',
                text: {
                  value:
                    'Safety procedures include: 1. Check equipment [1] 2. Verify clearance [2]',
                  annotations: [
                    {
                      type: 'file_citation',
                      text: '[1]',
                      file_citation: {
                        file_id: 'file_safety123',
                        quote: 'equipment check procedures',
                      },
                    },
                    {
                      type: 'file_citation',
                      text: '[2]',
                      file_citation: {
                        file_id: 'file_clearance123',
                        quote: 'clearance verification steps',
                      },
                    },
                  ],
                },
              },
            ],
            role: 'assistant',
          },
        ],
      });

      // Act
      const results = await enhancedRetrieval(query, vectorStoreId, mockOpenAI);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].file_id).toBe('file_safety123');
      expect(results[1].file_id).toBe('file_clearance123');
      expect(results[0].content).toContain('equipment check procedures');
      expect(results[1].content).toContain('clearance verification steps');
    });
  });
});
