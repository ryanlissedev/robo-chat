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

// Force two-pass enabled via config mock
vi.mock('@/lib/config', () => ({
  FILE_SEARCH_SYSTEM_PROMPT: 'Base system prompt',
  RETRIEVAL_MAX_TOKENS: 2000,
  RETRIEVAL_TOP_K: 5,
  RETRIEVAL_TWO_PASS_ENABLED: true,
  SYSTEM_PROMPT_DEFAULT: 'Default system prompt',
  RETRIEVAL_RETRIEVER_MODEL_ID: 'gpt-4.1',
}));

// Mock ai streamText to capture system prompt - simulate actual behavior
vi.mock('ai', () => ({
  streamText: vi.fn(
    (args: any) =>
      ({
        toUIMessageStreamResponse: () =>
          new Response('mocked-stream', { status: 200 }),
        __args: args,
      }) as any
  ),
  convertToModelMessages: vi.fn(() => {
    // Return a simple mock model message that won't cause conversion issues
    return [{ role: 'user', content: 'test message' }];
  }),
}));

// Mock two-pass retriever to ensure it is used
vi.mock('@/lib/retrieval/two-pass', () => ({
  retrieveWithGpt41: vi.fn().mockImplementation(async (_query, _messages, _options) => {
    return [
      {
        fileId: '1',
        fileName: 'TP.md',
        score: 0.88,
        content: 'Two-pass retrieved content',
      },
    ];
  }),
}));

// Mock buildAugmentedSystemPrompt
vi.mock('@/lib/retrieval/augment', () => ({
  buildAugmentedSystemPrompt: vi.fn((basePrompt, docs, _options) => {
    return `${basePrompt}\n\n[Retrieved Context]\n${docs.map((d: any) => `${d.fileName}: ${d.content}`).join('\n')}\n\n[Sources]\n${docs.map((d: any) => d.fileName).join(', ')}`;
  }),
}));

// Ensure gating selects two-pass
vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: () => 'two-pass',
  shouldEnableFileSearchTools: (
    enableSearch: boolean,
    modelSupportsTools: boolean
  ) => enableSearch && modelSupportsTools,
  shouldUseFallbackRetrieval: (
    enableSearch: boolean,
    modelSupportsTools: boolean
  ) => enableSearch && !modelSupportsTools,
}));

// Minimal logger, redaction, metrics
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

// Mock model catalog: no tools capability so fallback injection path triggers
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

// Provider map & tools
vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: () => 'openai',
}));
vi.mock('@/lib/tools/file-search', () => ({ fileSearchTool: {} }));

// Supabase/LangSmith no-ops
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
import { POST } from '@/app/api/chat/route';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';

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

describe('POST /api/chat two-pass retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the mock implementation
    vi.mocked(retrieveWithGpt41).mockImplementation(async (_query, _messages, _options) => {
      return [
        {
          fileId: '1',
          fileName: 'TP.md',
          score: 0.88,
          content: 'Two-pass retrieved content',
        },
      ];
    });
  });

  it('uses retrieveWithGpt41 and injects augmented system prompt', async () => {
    const req = makeRequest({
      messages: [{ role: 'user', content: 'question' }],
      chatId: 'c1',
      userId: 'u1',
      model: 'test-model',
      isAuthenticated: false,
      systemPrompt: 'Base',
      enableSearch: true,
    });

    const res = await POST(req);
    expect(res).toBeTruthy();

    if (res.status !== 200) {
      const _errorBody = await res.text();
    }

    expect(res.status).toBe(200);
    expect(retrieveWithGpt41).toHaveBeenCalledOnce();

    const calls = (streamText as unknown as { mock: { calls: any[] } }).mock
      .calls;
    const args = calls[0][0];
    expect(args.system).toContain('Base');
    expect(args.system).toContain('[Retrieved Context]');
    expect(args.system).toContain('TP.md');
  });
});
