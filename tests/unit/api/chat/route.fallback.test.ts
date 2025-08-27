/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock encryption BEFORE any other imports that might use it
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn(() => 'encrypted-data'),
  decrypt: vi.fn(() => 'decrypted-data'),
  encryptKey: vi.fn(() => 'encrypted-key'),
  decryptKey: vi.fn(() => 'decrypted-key'),
}));

// Mock user-keys which imports encryption
vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(() => Promise.resolve(null)),
}));

// Mock ai streamText to capture system prompt - simulate actual behavior
vi.mock('ai', () => ({
  streamText: vi.fn(
    (args: any) =>
      ({
        // Return a minimal object compatible enough for route usage
        toUIMessageStreamResponse: () =>
          new Response('mocked-stream', { status: 200 }),
        __args: args,
      }) as any
  ),
  convertToModelMessages: vi.fn((_msgs) => {
    // This should work fine
    return [{ role: 'user', content: 'test message' }];
  }),
}));

// Mock retrieval to return fixed docs
vi.mock('@/lib/retrieval/vector-retrieval', () => {
  return {
    performVectorRetrieval: vi.fn().mockImplementation(async (_query, _options) => {
      return [
        {
          fileId: '1',
          fileName: 'FileA.md',
          score: 0.92,
          content: 'Alpha content about testing',
        },
        {
          fileId: '2',
          fileName: 'FileB.md',
          score: 0.8,
          content: 'Beta content about fallback',
        },
      ];
    }),
  };
});

// Mock config constants
vi.mock('@/lib/config', () => ({
  FILE_SEARCH_SYSTEM_PROMPT: 'Base system prompt',
  RETRIEVAL_MAX_TOKENS: 2000,
  RETRIEVAL_TOP_K: 5,
  RETRIEVAL_TWO_PASS_ENABLED: false,
  SYSTEM_PROMPT_DEFAULT: 'Default system prompt',
}));

// Mock buildAugmentedSystemPrompt
vi.mock('@/lib/retrieval/augment', () => ({
  buildAugmentedSystemPrompt: vi.fn((basePrompt, docs, _options) => {
    return `${basePrompt}\n\n[Retrieved Context]\n${docs.map((d: any) => `${d.fileName}: ${d.content}`).join('\n')}\n\n[Sources]\n${docs.map((d: any) => d.fileName).join(', ')}`;
  }),
}));

// Ensure two-pass code path not used
vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: () => 'vector',
  shouldEnableFileSearchTools: (
    enableSearch: boolean,
    modelSupportsTools: boolean
  ) => enableSearch && modelSupportsTools,
  shouldUseFallbackRetrieval: (
    enableSearch: boolean,
    modelSupportsTools: boolean
  ) => enableSearch && !modelSupportsTools,
}));

// Minimal logger to avoid noise
vi.mock('@/lib/utils/logger', () => ({
  default: { info: () => {}, error: () => {}, warn: () => {} },
}));
vi.mock('@/lib/utils/redaction', () => ({
  redactSensitiveHeaders: (h: any) => h,
  sanitizeLogEntry: (o: any) => o,
}));
vi.mock(
  '@/lib/utils/metrics',
  () =>
    ({
      trackCredentialUsage: () => {},
      trackCredentialError: () => {},
      type: {},
    }) as any
);

// Mock model catalog to a single test model without fileSearchTools
vi.mock('@/lib/models', () => ({
  getAllModels: async () => [
    {
      id: 'test-model',
      apiSdk: () => ({}) as any,
      reasoningText: false,
      fileSearchTools: false,
    },
  ],
}));

// Mock provider map
vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: () => 'openai',
}));

// Mock tools so configureTools returns empty set under fallback
vi.mock('@/lib/tools/file-search', () => ({ fileSearchTool: {} }));

// Supabase and LangSmith side-effects mocked out
vi.mock('@/lib/langsmith/client', () => ({
  createRun: async () => ({ id: 'run-1' }),
  extractRunId: () => null,
  isLangSmithEnabled: () => false,
  logMetrics: async () => {},
  updateRun: async () => {},
}));
vi.mock('@/app/api/chat/api', () => ({
  incrementMessageCount: async () => {},
  logUserMessage: async () => {},
  storeAssistantMessage: async () => {},
  validateAndTrackUsage: async () => {},
}));
vi.mock('@/app/api/chat/utils', () => ({
  createErrorResponse: (m: string, s = 400) => new Response(m, { status: s }),
}));

import { streamText } from 'ai';
// Import after mocks
import { POST } from '@/app/api/chat/route';
import { performVectorRetrieval } from '@/lib/retrieval/vector-retrieval';

function makeRequest(body: any) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...body,
      // Ensure messages have proper structure for route validation
      messages: body.messages.map((msg: any) => ({
        ...msg,
        id: msg.id || Math.random().toString(36),
        createdAt: msg.createdAt || new Date(),
        content: msg.content || '',
      })),
    }),
  });
}

describe('POST /api/chat fallback retrieval injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    vi.mocked(performVectorRetrieval).mockImplementation(async (_query, _options) => {
      return [
        {
          fileId: '1',
          fileName: 'FileA.md',
          score: 0.92,
          content: 'Alpha content about testing',
        },
        {
          fileId: '2',
          fileName: 'FileB.md',
          score: 0.8,
          content: 'Beta content about fallback',
        },
      ];
    });
  });

  it('basic route functionality test', async () => {
    // First let's try a minimal request without search to isolate the issue
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Hello' }],
      chatId: 'c1',
      userId: 'u1',
      model: 'test-model',
      isAuthenticated: false,
      systemPrompt: 'Base system',
      enableSearch: false, // Disable search first
    });

    const res = await POST(req);
    if (res.status !== 200) {
      const _errorBody = await res.text();
    }
    expect(res.status).toBe(200);
  });

  it('injects retrieved context into system prompt when tools disabled but search enabled', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'Tell me about alpha' }],
      chatId: 'c1',
      userId: 'u1',
      model: 'test-model',
      isAuthenticated: false,
      systemPrompt: 'Base system',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res).toBeTruthy();

    if (res.status !== 200) {
      const _errorBody = await res.text();
    }

    expect(res.status).toBe(200);

    const calls = (streamText as unknown as { mock: { calls: any[] } }).mock
      .calls;
    expect(calls.length).toBeGreaterThan(0);
    const args = calls[0][0];

    // The server-side injection path should have built an augmented system prompt
    expect(typeof args.system).toBe('string');
    expect(args.system).toContain('Base system');
    expect(args.system).toContain('[Retrieved Context]');
    expect(args.system).toContain('FileA.md');
    expect(args.system).toContain('[Sources]');
  });
});
