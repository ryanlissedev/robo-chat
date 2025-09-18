import { type NextRequest, NextResponse } from 'next/server';
import { isGuestUser, getGuestUserId, generateGuestUserId } from '@/lib/utils';

/**
 * Middleware to handle guest users
 * Adds guest user ID to request if missing
 */
export function withGuestSupport(handler: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const isGuest = isGuestUser(request);

    if (isGuest) {
      let guestUserId = getGuestUserId(request);

      // Generate guest ID if missing
      if (!guestUserId) {
        guestUserId = generateGuestUserId();

        // Add to headers for downstream handlers
        const headers = new Headers(request.headers);
        headers.set('x-guest-user-id', guestUserId);

        const modifiedRequest = new NextRequest(request.url, {
          method: request.method,
          headers,
          body: request.body,
        });

        const response = await handler(modifiedRequest);

        // Set guest cookie in response
        response.headers.set(
          'Set-Cookie',
          `guest-user-id=${guestUserId}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax; HttpOnly`
        );

        return response;
      }
    }

    return handler(request);
  };
}

/**
 * Routes that require authentication and cannot work for guests
 */
export const AUTH_REQUIRED_ROUTES = [
  '/api/user-keys',
  '/api/settings/api-keys',
  '/api/settings/rotate-key',
  '/api/settings/test-api-key',
] as const;

/**
 * Routes that can work for guests but have limited functionality
 */
export const GUEST_COMPATIBLE_ROUTES = [
  '/api/user-preferences',
  '/api/user-preferences/favorite-models',
  '/api/models',
  '/api/chat',
  '/api/create-chat',
  '/api/health',
  '/api/csrf',
  '/api/verify',
] as const;

/**
 * Routes that work for guests with localStorage/cookie fallback
 */
export const GUEST_FALLBACK_ROUTES = [
  '/api/projects',
  '/api/feedback',
] as const;

/**
 * Check if route requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  return AUTH_REQUIRED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if route is guest compatible
 */
export function isGuestCompatible(pathname: string): boolean {
  return GUEST_COMPATIBLE_ROUTES.some(route => pathname.startsWith(route)) ||
         GUEST_FALLBACK_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Create response for auth-required endpoints accessed by guests
 */
export function createGuestRestrictedResponse(): NextResponse {
  return NextResponse.json({
    error: 'Authentication required',
    message: 'This feature requires user authentication. Please sign in to continue.',
    code: 'GUEST_AUTH_REQUIRED',
  }, { status: 401 });
}