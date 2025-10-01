import { describe, expect, it, beforeAll, vi } from 'vitest';

// Mock next/headers BEFORE importing anything else
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({
    get: vi.fn((name: string) => ({ name, value: '' })),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

describe('Supabase next/headers direct mock', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
  });

  it('should have cookies() mocked correctly', async () => {
    const { cookies } = await import('next/headers');
    expect(cookies).toBeDefined();
    expect(vi.isMockFunction(cookies)).toBe(true);
  });

  it('should work in server.ts createClient without error', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    
    // This should not throw "Cannot read properties of undefined (reading 'cookies')"
    const result = await createClient();
    expect(result).toBeDefined();
  });
});
