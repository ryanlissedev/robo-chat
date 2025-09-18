import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { validateCsrfToken } from './lib/csrf';
import { isGuestUser, getGuestUserId, isValidUUID } from './lib/utils';

export async function middleware(request: NextRequest) {
  // Check if this is a guest user request
  const isGuest = isGuestUser(request);
  const guestUserId = getGuestUserId(request);

  // For guest users, skip Supabase session update but still validate guest ID if provided
  if (isGuest) {
    // Validate guest user ID if present
    if (guestUserId && !isValidUUID(guestUserId)) {
      return new NextResponse('Invalid guest user ID', { status: 400 });
    }

    // Create a response without updating Supabase session
    const response = NextResponse.next();

    // Add guest user headers to the response for downstream handlers
    if (guestUserId) {
      response.headers.set('x-guest-user-id', guestUserId);
      response.headers.set('x-guest-mode', 'true');
    }

    // Apply the rest of the middleware logic (CSRF, CSP) to guest requests
    await applySecurityMiddleware(request, response);
    return response;
  }

  // For authenticated users, proceed with normal Supabase session handling
  const response = await updateSession(request);
  await applySecurityMiddleware(request, response);
  return response;
}

async function applySecurityMiddleware(request: NextRequest, response: NextResponse) {
  // CSRF protection for state-changing requests
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    const csrfCookie = request.cookies.get('csrf_token')?.value;
    const headerToken = request.headers.get('x-csrf-token');

    if (!(csrfCookie && headerToken && validateCsrfToken(headerToken))) {
      return new NextResponse('Invalid CSRF token', { status: 403 });
    }
  }

  // CSP for development and production
  const isDev = process.env.NODE_ENV === 'development';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).origin : '';

  response.headers.set(
    'Content-Security-Policy',
    isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://assets.onedollarstats.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.supabase.com ${supabaseDomain} https://api.github.com https://collector.onedollarstats.com https://ai-gateway.vercel.sh;`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://analytics.umami.is https://vercel.live https://assets.onedollarstats.com; frame-src 'self' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://api.supabase.com ${supabaseDomain} https://api-gateway.umami.dev https://api.github.com https://collector.onedollarstats.com https://ai-gateway.vercel.sh;`
  );
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
  runtime: 'nodejs',
};
