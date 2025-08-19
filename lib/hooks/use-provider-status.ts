import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/lib/user-store/provider'

type ProviderStatus = Record<string, boolean>

interface UseProviderStatusReturn {
  providers: ProviderStatus
  isLoading: boolean
  error: string | null
  refresh: () => void
  isProviderAvailable: (provider: string) => boolean
}

/**
 * Hook to manage provider API key validation status
 * Part of the swarm architecture for dynamic model filtering
 */
export function useProviderStatus(): UseProviderStatusReturn {
  const { user } = useUser()
  const [providers, setProviders] = useState<ProviderStatus>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProviderStatus = useCallback(async () => {
    if (!user?.id) {
      // If no user, assume all providers are unavailable except ollama
      setProviders({ ollama: true })
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/settings/validate-providers?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setProviders(data.providers || {})
    } catch (err) {
      console.warn('Failed to fetch provider status:', err)
      setError(err instanceof Error ? err.message : 'Failed to validate providers')
      
      // Fallback: assume all providers are available to prevent breaking the UI
      setProviders({
        openai: true,
        anthropic: true,
        mistral: true,
        google: true,
        openrouter: true,
        xai: true,
        perplexity: true,
        ollama: true,
      })
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Initial fetch and refresh on user change
  useEffect(() => {
    fetchProviderStatus()
  }, [fetchProviderStatus])

  // Helper function to check if a provider is available
  const isProviderAvailable = useCallback((provider: string) => {
    // Ollama is always available (no API key required)
    if (provider === 'ollama') return true
    
    // For other providers, check the status
    return providers[provider] === true
  }, [providers])

  const refresh = useCallback(() => {
    fetchProviderStatus()
  }, [fetchProviderStatus])

  return {
    providers,
    isLoading,
    error,
    refresh,
    isProviderAvailable,
  }
}