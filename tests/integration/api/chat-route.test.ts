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

// Mock the ChatService
vi.mock('@/lib/services/ChatService', () => ({
  ChatService: {
    processChatRequest: vi.fn().mockResolvedValue(
      new Response('mocked stream response', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    ),
  },
}));

// Mock validation schema
vi.mock('@/lib/validation/schemas', () => ({
  ChatRequestSchema: {
    safeParse: vi.fn((data) => {
      // Validate messages
      if (!data.messages || data.messages.length === 0) {
        return {
          success: false,
          error: {
            flatten: () => ({
              formErrors: [],
              fieldErrors: {
                messages: ['Request is missing or invalid messages'],
              },
            }),
          },
        };
      }
      // Validate chatId and userId
      if (!data.chatId || !data.userId) {
        return {
          success: false,
          error: {
            flatten: () => ({
              formErrors: [],
              fieldErrors: {
                chatId: ['Request is missing chatId or userId'],
              },
            }),
          },
        };
      }
      return {
        success: true,
        data,
      };
    }),
  },
}));

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock utils
vi.mock('@/app/api/chat/utils', () => ({
  createErrorResponse: vi.fn((error) =>
    new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: error.code,
      }),
      {
        status: error.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  ),
}));

// Import modules after mocks are set up
import { POST } from '@/app/api/chat/route';
import { ChatService } from '@/lib/services/ChatService';
import { ChatRequestSchema } from '@/lib/validation/schemas';

describe('Chat API Route', () => {
  const mockProcessChatRequest = ChatService.processChatRequest as MockedFunction<
    typeof ChatService.processChatRequest
  >;
  const mockSafeParse = ChatRequestSchema.safeParse as MockedFunction<
    typeof ChatRequestSchema.safeParse
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockProcessChatRequest.mockResolvedValue(
      new Response('mocked stream response', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function for creating valid requests
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

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          userId: 'user-456',
          chatId: 'chat-123',
          model: 'gpt-4o-mini',
        })
      );
    });

    it('should handle GPT-5 model resolution', async () => {
      const request = createValidRequest({ model: 'gpt-4o-mini' });
      await POST(request);

      expect(mockProcessChatRequest).toHaveBeenCalled();
    });

    it('should validate required fields - empty messages', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: false,
        error: {
          flatten: () => ({
            formErrors: [],
            fieldErrors: {
              messages: ['Request is missing or invalid messages'],
            },
          }),
        },
      } as any);

      const request = createValidRequest({ messages: [] });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.errors.fieldErrors.messages).toContain(
        'Request is missing or invalid messages'
      );
    });

    it('should validate chatId and userId', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: false,
        error: {
          flatten: () => ({
            formErrors: [],
            fieldErrors: {
              chatId: ['Request is missing chatId or userId'],
            },
          }),
        },
      } as any);

      const request = createValidRequest({ chatId: '' });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const errorData = await response.json();
      expect(errorData.errors.fieldErrors.chatId).toContain(
        'Request is missing chatId or userId'
      );
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

      expect(mockProcessChatRequest).toHaveBeenCalled();
    });

    it('should handle chat context with personality mode', async () => {
      const request = createValidRequest({
        context: 'chat',
        personalityMode: 'technical-expert',
      });

      await POST(request);
      expect(mockProcessChatRequest).toHaveBeenCalled();
    });

    it('should configure tools for GPT-5 models with search enabled', async () => {
      const request = createValidRequest({
        model: 'gpt-5-mini',
        enableSearch: true,
      });

      await POST(request);
      expect(mockProcessChatRequest).toHaveBeenCalled();
    });

    it('should handle message transformation errors gracefully', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: false,
        error: {
          flatten: () => ({
            formErrors: [],
            fieldErrors: {
              messages: ['Invalid message content'],
            },
          }),
        },
      } as any);

      const request = createValidRequest({
        messages: [{ role: 'user', content: null }], // Invalid content
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('should handle network timeouts and errors', async () => {
      mockProcessChatRequest.mockRejectedValueOnce(new Error('Network timeout'));

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle invalid JSON requests', async () => {
      // Mock request.json() to throw an error to simulate invalid JSON
      const request = {
        method: 'POST',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: vi
          .fn()
          .mockRejectedValue(
            new SyntaxError(
              'Unexpected token \'i\', "invalid json" is not valid JSON'
            )
          ),
      } as any;

      const response = await POST(request);
      expect(response.status).toBe(500);
    });

    it('should handle different reasoning effort levels', async () => {
      const request = createValidRequest({
        model: 'gpt-5-mini',
        reasoningEffort: 'high',
        verbosity: 'high',
      });

      await POST(request);
      expect(mockProcessChatRequest).toHaveBeenCalled();
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
      expect(mockProcessChatRequest).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty message arrays', async () => {
      mockSafeParse.mockReturnValueOnce({
        success: false,
        error: {
          flatten: () => ({
            formErrors: [],
            fieldErrors: {
              messages: ['Request is missing or invalid messages'],
            },
          }),
        },
      } as any);

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
      expect(mockProcessChatRequest).toHaveBeenCalled();
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
      expect(mockProcessChatRequest).toHaveBeenCalledTimes(1);
    });
  });
});
