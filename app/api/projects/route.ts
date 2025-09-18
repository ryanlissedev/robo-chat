import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateRequest,
  createErrorResponse,
} from '@/lib/api-auth';
import { generateGuestUserId } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    const { name } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (authResult.isGuest) {
      // For guest users, create a mock project response
      // In a real app, this would be stored in localStorage on the client
      const guestProject = {
        id: generateGuestUserId(),
        name,
        user_id: authResult.userId || generateGuestUserId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        guest: true,
      };

      return NextResponse.json(guestProject);
    }

    // Handle authenticated users
    if (!authResult.supabase) {
      return NextResponse.json(
        { error: 'Supabase not available in this deployment.' },
        { status: 500 }
      );
    }

    if (!authResult.user?.id) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const { data, error } = await authResult.supabase
      .from('projects')
      .insert({ name, user_id: authResult.user.id } as never)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return createErrorResponse(errorMessage, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);

    if (authResult.isGuest) {
      // For guest users, return empty array
      // Client should handle localStorage projects
      return NextResponse.json([]);
    }

    if (!authResult.supabase) {
      return NextResponse.json(
        { error: 'Supabase not available in this deployment.' },
        { status: 500 }
      );
    }

    if (!authResult.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await authResult.supabase
      .from('projects')
      .select('*')
      .eq('user_id', authResult.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return createErrorResponse(errorMessage, 500);
  }
}
