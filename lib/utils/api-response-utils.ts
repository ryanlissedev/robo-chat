/**
 * Utility functions for standardizing API responses
 * Reduces multiple return patterns in API routes
 */

import { NextResponse } from 'next/server';
import logger from '@/lib/utils/logger';

export interface ApiValidationResult<T = any> {
  isValid: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ApiOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Validate required parameters and return structured result
 */
export function validateRequiredParams(
  params: Record<string, any>,
  requiredFields: string[]
): ApiValidationResult {
  for (const field of requiredFields) {
    if (!params[field]) {
      return {
        isValid: false,
        error: `${field} is required`,
        statusCode: 400,
      };
    }
  }

  return {
    isValid: true,
    data: params,
  };
}

/**
 * Execute an async operation with error handling
 */
export async function executeWithErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<ApiOperationResult<T>> {
  try {
    const data = await operation();
    return {
      success: true,
      data,
    };
  } catch (error) {
    logger.error(errorMessage, error as any);
    return {
      success: false,
      error: error instanceof Error ? error.message : errorMessage,
      statusCode: 500,
    };
  }
}

/**
 * Create standardized API response
 */
export function createApiResponse<T>(
  result: ApiOperationResult<T> | ApiValidationResult<T>
): NextResponse {
  if ('success' in result) {
    // ApiOperationResult
    if (result.success) {
      return NextResponse.json(result.data, { status: 200 });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 500 }
      );
    }
  } else {
    // ApiValidationResult
    if (result.isValid) {
      return NextResponse.json(result.data, { status: 200 });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode || 400 }
      );
    }
  }
}

/**
 * Handle database connection with fallback
 */
export async function connectToDatabase(): Promise<ApiOperationResult<any>> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    if (!supabase) {
      return {
        success: false,
        error: 'Database connection failed',
        statusCode: 500,
      };
    }

    return {
      success: true,
      data: supabase,
    };
  } catch (_error) {
    return {
      success: false,
      error: 'Database connection failed',
      statusCode: 500,
    };
  }
}

/**
 * Validate authentication and return user context
 */
export async function validateAuthentication(
  supabase: any
): Promise<ApiOperationResult<{ user: any; isAuthenticated: boolean }>> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        error: 'Authentication failed',
        statusCode: 401,
      };
    }

    return {
      success: true,
      data: {
        user,
        isAuthenticated: !!user,
      },
    };
  } catch (_error) {
    return {
      success: false,
      error: 'Authentication check failed',
      statusCode: 500,
    };
  }
}

/**
 * Parse and validate JSON request body
 */
export async function parseRequestBody<T>(
  request: Request,
  requiredFields: string[] = []
): Promise<ApiValidationResult<T>> {
  try {
    const body = await request.json();

    if (requiredFields.length > 0) {
      const validation = validateRequiredParams(body, requiredFields);
      if (!validation.isValid) {
        return validation;
      }
    }

    return {
      isValid: true,
      data: body as T,
    };
  } catch (_error) {
    return {
      isValid: false,
      error: 'Invalid JSON in request body',
      statusCode: 400,
    };
  }
}

/**
 * Handle common API route pattern with validation and error handling
 */
export async function handleApiRoute<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('API route error:', error as any);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }

      if (error.message.includes('unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (error.message.includes('forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create success response with optional data
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string
): NextResponse {
  const response: any = { success: true };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  return NextResponse.json(response, { status: 200 });
}

/**
 * Create error response with consistent format
 */
export function createErrorResponse(
  error: string,
  statusCode: number = 500
): NextResponse {
  return NextResponse.json({ error, success: false }, { status: statusCode });
}
