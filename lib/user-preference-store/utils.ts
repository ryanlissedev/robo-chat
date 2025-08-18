export type LayoutType = "sidebar" | "fullscreen"

export type UserPreferences = {
  layout: LayoutType
  promptSuggestions: boolean
  showToolInvocations: boolean
  showConversationPreviews: boolean
  multiModelEnabled: boolean
  hiddenModels: string[]
}

export const defaultPreferences: UserPreferences = {
  layout: "fullscreen",
  promptSuggestions: true,
  showToolInvocations: true,
  showConversationPreviews: true,
  multiModelEnabled: false,
  hiddenModels: [],
}

// Helper functions to convert between API format (snake_case) and frontend format (camelCase)
export function convertFromApiFormat(apiData: Record<string, unknown>): UserPreferences {
  return {
    layout: (apiData.layout as LayoutType) || "fullscreen",
    promptSuggestions: (apiData.prompt_suggestions as boolean) ?? true,
    showToolInvocations: (apiData.show_tool_invocations as boolean) ?? true,
    showConversationPreviews: (apiData.show_conversation_previews as boolean) ?? true,
    multiModelEnabled: (apiData.multi_model_enabled as boolean) ?? false,
    hiddenModels: (apiData.hidden_models as string[]) || [],
  }
}

export function convertToApiFormat(preferences: Partial<UserPreferences>) {
  const apiData: Record<string, unknown> = {}
  if (preferences.layout !== undefined) apiData.layout = preferences.layout
  if (preferences.promptSuggestions !== undefined)
    apiData.prompt_suggestions = preferences.promptSuggestions
  if (preferences.showToolInvocations !== undefined)
    apiData.show_tool_invocations = preferences.showToolInvocations
  if (preferences.showConversationPreviews !== undefined)
    apiData.show_conversation_previews = preferences.showConversationPreviews
  if (preferences.multiModelEnabled !== undefined)
    apiData.multi_model_enabled = preferences.multiModelEnabled
  if (preferences.hiddenModels !== undefined)
    apiData.hidden_models = preferences.hiddenModels
  return apiData
}
