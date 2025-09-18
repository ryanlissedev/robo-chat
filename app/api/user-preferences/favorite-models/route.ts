import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  updateUserFavoriteModels,
  getUserFavoriteModels,
  createErrorResponse,
} from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request (supports both guest and authenticated users)
    const authResult = await authenticateRequest(request);

    // Parse the request body
    const body = await request.json();
    const { favorite_models } = body;

    // Validate the favorite_models array
    if (!Array.isArray(favorite_models)) {
      return NextResponse.json(
        { error: 'favorite_models must be an array' },
        { status: 400 }
      );
    }

    // Validate that all items in the array are strings
    if (!favorite_models.every((model) => typeof model === 'string')) {
      return NextResponse.json(
        { error: 'All favorite_models must be strings' },
        { status: 400 }
      );
    }

    // Update favorite models (handles both guest and authenticated users)
    const { favoriteModels, headers } = await updateUserFavoriteModels(
      request,
      authResult,
      favorite_models
    );

    const response = NextResponse.json({
      success: true,
      favorite_models: favoriteModels,
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

export async function GET(request: NextRequest) {
  try {
    // Authenticate request (supports both guest and authenticated users)
    const authResult = await authenticateRequest(request);

    // Get favorite models (handles both guest and authenticated users)
    const { favoriteModels, headers } = await getUserFavoriteModels(
      request,
      authResult
    );

    const response = NextResponse.json({
      favorite_models: favoriteModels,
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
