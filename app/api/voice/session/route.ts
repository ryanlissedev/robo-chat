import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }
}, CLEANUP_INTERVAL);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, personalityMode = 'safety-focused', safetyProtocols = true } = body;

    // Validate config
    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Invalid configuration provided' },
        { status: 400 }
      );
    }

    // Create new session
    const sessionId = randomUUID();
    const now = new Date();
    
    const session = {
      id: sessionId,
      status: 'active' as const,
      config,
      personalityMode,
      safetyProtocols,
      createdAt: now,
      lastActiveAt: now,
    };

    sessions.set(sessionId, session);

    console.log(`Created voice session: ${sessionId} with personality: ${personalityMode}`);

    return NextResponse.json({
      sessionId,
      status: 'created',
      config: session.config,
      personalityMode: session.personalityMode,
      safetyProtocols: session.safetyProtocols,
    });

  } catch (error) {
    console.error('Failed to create voice session:', error);
    return NextResponse.json(
      { error: 'Failed to create voice session' },
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
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
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

  } catch (error) {
    console.error('Failed to get voice session:', error);
    return NextResponse.json(
      { error: 'Failed to get voice session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Mark session as inactive
    session.status = 'inactive';
    session.lastActiveAt = new Date();

    // Remove from memory after a delay to allow cleanup
    setTimeout(() => {
      sessions.delete(sessionId);
    }, 5000);

    console.log(`Deactivated voice session: ${sessionId}`);

    return NextResponse.json({
      sessionId,
      status: 'deleted',
      message: 'Voice session terminated successfully',
    });

  } catch (error) {
    console.error('Failed to delete voice session:', error);
    return NextResponse.json(
      { error: 'Failed to delete voice session' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, config, personalityMode, safetyProtocols } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update session properties
    if (config) {
      session.config = { ...session.config, ...config };
    }

    if (personalityMode) {
      session.personalityMode = personalityMode;
    }

    if (typeof safetyProtocols === 'boolean') {
      session.safetyProtocols = safetyProtocols;
    }

    session.lastActiveAt = new Date();

    console.log(`Updated voice session: ${sessionId}`);

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      config: session.config,
      personalityMode: session.personalityMode,
      safetyProtocols: session.safetyProtocols,
      lastActiveAt: session.lastActiveAt,
    });

  } catch (error) {
    console.error('Failed to update voice session:', error);
    return NextResponse.json(
      { error: 'Failed to update voice session' },
      { status: 500 }
    );
  }
}

// Helper function to get active sessions (for debugging)
// Note: This function is not exported to avoid Next.js route conflicts
function getActiveSessions() {
  return Array.from(sessions.entries()).map(([id, session]) => ({
    id,
    status: session.status,
    personalityMode: session.personalityMode,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
  }));
}