/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

// Make React available globally for components that assume it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;

// Ensure vi is available globally
if (typeof globalThis.vi === 'undefined') {
  globalThis.vi = vi;
}

// Mock modules at the module level
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Prevent creating real Supabase browser client during tests
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => null,
}));

// Mock CSS imports to prevent "Unknown file extension" errors
vi.mock('katex/dist/katex.min.css', () => ({}));