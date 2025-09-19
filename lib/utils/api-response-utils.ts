/**
 * Utility functions for standardizing API responses
 * Reduces multiple return patterns in API routes
 */

import { NextResponse } from 'next/server';
import logger from '@/lib/utils/logger';

export type ApiErrorType =
  | 'validation_error'
  | 'authentication_error'
  | 'authorization_error'
  | 'rate_limit_error'
  | 'api_key_error'
  | 'model_error'
  | 'internal_error'
  | 'external_service_error';

export class ResponseError extends Error {
  constructor(
    public type: ApiErrorType,
    message: string,
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ResponseError';
  }
}

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
 * Parse and validate JSON request body with test-compatible API
 * Supports both simple parsing and validation with required fields
 */
export async function parseRequestBody<T>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: string }>;
export async function parseRequestBody<T>(
  request: Request,
  requiredFields: string[]
): Promise<ApiValidationResult<T>>;
export async function parseRequestBody<T>(
  request: Request,
  requiredFields?: string[]
): Promise<
  | { success: true; data: T }
  | { success: false; error: string }
  | ApiValidationResult<T>
> {
  try {
    const text = await request.text();

    if (!text.trim()) {
      if (requiredFields) {
        return {
          isValid: false,
          error: 'Empty request body',
          statusCode: 400,
        };
      }
      return { success: false, error: 'Empty request body' };
    }

    const data = JSON.parse(text);

    // If requiredFields is provided, return ApiValidationResult format
    if (requiredFields) {
      const validation = validateRequiredParams(data, requiredFields);
      return {
        isValid: validation.isValid,
        data: validation.isValid ? data : undefined,
        error: validation.error,
        statusCode: validation.statusCode,
      };
    }

    // Otherwise return simple success/error format
    return { success: true, data };
  } catch (error) {
    const errorMessage = (() => {
      if (error instanceof Error) {
        if (
          error.message.includes('Unexpected token') ||
          error.message.includes('Expected property name')
        ) {
          return 'Invalid JSON in request body';
        }
        return `Failed to parse request body: ${error.message}`;
      }
      return 'Failed to parse request body';
    })();

    if (requiredFields) {
      return {
        isValid: false,
        error: errorMessage,
        statusCode: 400,
      };
    }
    return { success: false, error: errorMessage };
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
 * Create success response with test-compatible API
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  // Handle undefined by using null as JSON fallback
  const serializedData = data === undefined ? null : data;
  return new Response(JSON.stringify(serializedData), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create error response with test-compatible API
 */
export function createErrorResponse(
  errorType: ApiErrorType,
  message: string,
  status: number = 500,
  details?: any
): Response {
  const body: any = {
    error: errorType,
    message,
    timestamp: new Date().toISOString(),
  };

  if (details !== undefined) {
    body.details = details;
  }

  // Handle circular references safely
  let jsonString: string;
  try {
    jsonString = JSON.stringify(body);
  } catch (_error) {
    // If circular reference, create simplified body
    const safeBody = {
      error: errorType,
      message,
      timestamp: body.timestamp,
      details: '[Circular Reference]',
    };
    jsonString = JSON.stringify(safeBody);
  }

  return new Response(jsonString, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle API errors with consistent logging and response format
 */
export function handleApiError(error: unknown, _operation: string): Response {
  if (error instanceof ResponseError) {
    return createErrorResponse(
      error.type,
      error.message,
      error.status,
      error.details
    );
  }

  if (error instanceof Error) {
    return createErrorResponse('internal_error', error.message, 500);
  }

  return createErrorResponse(
    'internal_error',
    'An unexpected error occurred',
    500
  );
}

/**
 * Validate JSON payload for required fields
 */
export function validateJsonPayload(
  payload: any,
  requiredFields: string[]
): { valid: true } | { valid: false; error: string } {
  if (!payload) {
    if (requiredFields.length > 0) {
      return {
        valid: false,
        error: `Missing required field: ${requiredFields[0]}`,
      };
    }
    return { valid: true };
  }

  for (const field of requiredFields) {
    const value = payload[field];
    if (value === undefined || value === null || value === '') {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  return { valid: true };
}

/**
 * Create streaming error response for SSE
 */
export function createStreamingErrorResponse(
  message: string,
  errorType: ApiErrorType = 'internal_error'
): Response {
  const errorData = {
    error: errorType,
    message,
  };

  const sseData = `data: ${JSON.stringify(errorData)}\n\n`;

  return new Response(sseData, {
    status: 500,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * Legacy create error response with old signature
 */
export function createErrorResponseLegacy(
  error: string,
  statusCode: number = 500
): NextResponse {
  return NextResponse.json({ error, success: false }, { status: statusCode });
}
