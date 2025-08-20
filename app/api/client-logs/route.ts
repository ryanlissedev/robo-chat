// Temporarily disabled - @browser-echo package not installed
// export { POST, runtime, dynamic } from '@browser-echo/next/route';

import { NextResponse } from 'next/server';

export function POST() {
  // Placeholder for client logs endpoint
  return NextResponse.json({ success: true });
}

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
