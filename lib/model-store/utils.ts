import { FREE_MODELS_IDS } from "@/lib/config"
import { ModelConfig } from "@/lib/models/types"
import { getProviderForModel } from "@/lib/openproviders/provider-map"

/**
 * Utility function to filter and sort models based on favorites, search, visibility, and provider availability
 * @param models - All available models
 * @param favoriteModels - Array of favorite model IDs
 * @param searchQuery - Search query to filter by model name
 * @param isModelHidden - Function to check if a model is hidden
 * @param isProviderAvailable - Function to check if a provider has valid API keys (optional)
 * @returns Filtered and sorted models
 */
export function filterAndSortModels(
  models: ModelConfig[],
  favoriteModels: string[],
  searchQuery: string,
  isModelHidden: (modelId: string) => boolean,
  isProviderAvailable?: (provider: string) => boolean
): ModelConfig[] {
  return models
    .filter((model) => !isModelHidden(model.id))
    .filter((model) => {
      // Filter by provider availability if the function is provided
      if (isProviderAvailable) {
        try {
          const provider = getProviderForModel(model.id as string)
          return isProviderAvailable(provider)
        } catch {
          // If we can't determine the provider, hide the model for safety
          console.warn(`Could not determine provider for model ${model.id}, hiding from list`)
          return false
        }
      }
      return true
    })
    .filter((model) => {
      // If user has favorite models, only show favorites
      if (favoriteModels && favoriteModels.length > 0) {
        return favoriteModels.includes(model.id)
      }
      // If no favorites, show all models
      return true
    })
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // If user has favorite models, maintain their order
      if (favoriteModels && favoriteModels.length > 0) {
        const aIndex = favoriteModels.indexOf(a.id)
        const bIndex = favoriteModels.indexOf(b.id)
        return aIndex - bIndex
      }

      // Fallback to original sorting (free models first)
      const aIsFree = FREE_MODELS_IDS.includes(a.id)
      const bIsFree = FREE_MODELS_IDS.includes(b.id)
      return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1
    })
}
