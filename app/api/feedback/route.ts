import { NextResponse } from 'next/server';
import { createFeedback as createLangSmithFeedback } from '@/lib/langsmith/client';
import { validateUserIdentity } from '@/lib/server/api';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messageId, feedback, comment, runId, userId } = body;

    if (!(messageId && feedback)) {
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
    // Using simplified feedback schema: store as a single message string
    const { error: dbError } = await supabase.from('feedback').insert({
      user_id: user.id,
      message: `${feedback}${comment ? `: ${comment}` : ''}`,
    });

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    // Send to LangSmith if run ID is provided
    let langsmithResult = null;
    if (runId) {
      try {
        langsmithResult = await createLangSmithFeedback({
          runId,
          feedback,
          score:
            feedback === 'upvote' ? 1 : feedback === 'downvote' ? 0 : undefined,
          comment,
          userId: user.id,
        });
      } catch {
        // Silently handle LangSmith errors
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
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: data?.message || null,
      createdAt: data?.created_at || null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
