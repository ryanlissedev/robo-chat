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

// Force two-pass enabled via config mock
vi.mock('@/lib/config', () => ({
  RETRIEVAL_TWO_PASS_ENABLED: true,
}));

// Mock ai streamText to capture system prompt
vi.mock('ai', () => ({
  streamText: vi.fn((args: any) => ({ ok: true, __args: args } as any)),
  convertToModelMessages: (msgs: any) => msgs,
}));

// Mock two-pass retriever to ensure it is used
vi.mock('@/lib/retrieval/two-pass', () => ({
  retrieveWithGpt41: vi.fn(async () => [
    { fileId: '1', fileName: 'TP.md', score: 0.88, content: 'Two-pass retrieved content' },
  ]),
}));

// Ensure gating selects two-pass
vi.mock('@/lib/retrieval/gating', () => ({
  selectRetrievalMode: () => 'two-pass',
}));

// Minimal logger, redaction, metrics
vi.mock('@/lib/utils/logger', () => ({ default: { info: () => {}, error: () => {}, warn: () => {} } }));
vi.mock('@/lib/utils/redaction', () => ({ redactSensitiveHeaders: (h: any) => h, sanitizeLogEntry: (o: any) => o }));
vi.mock('@/lib/utils/metrics', () => ({ trackCredentialUsage: () => {}, trackCredentialError: () => {}, type: {} } as any));

// Mock model catalog: no tools capability so fallback injection path triggers
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

// Provider map & tools
vi.mock('@/lib/openproviders/provider-map', () => ({ getProviderForModel: () => 'openai' }));
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
vi.mock('@/app/api/chat/utils', () => ({ createErrorResponse: (m: string, s = 400) => new Response(m, { status: s }) }));

import { POST } from '@/app/api/chat/route';
import { streamText } from 'ai';
import { retrieveWithGpt41 } from '@/lib/retrieval/two-pass';

function makeRequest(body: any) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat two-pass retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(retrieveWithGpt41).toHaveBeenCalledOnce();

    const calls = (streamText as unknown as { mock: { calls: any[] } }).mock.calls;
    const args = calls[0][0];
    expect(args.system).toContain('Base');
    expect(args.system).toContain('[Retrieved Context]');
    expect(args.system).toContain('TP.md');
  });
});
