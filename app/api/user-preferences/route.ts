import { type NextRequest, NextResponse } from 'next/server';
import {
  getUserPreferences,
  updateUserPreferences,
} from '@/lib/api-auth';
import {
  createMethodHandler,
  CommonSchemas,
  createSuccessResponse,
} from '@/lib/middleware/api-handler';
import type { UserPreferencesUpdate } from '@/lib/types/api-errors';

async function handleGET(request: NextRequest, context: unknown) {
  const { authResult } = context as { authResult: any };
  // Get user preferences (handles both guest and authenticated users)
  const { preferences, headers } = await getUserPreferences(
    request,
    authResult
  );

  const responseData = {
    layout: preferences.layout,
    prompt_suggestions: preferences.prompt_suggestions,
    show_tool_invocations: preferences.show_tool_invocations,
    show_conversation_previews: preferences.show_conversation_previews,
    multi_model_enabled: preferences.multi_model_enabled,
    hidden_models: preferences.hidden_models,
  };

  return createSuccessResponse(responseData, 200, headers);
}

async function handlePUT(request: NextRequest, context: unknown) {
  const { authResult, validatedData } = context as { authResult: any; validatedData: UserPreferencesUpdate };
  // Update preferences (handles both guest and authenticated users)
  const { preferences, headers } = await updateUserPreferences(
    request,
    authResult,
    validatedData
  );

  const responseData = {
    layout: preferences.layout,
    prompt_suggestions: preferences.prompt_suggestions,
    show_tool_invocations: preferences.show_tool_invocations,
    show_conversation_previews: preferences.show_conversation_previews,
    multi_model_enabled: preferences.multi_model_enabled,
    hidden_models: preferences.hidden_models,
  };

  return createSuccessResponse(responseData, 200, headers);
}

// Export the enhanced API handler
export const GET = createMethodHandler({
  GET: handleGET,
}, {
  allowGuests: true,
  rateLimit: 'preferences',
});

export const PUT = createMethodHandler({
  PUT: handlePUT,
}, {
  allowGuests: true,
  rateLimit: 'preferences',
  schema: CommonSchemas.userPreferences,
});
