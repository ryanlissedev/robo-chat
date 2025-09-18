import { type NextRequest, NextResponse } from 'next/server';
import type { UserPreferencesUpdate } from '@/lib/types/api-errors';
import {
  authenticateRequest,
  getUserPreferences,
  updateUserPreferences,
  createErrorResponse,
} from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Authenticate request (supports both guest and authenticated users)
    const authResult = await authenticateRequest(request);

    // Get user preferences (handles both guest and authenticated users)
    const { preferences, headers } = await getUserPreferences(request, authResult);

    const response = NextResponse.json({
      layout: preferences.layout,
      prompt_suggestions: preferences.prompt_suggestions,
      show_tool_invocations: preferences.show_tool_invocations,
      show_conversation_previews: preferences.show_conversation_previews,
      multi_model_enabled: preferences.multi_model_enabled,
      hidden_models: preferences.hidden_models,
    });

    // Set headers for guest users (cookies)
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('Unauthorized') ? 401 : 500;
    return createErrorResponse(errorMessage, status);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Authenticate request (supports both guest and authenticated users)
    const authResult = await authenticateRequest(request);

    // Parse the request body
    const body = await request.json();
    const {
      layout,
      prompt_suggestions,
      show_tool_invocations,
      show_conversation_previews,
      multi_model_enabled,
      hidden_models,
    } = body;

    // Validate the data types
    if (layout && typeof layout !== 'string') {
      return NextResponse.json(
        { error: 'layout must be a string' },
        { status: 400 }
      );
    }

    if (hidden_models && !Array.isArray(hidden_models)) {
      return NextResponse.json(
        { error: 'hidden_models must be an array' },
        { status: 400 }
      );
    }

    // Prepare update object with only provided fields
    const updateData: UserPreferencesUpdate = {};
    if (layout !== undefined) {
      updateData.layout = layout;
    }
    if (prompt_suggestions !== undefined) {
      updateData.prompt_suggestions = prompt_suggestions;
    }
    if (show_tool_invocations !== undefined) {
      updateData.show_tool_invocations = show_tool_invocations;
    }
    if (show_conversation_previews !== undefined) {
      updateData.show_conversation_previews = show_conversation_previews;
    }
    if (multi_model_enabled !== undefined) {
      updateData.multi_model_enabled = multi_model_enabled;
    }
    if (hidden_models !== undefined) {
      updateData.hidden_models = hidden_models;
    }

    // Update preferences (handles both guest and authenticated users)
    const { preferences, headers } = await updateUserPreferences(
      request,
      authResult,
      updateData
    );

    const response = NextResponse.json({
      success: true,
      layout: preferences.layout,
      prompt_suggestions: preferences.prompt_suggestions,
      show_tool_invocations: preferences.show_tool_invocations,
      show_conversation_previews: preferences.show_conversation_previews,
      multi_model_enabled: preferences.multi_model_enabled,
      hidden_models: preferences.hidden_models,
    });

    // Set headers for guest users (cookies)
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const status = errorMessage.includes('Unauthorized') ? 401 : 500;
    return createErrorResponse(errorMessage, status);
  }
}
