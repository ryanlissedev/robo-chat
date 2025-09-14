import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { AIStreamHandler } from '@/lib/services/AIStreamHandler';
import { StreamingService } from '@/lib/services/StreamingService';
import type { LanguageModel, ToolSet } from 'ai';

// Mock StreamingService
vi.mock('@/lib/services/StreamingService', () => ({
  StreamingService: {
    createStreamingResponse: vi.fn(),
    createStreamingResponseWithFallback: vi.fn(),
  },
}));

describe('AIStreamHandler', () => {
  const mockLanguageModel = {
    modelId: 'gpt-4',
    specificationVersion: 'v1',
    provider: 'openai',
  } as LanguageModel;

  const mockTools: ToolSet = {
    file_search: {
      description: 'Search files',
      parameters: {},
    },
  };

  const baseStreamingParams = {
    languageModel: mockLanguageModel,
    effectiveSystemPrompt: 'You are a helpful assistant',
    modelMessages: [{ role: 'user', content: 'Hello' }] as any,
    tools: mockTools,
    isGPT5Model: false,
    chatId: 'chat-123',
    userId: 'user-123',
    resolvedModel: 'gpt-4',
    reasoningEffort: 'medium',
    enableSearch: true,
    supabase: null,
    messageGroupId: 'group-123',
    langsmithRunId: 'run-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStreamingResponse', () => {
    it('should call StreamingService.createStreamingResponse with correct parameters', async () => {
      const mockResponse = new Response('test');
      (StreamingService.createStreamingResponse as Mock).mockResolvedValue(
        mockResponse
      );

      const result =
        await AIStreamHandler.createStreamingResponse(baseStreamingParams);

      expect(StreamingService.createStreamingResponse).toHaveBeenCalledWith(
        mockLanguageModel,
        'You are a helpful assistant',
        [{ role: 'user', content: 'Hello' }],
        mockTools,
        false,
        'chat-123',
        'user-123',
        'gpt-4',
        'medium',
        true,
        null,
        'group-123',
        'run-123'
      );
      expect(result).toBe(mockResponse);
    });

    it('should handle GPT-5 model parameters', async () => {
      const mockResponse = new Response('test');
      (StreamingService.createStreamingResponse as Mock).mockResolvedValue(
        mockResponse
      );

      const gpt5Params = {
        ...baseStreamingParams,
        isGPT5Model: true,
        resolvedModel: 'gpt-5',
      };

      await AIStreamHandler.createStreamingResponse(gpt5Params);

      expect(StreamingService.createStreamingResponse).toHaveBeenCalledWith(
        mockLanguageModel,
        'You are a helpful assistant',
        [{ role: 'user', content: 'Hello' }],
        mockTools,
        true, // isGPT5Model
        'chat-123',
        'user-123',
        'gpt-5',
        'medium',
        true,
        null,
        'group-123',
        'run-123'
      );
    });

    it('should handle streaming response errors', async () => {
      const error = new Error('Streaming failed');
      (StreamingService.createStreamingResponse as Mock).mockRejectedValue(
        error
      );

      await expect(
        AIStreamHandler.createStreamingResponse(baseStreamingParams)
      ).rejects.toThrow('Streaming failed');
    });
  });

  describe('createStreamingResponseWithFallback', () => {
    const fallbackParams = {
      languageModel: mockLanguageModel,
      augmentedSystemPrompt: 'Augmented system prompt',
      modelMessages: [{ role: 'user', content: 'Hello' }] as any,
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
    };

    it('should call StreamingService.createStreamingResponseWithFallback with correct parameters', async () => {
      const mockResponse = new Response('test');
      (
        StreamingService.createStreamingResponseWithFallback as Mock
      ).mockResolvedValue(mockResponse);

      const result =
        await AIStreamHandler.createStreamingResponseWithFallback(
          fallbackParams
        );

      expect(
        StreamingService.createStreamingResponseWithFallback
      ).toHaveBeenCalledWith(
        mockLanguageModel,
        'Augmented system prompt',
        [{ role: 'user', content: 'Hello' }],
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
      expect(result).toBe(mockResponse);
    });

    it('should handle fallback streaming errors', async () => {
      const error = new Error('Fallback streaming failed');
      (
        StreamingService.createStreamingResponseWithFallback as Mock
      ).mockRejectedValue(error);

      await expect(
        AIStreamHandler.createStreamingResponseWithFallback(fallbackParams)
      ).rejects.toThrow('Fallback streaming failed');
    });

    it('should handle undefined apiKey', async () => {
      const mockResponse = new Response('test');
      (
        StreamingService.createStreamingResponseWithFallback as Mock
      ).mockResolvedValue(mockResponse);

      const paramsWithoutApiKey = {
        ...fallbackParams,
        apiKey: undefined,
      };

      await AIStreamHandler.createStreamingResponseWithFallback(
        paramsWithoutApiKey
      );

      expect(
        StreamingService.createStreamingResponseWithFallback
      ).toHaveBeenCalledWith(
        mockLanguageModel,
        'Augmented system prompt',
        [{ role: 'user', content: 'Hello' }],
        undefined,
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
    });
  });

  describe('handleStreamingError', () => {
    const errorContext = {
      chatId: 'chat-123',
      userId: 'user-123',
      resolvedModel: 'gpt-4',
      operation: 'streaming',
    };

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should handle Error instances with detailed error response', () => {
      const error = new Error('Test error message');

      const response = AIStreamHandler.handleStreamingError(
        error,
        errorContext
      );

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      // Test response body
      response.json().then((body) => {
        expect(body).toEqual({
          error: 'streaming_error',
          message: 'Test error message',
          details: {
            operation: 'streaming',
            model: 'gpt-4',
            timestamp: expect.any(String),
          },
        });
      });

      expect(console.error).toHaveBeenCalledWith(
        'Streaming error in streaming:',
        {
          error,
          chatId: 'chat-123',
          userId: 'user-123',
          model: 'gpt-4',
        }
      );
    });

    it('should handle unknown error types with generic message', () => {
      const error = 'Unknown error';

      const response = AIStreamHandler.handleStreamingError(
        error,
        errorContext
      );

      expect(response.status).toBe(500);

      response.json().then((body) => {
        expect(body.message).toBe(
          'An unexpected error occurred while processing your request'
        );
      });
    });

    it('should handle null/undefined errors', () => {
      const response = AIStreamHandler.handleStreamingError(null, errorContext);

      expect(response.status).toBe(500);
      response.json().then((body) => {
        expect(body.message).toBe(
          'An unexpected error occurred while processing your request'
        );
      });
    });

    it('should include timestamp in error response', () => {
      const error = new Error('Test error');
      const beforeTime = new Date().toISOString();

      const response = AIStreamHandler.handleStreamingError(
        error,
        errorContext
      );

      response.json().then((body) => {
        const timestamp = body.details.timestamp;
        expect(timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
        expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(beforeTime).getTime()
        );
      });
    });
  });

  describe('validateStreamingParameters', () => {
    const validParams = {
      languageModel: mockLanguageModel,
      modelMessages: [{ role: 'user', content: 'Hello' }],
      chatId: 'chat-123',
      userId: 'user-123',
      resolvedModel: 'gpt-4',
    };

    it('should not throw for valid parameters', () => {
      expect(() => {
        AIStreamHandler.validateStreamingParameters(validParams);
      }).not.toThrow();
    });

    it('should throw error when languageModel is missing', () => {
      const invalidParams = { ...validParams, languageModel: null as any };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('Language model is required for streaming');
    });

    it('should throw error when modelMessages is missing', () => {
      const invalidParams = { ...validParams, modelMessages: null };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('Model messages are required and cannot be empty');
    });

    it('should throw error when modelMessages is empty array', () => {
      const invalidParams = { ...validParams, modelMessages: [] };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('Model messages are required and cannot be empty');
    });

    it('should throw error when chatId is missing', () => {
      const invalidParams = { ...validParams, chatId: '' };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('Chat ID is required for streaming');
    });

    it('should throw error when userId is missing', () => {
      const invalidParams = { ...validParams, userId: '' };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('User ID is required for streaming');
    });

    it('should throw error when resolvedModel is missing', () => {
      const invalidParams = { ...validParams, resolvedModel: '' };

      expect(() => {
        AIStreamHandler.validateStreamingParameters(invalidParams);
      }).toThrow('Resolved model is required for streaming');
    });
  });

  describe('prepareStreamingConfig', () => {
    it('should return correct config for GPT-5 with tools enabled', () => {
      const config = AIStreamHandler.prepareStreamingConfig({
        isGPT5Model: true,
        reasoningEffort: 'high',
        enableSearch: true,
        tools: mockTools,
      });

      expect(config).toEqual({
        supportsStreaming: true,
        toolsEnabled: true,
        streamingOptions: {
          isGPT5Model: true,
          reasoningEffort: 'high',
          enableSearch: true,
          toolCount: 1,
        },
      });
    });

    it('should return correct config with search disabled', () => {
      const config = AIStreamHandler.prepareStreamingConfig({
        isGPT5Model: false,
        reasoningEffort: 'medium',
        enableSearch: false,
        tools: mockTools,
      });

      expect(config).toEqual({
        supportsStreaming: true,
        toolsEnabled: false,
        streamingOptions: {
          isGPT5Model: false,
          reasoningEffort: 'medium',
          enableSearch: false,
          toolCount: 1,
        },
      });
    });

    it('should return correct config with no tools', () => {
      const config = AIStreamHandler.prepareStreamingConfig({
        isGPT5Model: false,
        reasoningEffort: 'low',
        enableSearch: true,
        tools: {},
      });

      expect(config).toEqual({
        supportsStreaming: true,
        toolsEnabled: false,
        streamingOptions: {
          isGPT5Model: false,
          reasoningEffort: 'low',
          enableSearch: true,
          toolCount: 0,
        },
      });
    });

    it('should handle empty tools object', () => {
      const config = AIStreamHandler.prepareStreamingConfig({
        isGPT5Model: true,
        reasoningEffort: 'medium',
        enableSearch: true,
        tools: {},
      });

      expect(config.toolsEnabled).toBe(false);
      expect(config.streamingOptions.toolCount).toBe(0);
    });
  });
});
