import { FREE_MODELS_IDS } from '@/lib/config';
import type { ModelConfig } from '@/lib/models/types';

/**
 * Utility function to filter and sort models based on favorites, search, and visibility
 * @param models - All available models
 * @param favoriteModels - Array of favorite model IDs
 * @param searchQuery - Search query to filter by model name
 * @param isModelHidden - Function to check if a model is hidden
 * @returns Filtered and sorted models
 */
export function filterAndSortModels(
  models: ModelConfig[],
  favoriteModels: string[],
  searchQuery: string,
  isModelHidden: (modelId: string) => boolean
): ModelConfig[] {
  const query = searchQuery.toLowerCase();

  // Show all models (favorites first), do not hide non-favorites.
  return models
    .filter((model) => !isModelHidden(model.id))
    .filter((model) => model.name.toLowerCase().includes(query))
    .sort((a, b) => {
      const favSet = new Set(favoriteModels || []);

      const aFav = favSet.has(a.id) ? 0 : 1;
      const bFav = favSet.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav; // favorites first

      // Within favorites, keep user's order
      if (aFav === 0 && bFav === 0) {
        const aIndex = favoriteModels.indexOf(a.id);
        const bIndex = favoriteModels.indexOf(b.id);
        return aIndex - bIndex;
      }

      // Next, group free models for convenience
      const aIsFree = FREE_MODELS_IDS.includes(a.id);
      const bIsFree = FREE_MODELS_IDS.includes(b.id);
      if (aIsFree !== bIsFree) return aIsFree ? -1 : 1;

      // Stable fallback: alphabetical
      return a.name.localeCompare(b.name);
    });
}
