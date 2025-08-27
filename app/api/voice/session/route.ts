import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import type { VoiceSession } from '@/lib/types/voice';

// In-memory session storage (use Redis/database in production)
const sessions = new Map<string, VoiceSession>();

// Session cleanup interval (runs every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup of inactive sessions
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of sessions.entries()) {
    if (now.getTime() - session.lastActiveAt.getTime() > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const {
      config,
      personalityMode = 'safety-focused',
      safetyProtocols = true,
    } = body;

    // Validate config
    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Valid configuration object is required' },
        { status: 400 }
      );
    }

    // Validate personalityMode
    const validPersonalityModes = [
      'safety-focused',
      'technical-expert',
      'friendly-assistant',
    ];
    const validatedPersonalityMode = validPersonalityModes.includes(
      personalityMode
    )
      ? personalityMode
      : 'safety-focused';

    // Validate safetyProtocols
    const validatedSafetyProtocols =
      typeof safetyProtocols === 'boolean' ? safetyProtocols : true;

    // Create new session
    const sessionId = randomUUID();
    const now = new Date();

    const session: VoiceSession = {
      id: sessionId,
      status: 'active',
      config,
      personalityMode: validatedPersonalityMode,
      safetyProtocols: validatedSafetyProtocols,
      createdAt: now,
      lastActiveAt: now,
    };

    sessions.set(sessionId, session);

    return NextResponse.json({
      sessionId,
      status: 'created',
      config: session.config,
      personalityMode: session.personalityMode,
      safetyProtocols: session.safetyProtocols,
      createdAt: session.createdAt,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to create voice session',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update last active time
    session.lastActiveAt = new Date();

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      config: session.config,
      personalityMode: session.personalityMode,
      safetyProtocols: session.safetyProtocols,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to get voice session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return NextResponse.json(
        { error: 'Valid Session ID is required' },
        { status: 400 }
      );
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Mark session as inactive
    session.status = 'inactive';
    session.lastActiveAt = new Date();

    // Remove from memory after a delay to allow cleanup
    setTimeout(() => {
      if (sessions.has(sessionId)) {
        sessions.delete(sessionId);
      }
    }, 5000);

    return NextResponse.json({
      sessionId,
      status: 'deleted',
      message: 'Voice session terminated successfully',
      cleanupDelay: 5000,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to delete voice session',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { sessionId, config, personalityMode, safetyProtocols } = body;

    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return NextResponse.json(
        { error: 'Valid Session ID is required' },
        { status: 400 }
      );
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let hasUpdates = false;

    // Update session properties with validation
    if (config && typeof config === 'object') {
      session.config = { ...session.config, ...config };
      hasUpdates = true;
    }

    if (personalityMode && typeof personalityMode === 'string') {
      const validPersonalityModes = [
        'safety-focused',
        'technical-expert',
        'friendly-assistant',
      ];
      if (validPersonalityModes.includes(personalityMode)) {
        session.personalityMode = personalityMode;
        hasUpdates = true;
      } else {
        return NextResponse.json(
          {
            error: `Invalid personality mode. Valid options: ${validPersonalityModes.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    if (typeof safetyProtocols === 'boolean') {
      session.safetyProtocols = safetyProtocols;
      hasUpdates = true;
    }

    if (hasUpdates) {
      session.lastActiveAt = new Date();
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      config: session.config,
      personalityMode: session.personalityMode,
      safetyProtocols: session.safetyProtocols,
      lastActiveAt: session.lastActiveAt,
      updated: hasUpdates,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        error: 'Failed to update voice session',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
