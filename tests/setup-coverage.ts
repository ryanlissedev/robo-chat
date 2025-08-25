import '@testing-library/jest-dom';
import React from 'react';

// Make React available globally for components that assume it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// For coverage runs, we need to handle mocking differently
// since vi.mock may not be available in the hoisted context

// Only set up mocks if vi is available
if (typeof globalThis.vi !== 'undefined') {
  const { vi } = globalThis;
  
  // Mock next/navigation redirect as vi.fn()
  vi.mock('next/navigation', async (orig) => {
    const actual = await (orig() as Promise<any>);
    return {
      ...actual,
      redirect: vi.fn(),
    };
  });

  // Prevent creating real Supabase browser client during tests
  vi.mock('@/lib/supabase/client', () => ({
    createClient: () => null,
  }));

  // Mock CSS imports to prevent "Unknown file extension" errors
  vi.mock('katex/dist/katex.min.css', () => ({}));
}