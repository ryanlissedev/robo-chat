import { type NextRequest, NextResponse } from 'next/server';
import { rateLimit, type RateLimitEndpoint } from '@/lib/middleware/rate-limit';
import { authenticateRequest, createErrorResponse } from '@/lib/api-auth';
import { sanitizeInput, validateOrigin, securityHeaders } from '@/lib/security/middleware';
import {
  logAPIRequest,
  logAPIResponse,
  logAPIError,
  logPerformanceWarning,
} from '@/lib/utils/api-logger';
import { z } from 'zod';

// Standard API error codes
export const API_ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type APIErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: unknown;
  statusCode: number;
}

export interface APIHandlerOptions {
  requireAuth?: boolean;
  allowGuests?: boolean;
  rateLimit?: RateLimitEndpoint;
  validateOrigin?: boolean;
  schema?: z.ZodSchema<unknown>;
  allowedMethods?: string[];
}

/**
 * Enhanced API handler with comprehensive error handling, validation, and security
 */
export function createAPIHandler<T = unknown>(
  handler: (
    request: NextRequest,
    context: {
      authResult: Awaited<ReturnType<typeof authenticateRequest>>;
      validatedData?: T;
    }
  ) => Promise<Response>,
  options: APIHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now();
    const requestId = logAPIRequest(request);
    let authResult: Awaited<ReturnType<typeof authenticateRequest>> | null = null;

    try {
      // Method validation
      if (options.allowedMethods && !options.allowedMethods.includes(request.method)) {
        return createStandardErrorResponse({
          code: API_ERROR_CODES.METHOD_NOT_ALLOWED,
          message: `Method ${request.method} not allowed`,
          statusCode: 405,
        }, {
          'Allow': options.allowedMethods.join(', ')
        });
      }

      // Origin validation
      if (options.validateOrigin && !validateOrigin(request)) {
        return createStandardErrorResponse({
          code: API_ERROR_CODES.FORBIDDEN,
          message: 'Invalid origin',
          statusCode: 403,
        });
      }

      // Rate limiting
      if (options.rateLimit) {
        const rateLimitResponse = await rateLimit(request, options.rateLimit);
        if (rateLimitResponse) {
          return rateLimitResponse;
        }
      }

      // Authentication
      authResult = await authenticateRequest(request, {
        requireAuth: options.requireAuth,
        rateLimit: options.rateLimit,
        validateOrigin: options.validateOrigin,
      });

      // Guest user check
      if (!options.allowGuests && authResult.isGuest) {
        return createStandardErrorResponse({
          code: API_ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication required',
          statusCode: 401,
        });
      }

      // Request body validation
      let validatedData: T | undefined;
      if (options.schema && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
        try {
          const body = await request.json();
          const sanitizedBody = sanitizeInput(body);
          validatedData = options.schema.parse(sanitizedBody) as T;
        } catch (error) {
          if (error instanceof z.ZodError) {
            return createStandardErrorResponse({
              code: API_ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid request data',
              details: error.errors,
              statusCode: 400,
            });
          }
          return createStandardErrorResponse({
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Invalid JSON in request body',
            statusCode: 400,
          });
        }
      }

      // Call the handler
      const response = await handler(request, { authResult, validatedData });

      // Log successful response
      const duration = Date.now() - startTime;
      let endpoint = '/unknown';
      try {
        if (request.url) {
          endpoint = new URL(request.url).pathname;
        }
      } catch {
        endpoint = request.url || '/test';
      }

      logAPIResponse(requestId, response.status, {
        userId: authResult.userId || undefined,
        endpoint,
        duration,
      });

      // Performance warning for slow requests
      if (duration > 5000) {
        logPerformanceWarning(`Slow API response: ${duration}ms`, {
          requestId,
          endpoint,
          duration,
        });
      }

      // Apply security headers to successful responses
      return securityHeaders(response as NextResponse);

    } catch (error) {
      // Log error with context
      let errorEndpoint = '/unknown';
      try {
        if (request.url) {
          errorEndpoint = new URL(request.url).pathname;
        }
      } catch {
        errorEndpoint = request.url || '/test';
      }

      logAPIError(error, {
        requestId,
        userId: authResult?.userId || undefined,
        endpoint: errorEndpoint,
        duration: Date.now() - startTime,
      });

      const errorResponse = handleAPIError(error);

      // Log error response
      logAPIResponse(requestId, errorResponse.status, {
        userId: authResult?.userId || undefined,
        endpoint: errorEndpoint,
        duration: Date.now() - startTime,
      });

      return errorResponse;
    }
  };
}

/**
 * Standardized error response creator
 */
export function createStandardErrorResponse(
  error: APIError,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      ...(error.details && typeof error.details === 'object' ? { details: error.details } : {}),
    },
    { status: error.statusCode }
  );

  // Apply security headers
  const secureResponse = securityHeaders(response);

  // Apply custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      secureResponse.headers.set(key, value);
    });
  }

  return secureResponse;
}

/**
 * Handle various types of errors and convert to standardized format
 */
export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message === 'Unauthorized') {
      return createStandardErrorResponse({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
        statusCode: 401,
      });
    }

    if (error.message === 'Authentication required') {
      return createStandardErrorResponse({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required',
        statusCode: 401,
      });
    }

    if (error.message === 'Rate limit exceeded') {
      return createStandardErrorResponse({
        code: API_ERROR_CODES.RATE_LIMITED,
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
      });
    }

    if (error.message === 'Invalid origin') {
      return createStandardErrorResponse({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'Invalid origin',
        statusCode: 403,
      });
    }

    if (error.message === 'Database connection failed') {
      return createStandardErrorResponse({
        code: API_ERROR_CODES.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable',
        statusCode: 503,
      });
    }

    // Generic error handling
    return createStandardErrorResponse({
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      statusCode: 500,
    });
  }

  // Unknown error type
  return createStandardErrorResponse({
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}

/**
 * Request validation schemas
 */
export const CommonSchemas = {
  // User preferences update
  userPreferences: z.object({
    layout: z.string().optional(),
    prompt_suggestions: z.boolean().optional(),
    show_tool_invocations: z.boolean().optional(),
    show_conversation_previews: z.boolean().optional(),
    multi_model_enabled: z.boolean().optional(),
    hidden_models: z.array(z.string()).optional(),
  }),

  // Favorite models
  favoriteModels: z.object({
    favorite_models: z.array(z.string().min(1)).max(20),
  }),

  // Project creation
  project: z.object({
    name: z.string().min(1).max(100).trim(),
  }),

  // Chat request (basic validation)
  chatMessage: z.object({
    message: z.string().min(1).max(10000),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
  }),
};

/**
 * Utility to create method-specific handlers
 */
export function createMethodHandler(
  methods: Record<string, (request: NextRequest, context: unknown) => Promise<Response>>,
  options: APIHandlerOptions = {}
) {
  return createAPIHandler(async (request, context) => {
    const handler = methods[request.method];
    if (!handler) {
      throw new Error(`Method ${request.method} not implemented`);
    }
    return handler(request, context);
  }, {
    ...options,
    allowedMethods: Object.keys(methods),
  });
}

/**
 * Success response helper
 */
export function createSuccessResponse<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse {
  const response = NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );

  // Apply security headers
  const secureResponse = securityHeaders(response);

  // Apply custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      secureResponse.headers.set(key, value);
    });
  }

  return secureResponse;
}