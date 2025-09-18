import { createGuestServerClient } from '@/lib/supabase/server-guest';
import { generateGuestUserId, isValidUUID } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (typeof userId !== 'string' || userId.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For guest users, we generate a proper UUID instead of using the provided userId
    // This ensures compatibility with PostgreSQL UUID columns
    const normalizedUserId = userId.trim();
    const guestUserId = isValidUUID(normalizedUserId)
      ? normalizedUserId
      : generateGuestUserId();

    const supabase = await createGuestServerClient();
    if (!supabase) {
      return new Response(
        JSON.stringify({ user: { id: guestUserId, anonymous: true } }),
        {
          status: 200,
        }
      );
    }

    // Check if the user record already exists.
    let { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', guestUserId)
      .maybeSingle();

    if (!userData) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: guestUserId,
          email: `${guestUserId}@anonymous.example`,
          anonymous: true,
          message_count: 0,
          premium: false,
          created_at: new Date().toISOString(),
        } as never)
        .select('*')
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({
            error: 'Failed to create guest user',
            details: error?.message,
          }),
          { status: 500 }
        );
      }

      userData = data;
    }

    return new Response(JSON.stringify({ user: userData }), { status: 200 });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: (err as Error).message || 'Internal server error',
      }),
      { status: 500 }
    );
  }
}
