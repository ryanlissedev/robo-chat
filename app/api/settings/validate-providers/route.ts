import { getProviderForModel } from '@/lib/openproviders/provider-map'
import { getAllModels } from '@/lib/models'
import { getEffectiveApiKey } from '@/lib/user-keys'
import type { ProviderWithoutOllama } from '@/lib/user-keys'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }


    // Get all models to understand which providers we need
    const allModels = await getAllModels()
    const requiredProviders = new Set<string>()

    // Collect all providers used by models
    allModels.forEach(model => {
      try {
        const provider = getProviderForModel(model.id as string)
        if (provider !== 'ollama') { // Ollama doesn't require API keys
          requiredProviders.add(provider)
        }
      } catch (error) {
        // Skip models with unknown providers
        console.warn(`Unknown provider for model ${model.id}:`, error)
      }
    })

    // Check API key availability for each provider
    const providerStatus: Record<string, boolean> = {}
    
    for (const provider of Array.from(requiredProviders)) {
      try {
        const apiKey = await getEffectiveApiKey(userId, provider as ProviderWithoutOllama)
        providerStatus[provider] = !!apiKey
      } catch (error) {
        console.warn(`Failed to check API key for provider ${provider}:`, error)
        providerStatus[provider] = false
      }
    }

    // Always mark ollama as available (no API key required)
    providerStatus['ollama'] = true

    return new Response(
      JSON.stringify({ 
        providers: providerStatus,
        timestamp: Date.now()
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'private, max-age=60' // Cache for 1 minute
        } 
      }
    )

  } catch (error) {
    console.error('Provider validation error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to validate providers',
        providers: {}, // Empty object as fallback
        timestamp: Date.now()
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}