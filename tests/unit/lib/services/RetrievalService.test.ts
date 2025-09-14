import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { RetrievalService } from '@/lib/services/RetrievalService';
import {
  RETRIEVAL_MAX_TOKENS,
  RETRIEVAL_TOP_K,
  RETRIEVAL_TWO_PASS_ENABLED,
} from '@/lib/config';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';
import {
  selectRetrievalMode,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';
import { StreamingService } from '@/lib/services/StreamingService';
import logger from '@/lib/utils/logger';
import type { LanguageModel } from 'ai';

// Mock dependencies
vi.mock('@/lib/config', () => ({
  RETRIEVAL_MAX_TOKENS: 4000,
  RETRIEVAL_TOP_K: 10,
  RETRIEVAL_TWO_PASS_ENABLED: true,
}));

vi.mock('@/lib/retrieval/augment', () => ({
  buildAugmentedSystemPrompt: vi.fn(),
}));

vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: vi.fn(),
  shouldUseFallbackRetrieval: vi.fn(),
}));

vi.mock('@/lib/retrieval/two-pass', () => ({
  retrieveWithGpt41: vi.fn(),
}));

vi.mock('@/lib/retrieval/vector-retrieval', () => ({
  performVectorRetrieval: vi.fn(),
}));

vi.mock('@/lib/services/StreamingService', () => ({
  StreamingService: {
    createStreamingResponseWithFallback: vi.fn(),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RetrievalService', () => {
  const mockLanguageModel = {
    modelId: 'gpt-4',
    provider: 'openai',
  } as LanguageModel;

  const mockMessages = [
    {
      id: '1',
      role: 'user',
      content: 'What is machine learning?',
      createdAt: new Date(),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Machine learning is...',
      createdAt: new Date(),
    },
  ] as any;

  const mockRetrievedChunks = [
    {
      fileId: 'file-1',
      fileName: 'ml-basics.txt',
      score: 0.95,
      content: 'Machine learning is a subset of AI...',
      url: 'http://example.com/ml-basics.txt',
    },
    {
      fileId: 'file-2',
      fileName: 'ai-overview.txt',
      score: 0.87,
      content: 'Artificial intelligence encompasses...',
    },
  ];

  const baseFallbackParams = {
    compatibleMessages: mockMessages,
    languageModel: mockLanguageModel,
    effectiveSystemPrompt: 'You are a helpful assistant',
    apiKey: 'test-key',
    modelSettings: { temperature: 0.7 },
    modelConfig: { provider: 'openai' },
    chatId: 'chat-123',
    userId: 'user-123',
    resolvedModel: 'gpt-4',
    isGPT5Model: false,
    reasoningEffort: 'medium',
    enableSearch: true,
    supabase: null,
    messageGroupId: 'group-123',
    langsmithRunId: 'run-123',
    messages: mockMessages,
    precomputedModelMessages: [{ role: 'user', content: 'What is machine learning?' }] as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (shouldUseFallbackRetrieval as Mock).mockReturnValue(true);
    (selectRetrievalMode as Mock).mockReturnValue('two-pass');
    (retrieveWithGpt41 as Mock).mockResolvedValue(mockRetrievedChunks);
    (performVectorRetrieval as Mock).mockResolvedValue(mockRetrievedChunks);
    (buildAugmentedSystemPrompt as Mock).mockReturnValue('Augmented system prompt with context');
    (StreamingService.createStreamingResponseWithFallback as Mock).mockResolvedValue(
      new Response('streaming response')
    );
  });

  describe('shouldUseFallbackRetrieval', () => {
    it('should return result from shouldUseFallbackRetrieval function', () => {
      (shouldUseFallbackRetrieval as Mock).mockReturnValue(false);

      const result = RetrievalService.shouldUseFallbackRetrieval(true, false);

      expect(shouldUseFallbackRetrieval).toHaveBeenCalledWith(true, false);
      expect(result).toBe(false);
    });

    it('should handle search enabled with model support', () => {
      (shouldUseFallbackRetrieval as Mock).mockReturnValue(true);

      const result = RetrievalService.shouldUseFallbackRetrieval(true, true);

      expect(shouldUseFallbackRetrieval).toHaveBeenCalledWith(true, true);
      expect(result).toBe(true);
    });

    it('should handle search disabled', () => {
      (shouldUseFallbackRetrieval as Mock).mockReturnValue(false);

      const result = RetrievalService.shouldUseFallbackRetrieval(false, true);

      expect(result).toBe(false);
    });
  });

  describe('handleFallbackRetrieval', () => {
    it('should perform two-pass retrieval when enabled', async () => {
      (selectRetrievalMode as Mock).mockReturnValue('two-pass');

      const response = await RetrievalService.handleFallbackRetrieval(baseFallbackParams);

      expect(selectRetrievalMode).toHaveBeenCalledWith(RETRIEVAL_TWO_PASS_ENABLED);
      expect(retrieveWithGpt41).toHaveBeenCalledWith(
        'What is machine learning?',
        mockMessages,
        { topK: RETRIEVAL_TOP_K }
      );
      expect(buildAugmentedSystemPrompt).toHaveBeenCalledWith(
        'You are a helpful assistant',
        mockRetrievedChunks,
        { budgetTokens: RETRIEVAL_MAX_TOKENS }
      );
      expect(StreamingService.createStreamingResponseWithFallback).toHaveBeenCalledWith(
        mockLanguageModel,
        'Augmented system prompt with context',
        baseFallbackParams.precomputedModelMessages,
        'test-key',
        { temperature: 0.7 },
        { provider: 'openai' },
        'chat-123',
        'user-123',
        'gpt-4',
        false,
        'medium',
        true,
        null,
        'group-123',
        'run-123'
      );
      expect(response).toBeInstanceOf(Response);
    });

    it('should perform vector retrieval when two-pass is disabled', async () => {
      (selectRetrievalMode as Mock).mockReturnValue('vector');

      await RetrievalService.handleFallbackRetrieval(baseFallbackParams);

      expect(performVectorRetrieval).toHaveBeenCalledWith(
        'What is machine learning?',
        { topK: RETRIEVAL_TOP_K }
      );
      expect(retrieveWithGpt41).not.toHaveBeenCalled();
    });

    it('should fallback to vector retrieval when two-pass fails', async () => {
      (selectRetrievalMode as Mock).mockReturnValue('two-pass');
      (retrieveWithGpt41 as Mock).mockRejectedValue(new Error('Two-pass failed'));

      await RetrievalService.handleFallbackRetrieval(baseFallbackParams);

      expect(logger.warn).toHaveBeenCalledWith(
        { at: 'fallbackRetrieval', error: expect.any(Error) },
        'two-pass retrieval failed; falling back to vector retrieval'
      );
      expect(performVectorRetrieval).toHaveBeenCalledWith(
        'What is machine learning?',
        { topK: RETRIEVAL_TOP_K }
      );
    });

    it('should handle messages with string content', async () => {
      const stringContentMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Simple string content',
          createdAt: new Date(),
        },
      ] as any;

      const paramsWithStringContent = {
        ...baseFallbackParams,
        messages: stringContentMessages,
      };

      await RetrievalService.handleFallbackRetrieval(paramsWithStringContent);

      expect(retrieveWithGpt41).toHaveBeenCalledWith(
        'Simple string content',
        stringContentMessages,
        { topK: RETRIEVAL_TOP_K }
      );
    });

    it('should handle messages with array content', async () => {
      const arrayContentMessages = [
        {
          id: '1',
          role: 'user',
          content: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' },
            { type: 'image', url: 'http://example.com/image.jpg' },
          ],
          createdAt: new Date(),
        },
      ] as any;

      const paramsWithArrayContent = {
        ...baseFallbackParams,
        messages: arrayContentMessages,
      };

      await RetrievalService.handleFallbackRetrieval(paramsWithArrayContent);

      expect(retrieveWithGpt41).toHaveBeenCalledWith(
        'First part Second part',
        arrayContentMessages,
        { topK: RETRIEVAL_TOP_K }
      );
    });

    it('should handle empty messages gracefully', async () => {
      const emptyMessagesParams = {
        ...baseFallbackParams,
        messages: [],
      };

      await RetrievalService.handleFallbackRetrieval(emptyMessagesParams);

      expect(retrieveWithGpt41).toHaveBeenCalledWith('', [], { topK: RETRIEVAL_TOP_K });
    });

    it('should handle non-user last message', async () => {
      const assistantLastMessages = [
        {
          id: '1',
          role: 'assistant',
          content: 'Assistant message',
          createdAt: new Date(),
        },
      ] as any;

      const assistantLastParams = {
        ...baseFallbackParams,
        messages: assistantLastMessages,
      };

      await RetrievalService.handleFallbackRetrieval(assistantLastParams);

      expect(retrieveWithGpt41).toHaveBeenCalledWith('', assistantLastMessages, { topK: RETRIEVAL_TOP_K });
    });

    it('should handle undefined apiKey', async () => {
      const noApiKeyParams = {
        ...baseFallbackParams,
        apiKey: undefined,
      };

      await RetrievalService.handleFallbackRetrieval(noApiKeyParams);

      expect(StreamingService.createStreamingResponseWithFallback).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.any(Object),
        undefined,
        expect.any(Object),
        expect.any(Object),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Boolean),
        expect.any(String),
        expect.any(Boolean),
        null,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should handle GPT-5 models', async () => {
      const gpt5Params = {
        ...baseFallbackParams,
        isGPT5Model: true,
        resolvedModel: 'gpt-5',
      };

      await RetrievalService.handleFallbackRetrieval(gpt5Params);

      expect(StreamingService.createStreamingResponseWithFallback).toHaveBeenCalledWith(
        mockLanguageModel,
        'Augmented system prompt with context',
        baseFallbackParams.precomputedModelMessages,
        'test-key',
        { temperature: 0.7 },
        { provider: 'openai' },
        'chat-123',
        'user-123',
        'gpt-5',
        true, // isGPT5Model
        'medium',
        true,
        null,
        'group-123',
        'run-123'
      );
    });
  });

  describe('performVectorRetrieval', () => {
    it('should perform vector retrieval with default options', async () => {
      const result = await RetrievalService.performVectorRetrieval('test query');

      expect(performVectorRetrieval).toHaveBeenCalledWith('test query', { topK: RETRIEVAL_TOP_K });
      expect(result).toBe(mockRetrievedChunks);
    });

    it('should perform vector retrieval with custom topK', async () => {
      await RetrievalService.performVectorRetrieval('test query', { topK: 5 });

      expect(performVectorRetrieval).toHaveBeenCalledWith('test query', { topK: 5 });
    });

    it('should handle retrieval errors', async () => {
      (performVectorRetrieval as Mock).mockRejectedValue(new Error('Retrieval failed'));

      await expect(RetrievalService.performVectorRetrieval('test query')).rejects.toThrow('Retrieval failed');
    });

    it('should handle empty query', async () => {
      await RetrievalService.performVectorRetrieval('');

      expect(performVectorRetrieval).toHaveBeenCalledWith('', { topK: RETRIEVAL_TOP_K });
    });
  });

  describe('performTwoPassRetrieval', () => {
    it('should perform two-pass retrieval with default options', async () => {
      const result = await RetrievalService.performTwoPassRetrieval('test query', mockMessages);

      expect(retrieveWithGpt41).toHaveBeenCalledWith('test query', mockMessages, { topK: RETRIEVAL_TOP_K });
      expect(result).toBe(mockRetrievedChunks);
    });

    it('should perform two-pass retrieval with custom topK', async () => {
      await RetrievalService.performTwoPassRetrieval('test query', mockMessages, { topK: 5 });

      expect(retrieveWithGpt41).toHaveBeenCalledWith('test query', mockMessages, { topK: 5 });
    });

    it('should handle retrieval errors', async () => {
      (retrieveWithGpt41 as Mock).mockRejectedValue(new Error('Two-pass failed'));

      await expect(
        RetrievalService.performTwoPassRetrieval('test query', mockMessages)
      ).rejects.toThrow('Two-pass failed');
    });

    it('should handle empty messages', async () => {
      await RetrievalService.performTwoPassRetrieval('test query', []);

      expect(retrieveWithGpt41).toHaveBeenCalledWith('test query', [], { topK: RETRIEVAL_TOP_K });
    });
  });

  describe('buildAugmentedSystemPrompt', () => {
    it('should build augmented system prompt with default budget', () => {
      const result = RetrievalService.buildAugmentedSystemPrompt(
        'Base prompt',
        mockRetrievedChunks
      );

      expect(buildAugmentedSystemPrompt).toHaveBeenCalledWith(
        'Base prompt',
        mockRetrievedChunks,
        { budgetTokens: RETRIEVAL_MAX_TOKENS }
      );
      expect(result).toBe('Augmented system prompt with context');
    });

    it('should build augmented system prompt with custom budget', () => {
      RetrievalService.buildAugmentedSystemPrompt(
        'Base prompt',
        mockRetrievedChunks,
        { budgetTokens: 2000 }
      );

      expect(buildAugmentedSystemPrompt).toHaveBeenCalledWith(
        'Base prompt',
        mockRetrievedChunks,
        { budgetTokens: 2000 }
      );
    });

    it('should handle empty retrieved chunks', () => {
      RetrievalService.buildAugmentedSystemPrompt('Base prompt', []);

      expect(buildAugmentedSystemPrompt).toHaveBeenCalledWith(
        'Base prompt',
        [],
        { budgetTokens: RETRIEVAL_MAX_TOKENS }
      );
    });

    it('should handle empty base prompt', () => {
      RetrievalService.buildAugmentedSystemPrompt('', mockRetrievedChunks);

      expect(buildAugmentedSystemPrompt).toHaveBeenCalledWith(
        '',
        mockRetrievedChunks,
        { budgetTokens: RETRIEVAL_MAX_TOKENS }
      );
    });
  });

  describe('selectRetrievalMode', () => {
    it('should select retrieval mode with default two-pass enabled', () => {
      (selectRetrievalMode as Mock).mockReturnValue('two-pass');

      const result = RetrievalService.selectRetrievalMode();

      expect(selectRetrievalMode).toHaveBeenCalledWith(RETRIEVAL_TWO_PASS_ENABLED);
      expect(result).toBe('two-pass');
    });

    it('should select retrieval mode with custom two-pass setting', () => {
      (selectRetrievalMode as Mock).mockReturnValue('vector');

      const result = RetrievalService.selectRetrievalMode(false);

      expect(selectRetrievalMode).toHaveBeenCalledWith(false);
      expect(result).toBe('vector');
    });

    it('should handle true two-pass enabled parameter', () => {
      RetrievalService.selectRetrievalMode(true);

      expect(selectRetrievalMode).toHaveBeenCalledWith(true);
    });
  });

  describe('logRetrievalOperation', () => {
    beforeEach(() => {
      vi.spyOn(RetrievalService, 'logRetrievalOperation');
    });

    it('should log retrieval operation successfully', () => {
      RetrievalService.logRetrievalOperation('search', 'test query', 5, 'vector');

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'retrieval.operation',
          operation: 'search',
          queryLength: 10,
          retrievedCount: 5,
          mode: 'vector',
        },
        'retrieval operation completed'
      );
    });

    it('should log two-pass retrieval operation', () => {
      RetrievalService.logRetrievalOperation('search', 'longer test query', 8, 'two-pass');

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'retrieval.operation',
          operation: 'search',
          queryLength: 17,
          retrievedCount: 8,
          mode: 'two-pass',
        },
        'retrieval operation completed'
      );
    });

    it('should handle logging errors gracefully', () => {
      (logger.info as Mock).mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      expect(() => {
        RetrievalService.logRetrievalOperation('search', 'test', 1, 'vector');
      }).not.toThrow();
    });

    it('should handle empty query', () => {
      RetrievalService.logRetrievalOperation('search', '', 0, 'vector');

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'retrieval.operation',
          operation: 'search',
          queryLength: 0,
          retrievedCount: 0,
          mode: 'vector',
        },
        'retrieval operation completed'
      );
    });

    it('should handle zero retrieved count', () => {
      RetrievalService.logRetrievalOperation('search', 'no results query', 0, 'vector');

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'retrieval.operation',
          operation: 'search',
          queryLength: 16,
          retrievedCount: 0,
          mode: 'vector',
        },
        'retrieval operation completed'
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle streaming service errors in fallback retrieval', async () => {
      (StreamingService.createStreamingResponseWithFallback as Mock).mockRejectedValue(
        new Error('Streaming failed')
      );

      await expect(RetrievalService.handleFallbackRetrieval(baseFallbackParams)).rejects.toThrow('Streaming failed');
    });

    it('should handle system prompt augmentation errors', async () => {
      (buildAugmentedSystemPrompt as Mock).mockImplementation(() => {
        throw new Error('Augmentation failed');
      });

      await expect(RetrievalService.handleFallbackRetrieval(baseFallbackParams)).rejects.toThrow('Augmentation failed');
    });

    it('should handle both retrieval methods failing', async () => {
      (selectRetrievalMode as Mock).mockReturnValue('two-pass');
      (retrieveWithGpt41 as Mock).mockRejectedValue(new Error('Two-pass failed'));
      (performVectorRetrieval as Mock).mockRejectedValue(new Error('Vector failed'));

      await expect(RetrievalService.handleFallbackRetrieval(baseFallbackParams)).rejects.toThrow('Vector failed');
    });

    it('should handle malformed message content', async () => {
      const malformedMessages = [
        {
          id: '1',
          role: 'user',
          content: { invalid: 'content structure' },
          createdAt: new Date(),
        },
      ] as any;

      const malformedParams = {
        ...baseFallbackParams,
        messages: malformedMessages,
      };

      await RetrievalService.handleFallbackRetrieval(malformedParams);

      // Should extract empty string from malformed content
      expect(retrieveWithGpt41).toHaveBeenCalledWith('', malformedMessages, { topK: RETRIEVAL_TOP_K });
    });
  });
});