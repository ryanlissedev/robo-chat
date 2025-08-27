/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock ai streamText to capture system prompt
vi.mock('ai', () => ({
  streamText: vi.fn((args: any) => ({
    // Return a minimal object compatible enough for route usage
    ok: true,
    __args: args,
  } as any)),
  convertToModelMessages: (msgs: any) => msgs,
}));

// Mock retrieval to return fixed docs
vi.mock('@/lib/retrieval/vector-retrieval', () => {
  return {
    performVectorRetrieval: vi.fn(async () => [
      { fileId: '1', fileName: 'FileA.md', score: 0.92, content: 'Alpha content about testing' },
      { fileId: '2', fileName: 'FileB.md', score: 0.80, content: 'Beta content about fallback' },
    ]),
  };
});

// Ensure two-pass code path not used
vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: () => 'vector',
}));

// Minimal logger to avoid noise
vi.mock('@/lib/utils/logger', () => ({ default: { info: () => {}, error: () => {}, warn: () => {} } }));
vi.mock('@/lib/utils/redaction', () => ({ redactSensitiveHeaders: (h: any) => h, sanitizeLogEntry: (o: any) => o }));
vi.mock('@/lib/utils/metrics', () => ({ trackCredentialUsage: () => {}, trackCredentialError: () => {}, type: {} } as any));

// Mock model catalog to a single test model without fileSearchTools
vi.mock('@/lib/models', () => ({
  getAllModels: async () => [
    {
      id: 'test-model',
      apiSdk: () => (({}) as any),
      reasoningText: false,
      fileSearchTools: false,
    },
  ],
}));

// Mock provider map
vi.mock('@/lib/openproviders/provider-map', () => ({ getProviderForModel: () => 'openai' }));

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
vi.mock('@/app/api/chat/utils', () => ({ createErrorResponse: (m: string, s = 400) => new Response(m, { status: s }) }));

// Import after mocks
import { POST } from '@/app/api/chat/route';
import { streamText } from 'ai';

function makeRequest(body: any) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat fallback retrieval injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const calls = (streamText as unknown as { mock: { calls: any[] } }).mock.calls;
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
