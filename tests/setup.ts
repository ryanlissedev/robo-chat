import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Make React available globally for components that assume it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// Mock next/navigation redirect as vi.fn()
vi.mock('next/navigation', async (orig) => {
  const actual = await (orig() as Promise<any>);
  return {
    ...actual,
    redirect: vi.fn(),
  };
});

// Prevent creating real Supabase browser client during tests.
// Many providers call `createClient()` from `lib/supabase/client`, which can
// initialize Realtime/WebSocket connections that Happy DOM can't fully emulate.
// We mock it to return `null` so feature flags that check for a client simply
// no-op in tests.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => null,
}));

// Mock CSS imports to prevent "Unknown file extension" errors
vi.mock('katex/dist/katex.min.css', () => ({}));
