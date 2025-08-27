import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react';
import type React from 'react';
import type { ReactElement } from 'react';
import { expect, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';

// Note: framer-motion is now mocked globally in setup.ts to avoid vi.mock issues

// Polyfill matchMedia for libraries expecting addEventListener/removeEventListener
if (typeof window !== 'undefined') {
  (window as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    dispatchEvent: vi.fn(),
  });
}

// Mock data for testing
export const mockUserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  display_name: 'Test User',
  profile_image: null as unknown as string, // matches optional field in schema
  system_prompt: 'You are a helpful assistant.',
  anonymous: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  favorite_models: [] as string[],
  last_active_at: '2024-01-01T00:00:00Z',
  message_count: 0,
  premium: false,
  daily_message_count: 0,
  daily_reset: '2024-01-02T00:00:00Z',
  daily_pro_message_count: 0,
  daily_pro_reset: '2024-01-02T00:00:00Z',
} as const;

export const mockModelConfig = {
  id: 'test-model',
  name: 'Test Model',
  provider: 'test',
  description: 'A test model',
  contextWindow: 4000,
  maxOutput: 1000,
  pricing: { input: 0.001, output: 0.002 },
  capabilities: ['chat'],
  apiSdk: vi.fn(),
};

export const mockModels = [mockModelConfig];

export const mockUserKeyStatus = {
  openrouter: true,
  openai: true,
  mistral: false,
  google: false,
  perplexity: false,
  xai: false,
  anthropic: true,
};

export const mockUserConfig = {
  layout: 'fullscreen',
  prompt_suggestions: true,
  show_tool_invocations: true,
  show_conversation_previews: true,
  multi_model_enabled: false,
  hidden_models: [],
};

export const mockFavoriteModels = ['test-model', 'another-model'];

// Create a test QueryClient
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0, // Always consider queries stale so they refetch
      },
      mutations: {
        retry: false,
      },
    },
  });
}

import { ModelProvider } from '@/lib/model-store/provider';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';
import { UserProvider } from '@/lib/user-store/provider';

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserProvider initialUser={mockUserProfile}>
          <UserPreferencesProvider>
            <ModelProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </ModelProvider>
          </UserPreferencesProvider>
        </UserProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// Mock fetch responses
export function mockFetchResponse<T>(
  data: T,
  options: { ok?: boolean; status?: number } = {}
) {
  const { ok = true, status = 200 } = options;

  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
    statusText: ok ? 'OK' : 'Error',
  });
}

// Mock API endpoints
export function mockApiEndpoints() {
  const fetchSpy = vi.spyOn(global, 'fetch');

  // Mock models endpoint - fetchClient calls fetch with headers
  fetchSpy.mockImplementation((url, _init) => {
    if (typeof url === 'string') {
      if (url.includes('/api/models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ models: mockModels }),
        } as Response);
      }

      if (url.includes('/api/user-key-status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUserKeyStatus),
        } as Response);
      }

      if (url.includes('/api/user-preferences/favorite-models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ favorite_models: mockFavoriteModels }),
        } as Response);
      }

      if (url.includes('/api/user-preferences')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUserConfig),
        } as Response);
      }
    }

    return Promise.reject(new Error(`Unmocked fetch request: ${url}`));
  });

  return fetchSpy;
}

// Test helpers for async operations
export function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function waitForQueryToSettle(queryClient: QueryClient) {
  await queryClient
    .getQueryCache()
    .findAll()
    .forEach((query) => {
      if (query.state.fetchStatus !== 'idle') {
        query.cancel();
      }
    });
  await waitForNextTick();
}

// Mock file for file upload tests
export function createMockFile(
  name = 'test.txt',
  content = 'test content',
  type = 'text/plain'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

// Mock URL.createObjectURL
export function mockObjectURL() {
  const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
  const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

  createObjectURLSpy.mockImplementation(() => 'mock-object-url');
  revokeObjectURLSpy.mockImplementation(() => {});

  return { createObjectURLSpy, revokeObjectURLSpy };
}

// Custom matchers for testing
export const customMatchers = {
  // Cast to any to avoid TypeScript issues with jest-dom matcher typings
  toBeInTheDocument: (expect as any).toBeInTheDocument,
  toHaveClass: (expect as any).toHaveClass,
  toHaveTextContent: (expect as any).toHaveTextContent,
  toBeVisible: (expect as any).toBeVisible,
  toBeDisabled: (expect as any).toBeDisabled,
  toBeEnabled: (expect as any).toBeEnabled,
  toHaveAttribute: (expect as any).toHaveAttribute,
  toHaveValue: (expect as any).toHaveValue,
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
