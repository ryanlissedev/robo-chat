import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getGatewayConfig } from '@/lib/openproviders/env';

describe('getGatewayConfig', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('is disabled when no AI_GATEWAY_API_KEY is set', () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const gw = getGatewayConfig();
    expect(gw.enabled).toBe(false);
    expect(gw.baseURL).toBeNull();
    expect(gw.headers).toEqual({});
  });

  it('is enabled and sets headers when AI_GATEWAY_API_KEY is present', () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    process.env.AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1/ai';
    const gw = getGatewayConfig();
    expect(gw.enabled).toBe(true);
    expect(gw.baseURL).toContain('https://');
    expect(gw.headers.Authorization).toContain('Bearer');
  });
});

