import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { chatId, model } = await request.json();

    if (!(chatId && model)) {
      return new Response(
        JSON.stringify({ error: 'Missing chatId or model' }),
        { status: 400 }
      );
    }

    // If Supabase is not available, we still return success
    if (!supabase) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const { error } = await (supabase as any)
      .from('chats')
      // Cast to any to satisfy TS inference issues with Supabase types
      .update({ model } as any)
      .eq('id', chatId);

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to update chat model',
          details: error.message,
        }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: (err as Error).message || 'Internal server error',
      }),
      { status: 500 }
    );
  }
}
