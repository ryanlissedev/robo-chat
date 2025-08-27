/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock encryption BEFORE any other imports that might use it
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn(() => 'encrypted-data'),
  decrypt: vi.fn(() => 'decrypted-data'),
  encryptKey: vi.fn(() => ({ encrypted: 'encrypted-key', iv: 'test-iv' })),
  decryptKey: vi.fn(() => 'decrypted-key'),
}));

// Mock user-keys which imports encryption
vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(() => Promise.resolve(null)),
}));

// Mock ai streamText to simulate streaming response
vi.mock('ai', () => ({
  streamText: vi.fn((args: any) => ({
    toUIMessageStreamResponse: () =>
      new Response('mocked-stream', { status: 200 }),
    __args: args,
  })),
  convertToModelMessages: vi.fn(() => [
    { role: 'user', content: 'test message' },
  ]),
}));

// Mock retrieval modules
vi.mock('@/lib/retrieval/vector-retrieval', () => ({
  performVectorRetrieval: vi
    .fn()
    .mockImplementation(async (_query, _options) => {
      return [
        {
          fileId: '1',
          fileName: 'debug.md',
          score: 0.95,
          content: 'Debug information content',
        },
      ];
    }),
}));

vi.mock('@/lib/retrieval/two-pass', () => ({
  retrieveWithGpt41: vi
    .fn()
    .mockImplementation(async (_query, _messages, _options) => {
      return [
        {
          fileId: '2',
          fileName: 'debug-two-pass.md',
          score: 0.9,
          content: 'Two-pass debug content',
        },
      ];
    }),
}));

vi.mock('@/lib/retrieval/augment', () => ({
  buildAugmentedSystemPrompt: vi.fn((basePrompt, docs, _options) => {
    return `${basePrompt}\n\n[Retrieved Context]\n${docs.map((d: any) => `${d.fileName}: ${d.content}`).join('\n')}\n\n[Sources]\n${docs.map((d: any) => d.fileName).join(', ')}`;
  }),
}));

vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: vi.fn(() => 'vector'),
  shouldEnableFileSearchTools: vi.fn(
    (enableSearch: boolean, modelSupportsTools: boolean) =>
      enableSearch && modelSupportsTools
  ),
  shouldUseFallbackRetrieval: vi.fn(
    (enableSearch: boolean, modelSupportsTools: boolean) =>
      enableSearch && !modelSupportsTools
  ),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  FILE_SEARCH_SYSTEM_PROMPT: 'Debug system prompt',
  RETRIEVAL_MAX_TOKENS: 2000,
  RETRIEVAL_TOP_K: 5,
  RETRIEVAL_TWO_PASS_ENABLED: false,
  SYSTEM_PROMPT_DEFAULT: 'Default debug prompt',
}));

// Mock utilities
vi.mock('@/lib/utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/utils/redaction', () => ({
  redactSensitiveHeaders: vi.fn((h: any) => h),
  sanitizeLogEntry: vi.fn((o: any) => o),
}));

vi.mock('@/lib/utils/metrics', () => ({
  trackCredentialUsage: vi.fn(),
  trackCredentialError: vi.fn(),
  type: {},
}));

// Mock model catalog
vi.mock('@/lib/models', () => ({
  getAllModels: vi.fn(async () => [
    {
      id: 'debug-model',
      apiSdk: () => ({}) as any,
      reasoningText: false,
      fileSearchTools: false, // Set to false to trigger fallback retrieval
    },
  ]),
}));

// Mock provider map
vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: vi.fn(() => 'openai'),
}));

// Mock tools
vi.mock('@/lib/tools/file-search', () => ({
  fileSearchTool: { name: 'file_search', description: 'Search files' },
}));

// Mock external services
vi.mock('@/lib/langsmith/client', () => ({
  createRun: vi.fn(async () => ({ id: 'debug-run-1' })),
  extractRunId: vi.fn(() => null),
  isLangSmithEnabled: vi.fn(() => false),
  logMetrics: vi.fn(async () => {}),
  updateRun: vi.fn(async () => {}),
}));

vi.mock('@/app/api/chat/api', () => ({
  incrementMessageCount: vi.fn(async () => {}),
  logUserMessage: vi.fn(async () => {}),
  storeAssistantMessage: vi.fn(async () => {}),
  validateAndTrackUsage: vi.fn(async () => {}),
}));

vi.mock('@/app/api/chat/utils', () => ({
  createErrorResponse: vi.fn(
    (m: string, s = 400) => new Response(m, { status: s })
  ),
}));

import { streamText } from 'ai';
import { POST } from '@/app/api/chat/route';
import {
  selectRetrievalMode,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';

function makeDebugRequest(body: any) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...body,
      messages: body.messages.map((msg: any) => ({
        ...msg,
        id: msg.id || Math.random().toString(36),
        createdAt: msg.createdAt || new Date(),
        content: msg.content || '',
      })),
    }),
  });
}

describe('Debug Chat API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    vi.mocked(performVectorRetrieval).mockImplementation(
      async (_query, _options) => {
        return [
          {
            fileId: '1',
            fileName: 'debug.md',
            score: 0.95,
            content: 'Debug information content',
          },
        ];
      }
    );

    vi.mocked(retrieveWithGpt41).mockImplementation(
      async (_query, _messages, _options) => {
        return [
          {
            fileId: '2',
            fileName: 'debug-two-pass.md',
            score: 0.9,
            content: 'Two-pass debug content',
          },
        ];
      }
    );

    vi.mocked(selectRetrievalMode).mockReturnValue('vector');
    vi.mocked(shouldUseFallbackRetrieval).mockReturnValue(true);
  });

  it('should handle basic debug chat request', async () => {
    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Debug this issue' }],
      chatId: 'debug-1',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: false,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should handle debug request with search enabled', async () => {
    // Ensure fallback retrieval is triggered by having no fileSearchTools support
    vi.mocked(shouldUseFallbackRetrieval).mockReturnValue(true);

    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Find debug logs' }],
      chatId: 'debug-2',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(performVectorRetrieval).toHaveBeenCalled();
  });

  it('should handle debug request with two-pass retrieval', async () => {
    // Import the gating functions to mock them properly
    const { shouldUseFallbackRetrieval } = await import(
      '@/lib/retrieval/gating'
    );

    vi.mocked(selectRetrievalMode).mockReturnValue('two-pass');
    vi.mocked(shouldUseFallbackRetrieval).mockReturnValue(true);

    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Complex debug query' }],
      chatId: 'debug-3',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(retrieveWithGpt41).toHaveBeenCalled();
  });

  it('should properly inject debug context into system prompt', async () => {
    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Debug with context' }],
      chatId: 'debug-4',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug base prompt',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const calls = vi.mocked(streamText).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const args = calls[0][0];

    expect(typeof args.system).toBe('string');
    // The system prompt gets augmented with retrieved context
    expect(args.system).toContain('Debug base prompt');
    expect(args.system).toContain('[Retrieved Context]');
    expect(args.system).toContain('debug.md');
    expect(args.system).toContain('[Sources]');
  });

  it('should handle debug request with error scenarios', async () => {
    // Mock retrieval to throw error
    vi.mocked(performVectorRetrieval).mockRejectedValueOnce(
      new Error('Retrieval failed')
    );

    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Debug with error' }],
      chatId: 'debug-5',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: true,
    });

    const res = await POST(req);
    // Should still return 200 as it falls back gracefully
    expect(res.status).toBe(200);
  });

  it('should validate debug message structure', async () => {
    const req = makeDebugRequest({
      messages: [
        {
          role: 'user',
          content: 'Debug message',
          parts: [{ type: 'text', text: 'Debug with parts' }],
        },
      ],
      chatId: 'debug-6',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: false,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should handle authenticated debug requests', async () => {
    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Authenticated debug' }],
      chatId: 'debug-7',
      userId: 'auth-debug-user',
      model: 'debug-model',
      isAuthenticated: true,
      systemPrompt: 'Debug assistant',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should handle debug requests with custom model parameters', async () => {
    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Debug with params' }],
      chatId: 'debug-8',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: true,
      reasoningEffort: 'high',
      verbosity: 'detailed',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should handle debug requests with file attachments', async () => {
    const req = makeDebugRequest({
      messages: [
        {
          role: 'user',
          content: 'Debug with attachment',
          attachments: [{ type: 'file', name: 'debug-log.txt' }],
        },
      ],
      chatId: 'debug-9',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: false,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should handle debug requests with streaming response', async () => {
    const req = makeDebugRequest({
      messages: [{ role: 'user', content: 'Debug streaming' }],
      chatId: 'debug-10',
      userId: 'debug-user',
      model: 'debug-model',
      isAuthenticated: false,
      systemPrompt: 'Debug assistant',
      enableSearch: false,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(streamText).toHaveBeenCalled();

    // Check that streamText was called with the expected arguments structure
    const calls = vi.mocked(streamText).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const args = calls[0][0];
    expect(args).toHaveProperty('messages');
    expect(args).toHaveProperty('model');
    expect(args).toHaveProperty('system');
  });
});
