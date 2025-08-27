import { NextResponse } from 'next/server';
import { createFeedback as createLangSmithFeedback } from '@/lib/langsmith/client';
import { validateUserIdentity } from '@/lib/server/api';

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
    const { messageId, feedback, comment, runId, userId } = body;

    if (!messageId || feedback === undefined) {
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

    // Get user authentication
    const supabase = await validateUserIdentity(userId || '', true);
    if (!supabase) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    // Store feedback in Supabase
    const { error: dbError } = await supabase.from('feedback').upsert({
      message: `${feedback}${comment ? `: ${comment}` : ''}`, // Combine feedback and comment into message field
      user_id: user.id,
    } as never);

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    // Send to LangSmith if run ID is provided
    let langsmithResult: unknown = null;
    if (runId) {
      try {
        langsmithResult = await createLangSmithFeedback({
          runId,
          feedback,
          score: getFeedbackScore(feedback),
          comment,
          userId: user.id,
        });
      } catch {
        // Silently handle LangSmith error
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
    const userId = searchParams.get('userId');

    if (!(messageId && userId)) {
      return NextResponse.json(
        { error: 'Message ID and user ID are required' },
        { status: 400 }
      );
    }

    // Validate user
    const supabase = await validateUserIdentity(userId, true);
    if (!supabase) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
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
      createdAt: (data as unknown as { created_at?: string })?.created_at || null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
