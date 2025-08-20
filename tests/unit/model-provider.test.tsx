import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ModelProvider, useModel } from '@/lib/model-store/provider'
import { 
  mockApiEndpoints, 
  mockModels, 
  mockUserKeyStatus, 
  mockUserConfig, 
  mockFavoriteModels,
  createTestQueryClient 
} from '../test-utils'

// TDD London Style: Test behavior, not implementation
describe('ModelProvider', () => {
  let queryClient: QueryClient
  let fetchSpy: ReturnType<typeof mockApiEndpoints>

  beforeEach(() => {
    queryClient = createTestQueryClient()
    fetchSpy = mockApiEndpoints()
  })

  afterEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  const createWrapper = () => ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ModelProvider>{children}</ModelProvider>
    </QueryClientProvider>
  )

  describe('When the ModelProvider initializes', () => {
    it('should provide default values while loading', () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.models).toEqual([])
      expect(result.current.favoriteModels).toEqual([])
      expect(result.current.userKeyStatus).toEqual({
        openrouter: false,
        openai: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
        anthropic: false,
      })
    })

    it('should throw error when useModel is used outside provider', () => {
      expect(() => {
        renderHook(() => useModel())
      }).toThrow('useModel must be used within a ModelProvider')
    })
  })

  describe('When data is successfully fetched', () => {
    it('should load and provide all model-related data', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.models).toEqual(mockModels)
      expect(result.current.userKeyStatus).toEqual(mockUserKeyStatus)
      expect(result.current.favoriteModels).toEqual(mockFavoriteModels)
      expect(result.current.userConfig).toEqual(mockUserConfig)
    })

    it('should make correct API calls with proper parameters', async () => {
      renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/models')
        expect(fetchSpy).toHaveBeenCalledWith('/api/user-key-status')
        expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences/favorite-models')
        expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences')
      })
    })
  })

  describe('When API calls fail', () => {
    beforeEach(() => {
      // Mock failed responses
      fetchSpy.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/models')) {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: () => Promise.resolve({}),
            } as Response)
          }
          
          if (url.includes('/api/user-key-status')) {
            return Promise.reject(new Error('Network error'))
          }
          
          if (url.includes('/api/user-preferences')) {
            return Promise.resolve({
              ok: false,
              status: 404,
              json: () => Promise.resolve({}),
            } as Response)
          }
        }
        
        return Promise.reject(new Error(`Unmocked fetch request: ${url}`))
      })
    })

    it('should gracefully handle failed requests and provide fallback values', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should fall back to defaults when API fails
      expect(result.current.models).toEqual([])
      expect(result.current.userKeyStatus).toEqual({
        openrouter: false,
        openai: false,
        mistral: false,
        google: false,
        perplexity: false,
        xai: false,
        anthropic: false,
      })
      expect(result.current.userConfig).toEqual({
        layout: 'fullscreen',
        prompt_suggestions: true,
        show_tool_invocations: true,
        show_conversation_previews: true,
        multi_model_enabled: false,
        hidden_models: [],
      })
    })
  })

  describe('When refresh functions are called', () => {
    it('should refresh models data', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Clear mock call history
      fetchSpy.mockClear()

      await result.current.refreshModels()

      expect(fetchSpy).toHaveBeenCalledWith('/api/models')
    })

    it('should refresh user key status', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      fetchSpy.mockClear()

      await result.current.refreshUserKeyStatus()

      expect(fetchSpy).toHaveBeenCalledWith('/api/user-key-status')
    })

    it('should refresh favorite models', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      fetchSpy.mockClear()

      await result.current.refreshFavoriteModels()

      expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences/favorite-models')
    })

    it('should refresh user config', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      fetchSpy.mockClear()

      await result.current.refreshUserConfig()

      expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences')
    })

    it('should refresh all data when refreshAll is called', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      fetchSpy.mockClear()

      await result.current.refreshAll()

      expect(fetchSpy).toHaveBeenCalledWith('/api/models')
      expect(fetchSpy).toHaveBeenCalledWith('/api/user-key-status')
      expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences/favorite-models')
      expect(fetchSpy).toHaveBeenCalledWith('/api/user-preferences')
    })

    it('should handle refreshFavoriteModelsSilent errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Mock failed refresh
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
      invalidateQueriesSpy.mockRejectedValueOnce(new Error('Refresh failed'))

      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      await result.current.refreshFavoriteModelsSilent()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to silently refresh favorite models'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Caching behavior', () => {
    it('should use proper cache settings for all queries', async () => {
      renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        const queries = queryClient.getQueryCache().getAll()
        
        queries.forEach(query => {
          // All queries should have staleTime of 5 minutes
          expect(query.options.staleTime).toBe(5 * 60 * 1000)
          // All queries should have gcTime of 10 minutes
          expect(query.options.gcTime).toBe(10 * 60 * 1000)
          // All queries should not refetch on window focus
          expect(query.options.refetchOnWindowFocus).toBe(false)
        })
      })
    })

    it('should not refetch data when window regains focus', async () => {
      const { result } = renderHook(() => useModel(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      fetchSpy.mockClear()

      // Simulate window focus
      window.dispatchEvent(new Event('focus'))

      // Wait a bit to ensure no refetch happens
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})