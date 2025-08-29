import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveCredentials, GET as chatGET } from '@/app/api/chat/route';

function headers(init?: Record<string, string>) {
  const h = new Headers();
  Object.entries(init || {}).forEach(([k, v]) => h.set(k, v));
  return h;
}

describe('chat credential resolution & diagnostics', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.AI_GATEWAY_API_KEY;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('prefers gateway when AI_GATEWAY_API_KEY is set', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gw';
    const res = await resolveCredentials(
      null,
      'gpt-5-mini',
      headers()
    );
    expect(res.source).toBe('gateway');
  });

  it('uses guest-header when provided and gateway disabled', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const res = await resolveCredentials(
      null,
      'gpt-5-mini',
      headers({ 'x-model-provider': 'openai', 'x-provider-api-key': 'sk-test' })
    );
    expect(res.source).toBe('guest-header');
    expect(res.apiKey).toBe('sk-test');
  });

  it('falls back to environment when no creds and gateway disabled', async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const res = await resolveCredentials(null, 'gpt-5-mini', headers());
    expect(res.source).toBe('environment');
  });

  it('GET /api/chat exposes gateway status and env flags', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-gw';
    const r = await chatGET();
    expect(r.status).toBe(200);
    const json = (await r.json()) as any;
    expect(json?.ok).toBe(true);
    expect(json?.gateway?.enabled).toBe(true);
    expect(json?.envAvailable).toBeTypeOf('object');
  });
});

