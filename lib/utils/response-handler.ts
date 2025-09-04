/**
 * Utility functions for handling API responses and errors
 * Reduces multiple return patterns and improves error handling
 */

import logger from '@/lib/utils/logger';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export interface ApiSuccess<T = any> {
  data: T;
  status?: number;
}

export type ApiResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: ApiError };

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string | ApiError,
  status: number = 500
): Response {
  const errorObj: ApiError =
    typeof error === 'string'
      ? { message: error, status }
      : { ...error, status: error.status || status };

  logger.error('API Error:', errorObj as any);

  return new Response(
    JSON.stringify({
      error: errorObj.message,
      code: errorObj.code,
      details: errorObj.details,
    }),
    {
      status: errorObj.status || status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle async operations with proper error handling
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  errorMessage: string = 'Operation failed'
): Promise<ApiResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const errorObj: ApiError = {
      message: errorMessage,
      details: error instanceof Error ? error.message : String(error),
    };

    logger.error(errorMessage, error as any);
    return { success: false, error: errorObj };
  }
}

/**
 * Validate request data and return appropriate response
 */
export function validateRequest<T>(
  data: unknown,
  validator: (data: unknown) => { isValid: boolean; error?: string; data?: T }
): ApiResult<T> {
  const validation = validator(data);

  if (!validation.isValid) {
    return {
      success: false,
      error: {
        message: validation.error || 'Invalid request data',
        status: 400,
      },
    };
  }

  return {
    success: true,
    data: validation.data!,
  };
}

/**
 * Handle rate limiting checks
 */
export async function checkRateLimit(
  _userId: string,
  _isAuthenticated: boolean
): Promise<ApiResult<void>> {
  try {
    // TODO: Implement actual rate limiting logic
    // This is a placeholder for the rate limiting check

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: {
        message: 'Rate limit exceeded',
        status: 429,
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Convert ApiResult to HTTP Response
 */
export function resultToResponse<T>(result: ApiResult<T>): Response {
  if (result.success) {
    return createSuccessResponse(result.data, result.status);
  } else {
    return createErrorResponse(result.error, result.error.status);
  }
}

/**
 * Wrap a handler function with error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<Response> => {
    try {
      const result = await handler(...args);

      // If result is already a Response, return it
      if (result instanceof Response) {
        return result;
      }

      // Otherwise, wrap in success response
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  };
}
