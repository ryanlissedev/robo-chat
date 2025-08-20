import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

// Mock data for testing
export const mockUserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  system_prompt: 'You are a helpful assistant.',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

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
}

export const mockModels = [mockModelConfig]

export const mockUserKeyStatus = {
  openrouter: true,
  openai: true,
  mistral: false,
  google: false,
  perplexity: false,
  xai: false,
  anthropic: true,
}

export const mockUserConfig = {
  layout: 'fullscreen',
  prompt_suggestions: true,
  show_tool_invocations: true,
  show_conversation_previews: true,
  multi_model_enabled: false,
  hidden_models: [],
}

export const mockFavoriteModels = ['test-model', 'another-model']

// Create a test QueryClient
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialEntries?: string[]
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
        {children}
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

// Mock fetch responses
export function mockFetchResponse<T>(data: T, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options
  
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    headers: new Headers(),
    statusText: ok ? 'OK' : 'Error',
  })
}

// Mock API endpoints
export function mockApiEndpoints() {
  const fetchSpy = vi.spyOn(global, 'fetch')
  
  // Mock models endpoint
  fetchSpy.mockImplementation((url) => {
    if (typeof url === 'string') {
      if (url.includes('/api/models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ models: mockModels }),
        } as Response)
      }
      
      if (url.includes('/api/user-key-status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUserKeyStatus),
        } as Response)
      }
      
      if (url.includes('/api/user-preferences/favorite-models')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ favorite_models: mockFavoriteModels }),
        } as Response)
      }
      
      if (url.includes('/api/user-preferences')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockUserConfig),
        } as Response)
      }
    }
    
    return Promise.reject(new Error(`Unmocked fetch request: ${url}`))
  })
  
  return fetchSpy
}

// Test helpers for async operations
export function waitForNextTick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

export async function waitForQueryToSettle(queryClient: QueryClient) {
  await queryClient.getQueryCache().findAll().forEach(query => {
    if (query.state.fetchStatus !== 'idle') {
      query.cancel()
    }
  })
  await waitForNextTick()
}

// Mock file for file upload tests
export function createMockFile(
  name: string = 'test.txt',
  content: string = 'test content',
  type: string = 'text/plain'
): File {
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

// Mock URL.createObjectURL
export function mockObjectURL() {
  const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL')
  const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')
  
  createObjectURLSpy.mockImplementation(() => 'mock-object-url')
  revokeObjectURLSpy.mockImplementation(() => {})
  
  return { createObjectURLSpy, revokeObjectURLSpy }
}

// Custom matchers for testing
export const customMatchers = {
  toBeInTheDocument: expect.toBeInTheDocument,
  toHaveClass: expect.toHaveClass,
  toHaveTextContent: expect.toHaveTextContent,
  toBeVisible: expect.toBeVisible,
  toBeDisabled: expect.toBeDisabled,
  toBeEnabled: expect.toBeEnabled,
  toHaveAttribute: expect.toHaveAttribute,
  toHaveValue: expect.toHaveValue,
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'