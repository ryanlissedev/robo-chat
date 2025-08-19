# Complete Guest User Analysis and Fix Plan

## Executive Summary
After thorough analysis of the original Zola repository and comparing it with the current robo-chat implementation, I've identified the root causes preventing guest users from accessing AI models. The main issue is in the `checkUsageByModel` function which incorrectly restricts guest users from using models not in the `FREE_MODELS_IDS` list.

## Current Issues

### 1. Model Access Restriction (Critical)
**Location:** `/lib/usage.ts:236-239`
```typescript
if (isProModel(modelId)) {
  if (!isAuthenticated) {
    throw new UsageLimitError("You must log in to use this model.")
  }
}
```
**Problem:** This code blocks ALL guest users from accessing any model not in `FREE_MODELS_IDS`, even though the system is designed to allow guest access.

### 2. Model Categorization Confusion
**Current State:**
- `FREE_MODELS_IDS`: Models that don't require API keys
- `GUEST_ALLOWED_MODELS`: Combined list of free models and non-auth models
- Pro models: Everything not in `FREE_MODELS_IDS`

**Issue:** The system conflates "free" (no API key needed) with "guest accessible" (available to non-authenticated users).

### 3. Database Dependency for Guests
**Location:** `/lib/usage.ts:24-51`
- Guest users require database records to track usage
- Development mode has workarounds but production doesn't
- Creates unnecessary database dependency for anonymous usage

## Original Zola Implementation

### Key Differences:
1. **Guest User Creation:** Creates anonymous database records with `anonymous: true` flag
2. **Model Access:** Guests can use ALL models marked as free, not just a subset
3. **Usage Tracking:** Flexible system that allows guests without strict database requirements
4. **API Key Logic:** Only checks API keys for authenticated users with non-free models

## Fix Implementation Plan

### Phase 1: Remove Guest Model Restrictions
**File:** `/lib/usage.ts`
```typescript
export async function checkUsageByModel(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  isAuthenticated: boolean
) {
  // For guest users, only check basic usage limits
  // Don't restrict model access based on authentication
  if (!isAuthenticated) {
    return await checkUsage(supabase, userId)
  }
  
  // For authenticated users, apply pro model limits if applicable
  if (isProModel(modelId)) {
    return await checkProUsage(supabase, userId)
  }
  
  return await checkUsage(supabase, userId)
}
```

### Phase 2: Update Model Access Configuration
**File:** `/lib/config.ts`
```typescript
// Models that guests can use without authentication
export const GUEST_ACCESSIBLE_MODELS = [
  // All GPT models
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "gpt-o1-mini",
  "gpt-o1",
  
  // All Claude models  
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
  
  // All Gemini models
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  
  // DeepSeek models
  "deepseek-chat",
  "deepseek-reasoner",
  
  // Grok models
  "grok-2-latest",
  "grok-2-vision-1212",
  
  // Groq models
  "llama-3.3-70b-versatile",
  "llama-3.2-90b-vision-preview",
  "mixtral-8x7b-32768",
  
  // Perplexity models
  "llama-3.1-sonar-large-128k-online",
  "llama-3.1-sonar-huge-128k-online",
  
  // OpenRouter models
  "openrouter/auto",
  
  // All Ollama models (dynamically detected)
];
```

### Phase 3: Fix API Validation
**File:** `/app/api/chat/api.ts`
```typescript
export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<SupabaseClientType | null> {
  const supabase = await validateUserIdentity(userId, isAuthenticated);
  if (!supabase) return null;

  // For guest users, no API key checks needed
  // They get access to all models in GUEST_ACCESSIBLE_MODELS
  if (!isAuthenticated) {
    // Check if model is accessible to guests
    const provider = getProviderForModel(model);
    const isAccessible = 
      GUEST_ACCESSIBLE_MODELS.includes(model) || 
      provider === 'ollama';
    
    if (!isAccessible) {
      throw new Error(
        'This model requires authentication. Please log in or use a guest-accessible model.'
      );
    }
  } else {
    // For authenticated users, check API key requirements
    const provider = getProviderForModel(model);
    
    if (provider !== 'ollama') {
      const userApiKey = await getUserKey(
        userId,
        provider as ProviderWithoutOllama
      );
      
      // Authenticated users need API keys for non-free models
      if (!(userApiKey || FREE_MODELS_IDS.includes(model))) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings.`
        );
      }
    }
  }

  // Check usage limits (simplified for guests)
  await checkUsageByModel(supabase, userId, model, isAuthenticated);
  
  return supabase;
}
```

### Phase 4: Update Frontend Model Display
**File:** `/lib/models/index.ts`
```typescript
export async function getModelsWithAccessFlags(
  isAuthenticated: boolean = false
): Promise<ModelConfig[]> {
  const models = await getAllModels();
  
  if (!isAuthenticated) {
    // Guest users see all guest-accessible models
    return models.map(model => ({
      ...model,
      accessible: GUEST_ACCESSIBLE_MODELS.includes(model.id) || 
                  model.providerId === 'ollama'
    }));
  }
  
  // Authenticated users see all models
  // Accessibility depends on having API keys
  return models.map(model => ({
    ...model,
    accessible: true // Will be validated server-side based on API keys
  }));
}
```

## Testing Plan

### 1. Unit Tests
- [ ] Guest can select all models in GUEST_ACCESSIBLE_MODELS
- [ ] Guest gets proper error for restricted models
- [ ] Authenticated users can use models with API keys
- [ ] Usage limits apply correctly to both user types

### 2. Integration Tests
- [ ] Guest user flow from creation to chat
- [ ] Model selection UI shows correct accessible models
- [ ] Chat API accepts guest requests with allowed models
- [ ] Error handling for restricted model access

### 3. E2E Tests with Playwright
- [ ] Guest user can chat with GPT-4o-mini
- [ ] Guest user can chat with Claude Sonnet
- [ ] Guest user can chat with Gemini Flash
- [ ] Guest user sees appropriate model selection
- [ ] Guest user gets proper errors for restricted actions

## Implementation Timeline

1. **Immediate Fix (5 mins):** Remove the authentication check in `checkUsageByModel`
2. **Configuration Update (10 mins):** Update GUEST_ACCESSIBLE_MODELS list
3. **API Validation (15 mins):** Update validateAndTrackUsage logic
4. **Frontend Updates (20 mins):** Update model display logic
5. **Testing (30 mins):** Run full test suite

## Success Criteria

- [ ] Guest users can access the application without authentication
- [ ] Guest users can select and use all models in GUEST_ACCESSIBLE_MODELS
- [ ] No database errors for guest users in development or production
- [ ] Chat functionality works end-to-end for guests
- [ ] All Playwright tests pass
- [ ] No regression for authenticated users

## Rollback Plan

If issues arise:
1. Revert changes to usage.ts
2. Restore original checkUsageByModel function
3. Keep enhanced GUEST_ACCESSIBLE_MODELS for future use
4. Document specific failure points for next attempt

## Post-Implementation Monitoring

- Monitor error logs for guest user failures
- Track guest user engagement metrics
- Collect feedback on model accessibility
- Review usage patterns to optimize model list