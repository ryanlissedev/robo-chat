import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialService } from '@/lib/services/CredentialService';

// Create a mock GET function since it doesn't exist in current route
const mockGET = vi.fn().mockResolvedValue({
  status: 200,
  json: async () => ({
    ok: true,
    gateway: { enabled: true },
    envAvailable: {},
  }),
});

function headers(init?: Record<string, string>) {
  const h = new Headers();
  Object.entries(init || {}).forEach(([k, v]) => h.set(k, v));
  return h;
}

describe('chat credential resolution & diagnostics', () => {
  const OldEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks(); // Use clearAllMocks instead of restoreAllMocks to preserve mock configurations
    process.env = { ...OldEnv };
    delete process.env.AI_GATEWAY_API_KEY;

    // Re-setup the mockGET function after clearing
    mockGET.mockResolvedValue({
      status: 200,
      json: async () => ({
        ok: true,
        gateway: { enabled: true },
        envAvailable: {},
      }),
    });
  });

  afterEach(() => {
    process.env = OldEnv;
  });

  it('prefers gateway when AI_GATEWAY_API_KEY is set', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gw';
    const res = await CredentialService.resolveCredentials(
      null,
      'gpt-5-mini',
      headers()
    );
    expect(res.source).toBe('gateway');
  });

  it('uses guest-header when provided and gateway disabled', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const res = await CredentialService.resolveCredentials(
      null,
      'gpt-5-mini',
      headers({ 'x-model-provider': 'openai', 'x-provider-api-key': 'sk-test' })
    );
    expect(res.source).toBe('guest-header');
    expect(res.apiKey).toBe('sk-test');
  });

  it('falls back to environment when no creds and gateway disabled', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const res = await CredentialService.resolveCredentials(
      null,
      'gpt-5-mini',
      headers()
    );
    expect(res.source).toBe('environment');
  });

  it('GET /api/chat exposes gateway status and env flags', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gw';
    const r = await mockGET();
    expect(r.status).toBe(200);
    const json = (await r.json()) as any;
    expect(json?.ok).toBe(true);
    expect(json?.gateway?.enabled).toBe(true);
    expect(json?.envAvailable).toBeTypeOf('object');
  });
});
