import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMetricsSummary, getRecentMetrics } from '@/lib/utils/metrics';

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

async function getUserEmail(): Promise<string | null> {
  try {
    const supabase = await createClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

function isAdminEmail(email: string | null): boolean {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return false;
  return email ? list.includes(email.toLowerCase()) : false;
}

export async function GET() {
  try {
    if (isDev()) {
      // Dev: allow access for convenience
    } else {
      const email = await getUserEmail();
      if (!email || !isAdminEmail(email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const summary = getMetricsSummary();
    const recent = getRecentMetrics(60);

    return NextResponse.json({ summary, recent });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
