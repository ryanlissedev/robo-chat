import { NextResponse } from 'next/server';

function getFeedbackScore(feedback: string): number | undefined {
  if (feedback === 'upvote') {
    return 1;
  }
  if (feedback === 'downvote') {
    return 0;
  }
  return;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageId, feedback, comment, runId } = body;

    // Allow LangSmith-only feedback without messageId if runId is present
    if ((!messageId && !runId) || feedback === undefined) {
      return NextResponse.json(
        { error: 'Message ID and feedback are required' },
        { status: 400 }
      );
    }

    // Validate feedback type
    if (feedback !== 'upvote' && feedback !== 'downvote' && feedback !== null) {
      return NextResponse.json(
        { error: 'Invalid feedback type' },
        { status: 400 }
      );
    }

    // Get user authentication from cookies/headers (optional for LangSmith-only feedback)
    let supabase: any | null = null;
    try {
      const { createClient } = await import('@/lib/supabase/server');
      supabase = await createClient();
    } catch {
      supabase = null;
    }
    let user: { id: string } | null = null;

    if (supabase) {
      try {
        const result = await supabase.auth.getUser();
        if (!result.error && result.data.user) {
          user = { id: result.data.user.id };
        }
      } catch {
        // Continue without user authentication if it fails
      }
    }

    // Store feedback in Supabase
    if (supabase && user?.id) {
      const { error: dbError } = await supabase.from('feedback').upsert({
        message: `${feedback}${comment ? `: ${comment}` : ''}`, // Combine feedback and comment into message field
        user_id: user.id,
      } as never);

      if (dbError) {
        // Don't block LangSmith feedback on DB errors
      }
    }

    // Send to LangSmith if run ID is provided
    let langsmithResult: unknown = null;
    if (runId) {
      try {
        const { createFeedback } = await import('@/lib/langsmith/client');
        langsmithResult = await createFeedback({
          runId,
          feedback,
          score: getFeedbackScore(feedback),
          comment,
          userId: user?.id,
        });
      } catch {
        // Silently handle LangSmith error
        langsmithResult = null;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      langsmith: langsmithResult,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required' },
        { status: 400 }
      );
    }

    // Get user authentication from cookies/headers
    let supabase: any | null = null;
    try {
      const { createClient } = await import('@/lib/supabase/server');
      supabase = await createClient();
    } catch {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get feedback from database
    const { data, error } = await supabase
      .from('feedback')
      .select('message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 means no rows found
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      feedback: (data as unknown as { message?: string })?.message || null,
      createdAt:
        (data as unknown as { created_at?: string })?.created_at || null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
