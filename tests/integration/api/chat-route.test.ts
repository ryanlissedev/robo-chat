import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from 'vitest';

// Set up environment variables before any imports
process.env.ENCRYPTION_KEY = Buffer.from('test'.repeat(8)).toString('base64');
process.env.NODE_ENV = 'test';

// Mock the AI SDK streamText function
vi.mock('ai', () => ({
  convertToModelMessages: vi.fn().mockReturnValue([
    {
      role: 'user',
      content: [{ type: 'text', text: 'Hello, world!' }],
    },
  ]),
  streamText: vi.fn().mockImplementation((options) => {
    const mockResult = {
      toUIMessageStreamResponse: vi.fn().mockReturnValue(
        new Response('mocked stream response', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      ),
    };

    // Simulate calling onFinish callback if provided
    if (options?.onFinish) {
      setTimeout(() => {
        options.onFinish({
          response: {
            messages: [
              {
                role: 'assistant',
                content: 'Mocked response',
              },
            ],
            usage: {
              totalTokens: 100,
              inputTokens: 50,
              outputTokens: 50,
            },
          },
        });
      }, 0);
    }
    return mockResult;
  }),
}));

// Mock external modules
vi.mock('@/lib/models');
vi.mock('@/lib/langsmith/client');
vi.mock('@/app/api/chat/api');
vi.mock('@/lib/user-keys');
vi.mock('@/lib/openproviders/provider-map');
vi.mock('@/lib/utils/metrics');
vi.mock('@/lib/tools/file-search', () => ({
  fileSearchTool: {
    name: 'fileSearch',
    description: 'Search files',
    parameters: {},
  },
}));

// Mock retrieval modules
vi.mock('@/lib/retrieval/augment', () => ({
  buildAugmentedSystemPrompt: vi.fn(() => 'augmented system prompt'),
}));

vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: vi.fn(() => 'simple'),
  shouldEnableFileSearchTools: vi.fn(() => false),
  shouldUseFallbackRetrieval: vi.fn(() => false),
}));

vi.mock('@/lib/retrieval/vector-retrieval', () => ({
  performVectorRetrieval: vi.fn(() => Promise.resolve([])),
}));

vi.mock('@/lib/retrieval/two-pass', () => ({
  retrieveWithGpt41: vi.fn(() => Promise.resolve([])),
}));

// Mock config constants
vi.mock('@/lib/config', () => ({
  FILE_SEARCH_SYSTEM_PROMPT: 'File search system prompt',
  RETRIEVAL_MAX_TOKENS: 4000,
  RETRIEVAL_TOP_K: 5,
  RETRIEVAL_TWO_PASS_ENABLED: false,
  SYSTEM_PROMPT_DEFAULT: 'You are a helpful assistant.',
}));

// Import modules after mocks are set up
import * as chatApiModule from '@/app/api/chat/api';
import { POST } from '@/app/api/chat/route';
import * as langsmithModule from '@/lib/langsmith/client';
import * as modelsModule from '@/lib/models';
import * as providerMapModule from '@/lib/openproviders/provider-map';
import * as userKeysModule from '@/lib/user-keys';
import * as metricsModule from '@/lib/utils/metrics';

describe('Chat API Route', () => {
  const mockGetAllModels = modelsModule.getAllModels as MockedFunction<
    typeof modelsModule.getAllModels
  >;
  const mockValidateAndTrackUsage =
    chatApiModule.validateAndTrackUsage as MockedFunction<
      typeof chatApiModule.validateAndTrackUsage
    >;
  const mockGetProviderForModel =
    providerMapModule.getProviderForModel as MockedFunction<
      typeof providerMapModule.getProviderForModel
    >;
  const mockGetEffectiveApiKey =
    userKeysModule.getEffectiveApiKey as MockedFunction<
      typeof userKeysModule.getEffectiveApiKey
    >;
  const mockTrackCredentialUsage =
    metricsModule.trackCredentialUsage as MockedFunction<
      typeof metricsModule.trackCredentialUsage
    >;
  const mockIncrementMessageCount =
    chatApiModule.incrementMessageCount as MockedFunction<
      typeof chatApiModule.incrementMessageCount
    >;
  const mockLogUserMessage = chatApiModule.logUserMessage as MockedFunction<
    typeof chatApiModule.logUserMessage
  >;
  const mockStoreAssistantMessage =
    chatApiModule.storeAssistantMessage as MockedFunction<
      typeof chatApiModule.storeAssistantMessage
    >;

  const mockSupabaseClient = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    const mockLanguageModel = {
      generateText: vi.fn(),
      streamText: vi.fn(),
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };

    mockGetAllModels.mockResolvedValue([
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        providerId: 'openai',
        provider: 'openai',
        baseProviderId: 'openai',
        apiSdk: vi.fn().mockImplementation(() => mockLanguageModel),
        fileSearchTools: true,
        reasoningText: true,
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        providerId: 'openai',
        provider: 'openai',
        baseProviderId: 'openai',
        apiSdk: vi.fn().mockImplementation(() => mockLanguageModel),
        fileSearchTools: true,
      },
    ]);

    mockValidateAndTrackUsage.mockResolvedValue(mockSupabaseClient as any);
    mockGetProviderForModel.mockReturnValue('openai');
    mockGetEffectiveApiKey.mockResolvedValue('mock-api-key');
    mockTrackCredentialUsage.mockResolvedValue();
    mockIncrementMessageCount.mockResolvedValue();
    mockLogUserMessage.mockResolvedValue();
    mockStoreAssistantMessage.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function for creating valid requests - accessible to all tests
  const createValidRequest = (overrides = {}) => {
    const defaultBody = {
      messages: [
        {
          role: 'user',
          content: 'Hello, world!',
          id: 'msg-1',
          createdAt: new Date(),
        },
      ],
      chatId: 'chat-123',
      userId: 'user-456',
      model: 'gpt-4o-mini',
      isAuthenticated: true,
      systemPrompt: 'You are a helpful assistant.',
      enableSearch: false,
      reasoningEffort: 'medium',
      ...overrides,
    };

    return new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultBody),
    });
  };

  describe('POST /api/chat', () => {
    it('should successfully process a valid chat request', async () => {
      const request = createValidRequest();

      const response = await POST(request);

      // Debug the error if status is not 200
      if (response.status !== 200) {
        const _errorText = await response.text();
      }

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(mockValidateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-456',
        model: 'gpt-5-mini', // gpt-4o-mini gets resolved to gpt-5-mini
        isAuthenticated: true,
        hasGuestCredentials: false,
      });
    });

    it('should handle GPT-5 model resolution', async () => {
      const request = createValidRequest({ model: 'gpt-4o-mini' });
      await POST(request);

      expect(mockGetAllModels).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const request = createValidRequest({ messages: [] });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('missing or invalid messages');
    });

    it('should validate chatId and userId', async () => {
      const request = createValidRequest({ chatId: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.error).toContain('missing chatId or userId');
    });

    it('should handle guest credentials from headers', async () => {
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provider-Api-Key': 'guest-api-key',
          'X-Model-Provider': 'openai',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'chat-123',
          userId: 'guest-user',
          model: 'gpt-4o-mini',
          isAuthenticated: false,
          systemPrompt: 'Test',
          enableSearch: false,
        }),
      });

      await POST(request);

      expect(mockValidateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'guest-user',
        model: 'gpt-5-mini', // gpt-4o-mini gets resolved to gpt-5-mini
        isAuthenticated: false,
        hasGuestCredentials: true,
      });
    });

    it('should handle chat context with personality mode', async () => {
      const request = createValidRequest({
        context: 'chat',
        personalityMode: 'technical-expert',
      });

      await POST(request);
      expect(mockValidateAndTrackUsage).toHaveBeenCalled();
    });

    it('should configure tools for GPT-5 models with search enabled', async () => {
      mockGetAllModels.mockResolvedValue([
        {
          id: 'gpt-5-mini',
          name: 'GPT-5 Mini',
          providerId: 'openai',
          provider: 'openai',
          baseProviderId: 'openai',
          apiSdk: vi.fn().mockReturnValue({}),
        },
      ]);

      const request = createValidRequest({
        model: 'gpt-5-mini',
        enableSearch: true,
      });

      await POST(request);
      expect(mockGetAllModels).toHaveBeenCalled();
    });

    it('should handle message transformation errors gracefully', async () => {
      const request = createValidRequest({
        messages: [{ role: 'user', content: null }], // Invalid content
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should track credential usage for different sources', async () => {
      // Test user BYOK
      mockGetEffectiveApiKey.mockResolvedValue('user-api-key');
      const request = createValidRequest();
      await POST(request);

      expect(mockTrackCredentialUsage).toHaveBeenCalled();
    });

    it('should handle LangSmith integration', async () => {
      const mockCreateRun = langsmithModule.createRun as MockedFunction<
        typeof langsmithModule.createRun
      >;
      const mockIsLangSmithEnabled =
        langsmithModule.isLangSmithEnabled as MockedFunction<
          typeof langsmithModule.isLangSmithEnabled
        >;

      mockIsLangSmithEnabled.mockReturnValue(true);
      mockCreateRun.mockResolvedValue(undefined);

      const request = createValidRequest();
      await POST(request);

      expect(mockCreateRun).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'chat-completion',
          runType: 'chain',
        })
      );
    });

    it('should handle model configuration errors', async () => {
      mockGetAllModels.mockResolvedValue([]);

      const request = createValidRequest({ model: 'nonexistent-model' });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const errorData = await response.json();
      expect(errorData.error).toContain('not found');
    });

    it('should handle different reasoning effort levels', async () => {
      const request = createValidRequest({
        model: 'gpt-5-mini',
        reasoningEffort: 'high',
        verbosity: 'high',
      });

      await POST(request);
      expect(mockValidateAndTrackUsage).toHaveBeenCalled();
    });

    it('should sanitize and log user messages', async () => {
      const request = createValidRequest();
      await POST(request);

      expect(mockIncrementMessageCount).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        userId: 'user-456',
      });

      expect(mockLogUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          supabase: mockSupabaseClient,
          userId: 'user-456',
          chatId: 'chat-123',
          content: 'Hello, world!',
        })
      );
    });

    it('should handle attachments in user messages', async () => {
      const request = createValidRequest({
        messages: [
          {
            role: 'user',
            content: 'Hello with attachment',
            experimental_attachments: [
              {
                name: 'test.txt',
                url: 'blob:test',
                contentType: 'text/plain',
              },
            ],
          },
        ],
      });

      await POST(request);

      expect(mockLogUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              name: 'test.txt',
            }),
          ]),
        })
      );
    });

    it('should handle network timeouts and errors', async () => {
      const { streamText } = await import('ai');
      (streamText as any).mockImplementation(() => {
        throw new Error('Network timeout');
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle invalid JSON requests', async () => {
      // Mock request.json() to throw an error to simulate invalid JSON
      const request = {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token \'i\', "invalid json" is not valid JSON')),
      } as any;

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should handle missing message group ID', async () => {
      const request = createValidRequest({
        message_group_id: undefined,
      });

      await POST(request);
      expect(mockLogUserMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message_group_id: undefined,
        })
      );
    });

    it('should track credential errors appropriately', async () => {
      const mockTrackCredentialError =
        metricsModule.trackCredentialError as MockedFunction<
          typeof metricsModule.trackCredentialError
        >;

      mockValidateAndTrackUsage.mockRejectedValue(new Error('No API key'));

      const request = createValidRequest();
      await POST(request);

      expect(mockTrackCredentialError).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty message arrays', async () => {
      const request = createValidRequest({ messages: [] });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should handle malformed message content', async () => {
      const request = createValidRequest({
        messages: [
          {
            role: 'user',
            content: { invalid: 'object' },
            parts: undefined,
          },
        ],
      });

      await POST(request);
      // Should still process by converting to fallback content
      expect(mockValidateAndTrackUsage).toHaveBeenCalled();
    });

    it('should handle missing model configuration', async () => {
      mockGetAllModels.mockResolvedValue([]);

      const request = createValidRequest({ model: 'unknown-model' });
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle supabase client creation failure', async () => {
      mockValidateAndTrackUsage.mockResolvedValue(null);

      const request = createValidRequest();
      await POST(request);

      // Should still process the request
      expect(mockIncrementMessageCount).not.toHaveBeenCalled();
    });

    it('should handle concurrent requests safely', async () => {
      const request1 = createValidRequest({ chatId: 'chat-1' });
      const request2 = createValidRequest({ chatId: 'chat-2' });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large message arrays efficiently', async () => {
      const largeMessages = Array.from({ length: 100 }, (_, i) => ({
        role: 'user' as const,
        content: `Message ${i}`,
        id: `msg-${i}`,
      }));

      const request = createValidRequest({ messages: largeMessages });

      const startTime = Date.now();
      await POST(request);
      const endTime = Date.now();

      // Should process within reasonable time (< 1000ms for mocked operations)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle memory cleanup properly', async () => {
      const request = createValidRequest();
      await POST(request);

      // Verify no memory leaks by checking mock calls are properly cleaned
      expect(mockValidateAndTrackUsage).toHaveBeenCalledTimes(1);
    });
  });
});
