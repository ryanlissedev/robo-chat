import { type NextRequest, NextResponse } from 'next/server';
import { isGuestUser, getGuestUserId } from '@/lib/utils';

// Rate limiting configuration
export const RATE_LIMITS = {
  // Authentication-based limits (stricter for guests)
  authenticated: {
    chat: { windowMs: 60_000, maxRequests: 30 }, // 30 per minute
    preferences: { windowMs: 60_000, maxRequests: 20 },
    projects: { windowMs: 60_000, maxRequests: 15 },
    general: { windowMs: 60_000, maxRequests: 60 },
    models: { windowMs: 300_000, maxRequests: 100 }, // 5 minutes
  },
  guest: {
    chat: { windowMs: 60_000, maxRequests: 10 }, // 10 per minute for guests
    preferences: { windowMs: 60_000, maxRequests: 5 },
    projects: { windowMs: 60_000, maxRequests: 3 },
    general: { windowMs: 60_000, maxRequests: 20 },
    models: { windowMs: 300_000, maxRequests: 20 },
  },
  // IP-based global limits
  ip: {
    global: { windowMs: 60_000, maxRequests: 100 }, // Per IP
    burst: { windowMs: 10_000, maxRequests: 20 }, // Burst protection
  },
} as const;

// Rate limit store with automatic cleanup
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.store.entries()) {
        if (value.resetTime < now) {
          this.store.delete(key);
        }
      }
    }, 300_000);
  }

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, value: { count: number; resetTime: number }) {
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

const rateLimitStore = new RateLimitStore();

// Export for testing
export const clearRateLimitStore = () => rateLimitStore.clear();
export const getRateLimitStoreSize = () => rateLimitStore.size();

// Export rate limit endpoint types
export type RateLimitEndpoint = keyof typeof RATE_LIMITS.authenticated;

/**
 * Rate limiting middleware that supports both authenticated and guest users
 */
export async function rateLimit(
  request: NextRequest,
  endpoint: keyof typeof RATE_LIMITS.authenticated
): Promise<NextResponse | null> {
  try {
    // Get client IP for IP-based limiting
    const ip = getClientIP(request);

    // Check IP-based global limits first
    const ipLimitResult = checkIPLimit(ip);
    if (ipLimitResult) {
      return ipLimitResult;
    }

    // Determine if user is guest or authenticated
    const isGuest = isGuestUser(request);
    const userId = isGuest ? getGuestUserId(request) : await getAuthenticatedUserId(request);

    if (!userId) {
      // No user ID available, fall back to IP-based limiting
      return checkSpecificIPLimit(ip, endpoint);
    }

    // Apply user-specific rate limits
    const limits = isGuest ? RATE_LIMITS.guest : RATE_LIMITS.authenticated;
    const limit = limits[endpoint];

    if (!limit) {
      return null; // No limit configured for this endpoint
    }

    const key = `${isGuest ? 'guest' : 'auth'}:${endpoint}:${userId}`;
    const now = Date.now();

    const current = rateLimitStore.get(key);

    if (!current || current.resetTime < now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + limit.windowMs,
      });
      return null; // Allow request
    }

    if (current.count >= limit.maxRequests) {
      const retryAfter = Math.ceil((current.resetTime - now) / 1000);
      return createRateLimitResponse(limit, retryAfter, current.resetTime);
    }

    current.count++;
    return null; // Allow request
  } catch (error) {
    // Don't block requests if rate limiting fails
    console.error('Rate limiting error:', error);
    return null;
  }
}

/**
 * Check IP-based global rate limits
 */
function checkIPLimit(ip: string): NextResponse | null {
  const globalLimit = RATE_LIMITS.ip.global;
  const burstLimit = RATE_LIMITS.ip.burst;

  // Check burst protection
  const burstKey = `ip:burst:${ip}`;
  const burstResult = checkLimit(burstKey, burstLimit);
  if (burstResult) {
    return burstResult;
  }

  // Check global IP limit
  const globalKey = `ip:global:${ip}`;
  return checkLimit(globalKey, globalLimit);
}

/**
 * Check specific endpoint IP limit (fallback when no user ID)
 */
function checkSpecificIPLimit(ip: string, endpoint: string): NextResponse | null {
  const limit = RATE_LIMITS.guest[endpoint as keyof typeof RATE_LIMITS.guest];
  if (!limit) {
    return null;
  }

  const key = `ip:${endpoint}:${ip}`;
  return checkLimit(key, limit);
}

/**
 * Generic rate limit check
 */
function checkLimit(
  key: string,
  limit: { windowMs: number; maxRequests: number }
): NextResponse | null {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs,
    });
    return null;
  }

  if (current.count >= limit.maxRequests) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000);
    return createRateLimitResponse(limit, retryAfter, current.resetTime);
  }

  current.count++;
  return null;
}

/**
 * Create rate limit exceeded response
 */
function createRateLimitResponse(
  limit: { maxRequests: number },
  retryAfter: number,
  resetTime: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': limit.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
        'X-RateLimit-Policy': 'sliding-window',
      },
    }
  );
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for IP address
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to connection IP (may not be available in serverless)
  // Note: request.ip is not available in Next.js Edge Runtime
  return 'unknown';
}

/**
 * Get authenticated user ID from request
 */
async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  try {
    // This would typically involve verifying a JWT token or session
    // For now, we'll use a simple header check
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return null;
    }

    // In a real implementation, you'd verify the token here
    // For now, return a placeholder
    return 'authenticated-user';
  } catch {
    return null;
  }
}

/**
 * Middleware wrapper for easy use in API routes
 */
export function withRateLimit(
  endpoint: keyof typeof RATE_LIMITS.authenticated,
  handler: (request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const rateLimitResponse = await rateLimit(request, endpoint);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}

/**
 * Get rate limit info for monitoring
 */
export function getRateLimitInfo() {
  return {
    storeSize: rateLimitStore.size(),
    limits: RATE_LIMITS,
  };
}