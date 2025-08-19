import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // TODO: Re-enable CSRF protection once Edge Runtime crypto issue is resolved
  // CSRF protection for state-changing requests
  // if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
  //   const csrfCookie = request.cookies.get('csrf_token')?.value;
  //   const headerToken = request.headers.get('x-csrf-token');

  //   if (!(csrfCookie && headerToken && validateCsrfToken(headerToken))) {
  //     return new NextResponse('Invalid CSRF token', { status: 403 });
  //   }
  // }

  // Basic CSP for development
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https: http://localhost:3001;`
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export const runtime = 'nodejs';
