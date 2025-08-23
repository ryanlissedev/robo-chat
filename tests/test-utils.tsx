import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render, act } from '@testing-library/react';
import type React from 'react';
import type { ReactElement } from 'react';
import { expect, vi } from 'vitest';

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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  
  return {
    ...result,
    queryClient,
    // Add helper method for re-rendering with act()
    rerenderWithAct: (newUi: ReactElement) => {
      return act(() => {
        result.rerender(newUi);
      });
    },
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
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export async function waitForQueryToSettle(queryClient: QueryClient) {
  await act(async () => {
    await queryClient
      .getQueryCache()
      .findAll()
      .forEach((query) => {
        if (query.state.fetchStatus !== 'idle') {
          query.cancel();
        }
      });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// Helper to wrap async operations in act()
export async function actAsync(fn: () => Promise<void> | void) {
  await act(async () => {
    await fn();
  });
}

// Helper for handling user interactions with proper act() wrapping
export async function userInteraction(fn: () => Promise<void>) {
  await act(async () => {
    await fn();
  });
}

// Mock file for file upload tests
export function createMockFile(
  name = 'test.txt',
  content = 'test content',
  type = 'text/plain'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
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
// Custom matchers are automatically available via jest-dom setup
// No need to re-export them

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
