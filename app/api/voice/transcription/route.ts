import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

interface TranscriptionEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  text: string;
  confidence: number;
  isInterim: boolean;
  speakerId?: string;
  audioLevel?: number;
  metadata?: Record<string, unknown>;
}

// In-memory storage for transcriptions (use database in production)
const transcriptions = new Map<string, TranscriptionEntry[]>();
const sessionTranscriptions = new Map<string, TranscriptionEntry>();

// Cleanup old transcriptions every 10 minutes
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
const TRANSCRIPTION_RETENTION = 2 * 60 * 60 * 1000; // 2 hours

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, entries] of transcriptions.entries()) {
    const filteredEntries = entries.filter(entry => 
      now - entry.timestamp < TRANSCRIPTION_RETENTION
    );
    
    if (filteredEntries.length === 0) {
      transcriptions.delete(sessionId);
    } else {
      transcriptions.set(sessionId, filteredEntries);
    }
  }
  
  // Cleanup session transcriptions
  for (const [sessionId, entry] of sessionTranscriptions.entries()) {
    if (now - entry.timestamp > TRANSCRIPTION_RETENTION) {
      sessionTranscriptions.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      text, 
      confidence = 0, 
      isInterim = false, 
      speakerId,
      audioLevel,
      metadata 
    } = body;

    if (!sessionId || !text) {
      return NextResponse.json(
        { error: 'Session ID and text are required' },
        { status: 400 }
      );
    }

    // Create transcription entry
    const transcriptionEntry: TranscriptionEntry = {
      id: randomUUID(),
      sessionId,
      timestamp: Date.now(),
      text: text.trim(),
      confidence: Math.max(0, Math.min(1, confidence)),
      isInterim,
      speakerId,
      audioLevel,
      metadata,
    };

    // Store in session transcriptions for current/latest
    sessionTranscriptions.set(sessionId, transcriptionEntry);

    // Store in full transcription history (only for final transcriptions)
    if (!isInterim) {
      const existing = transcriptions.get(sessionId) || [];
      existing.push(transcriptionEntry);
      transcriptions.set(sessionId, existing);
    }

    console.log(`Stored transcription for session ${sessionId}: ${text.substring(0, 50)}...`);

    return NextResponse.json({
      id: transcriptionEntry.id,
      sessionId,
      timestamp: transcriptionEntry.timestamp,
      stored: !isInterim,
      confidence: transcriptionEntry.confidence,
    });

  } catch (error) {
    console.error('Failed to store transcription:', error);
    return NextResponse.json(
      { error: 'Failed to store transcription' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const includeInterim = searchParams.get('includeInterim') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : 0;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get transcriptions for session
    let entries = transcriptions.get(sessionId) || [];
    
    // Include interim transcription if requested
    if (includeInterim) {
      const interim = sessionTranscriptions.get(sessionId);
      if (interim && interim.isInterim) {
        entries = [...entries, interim];
      }
    }

    // Filter by timestamp
    if (since > 0) {
      entries = entries.filter(entry => entry.timestamp > since);
    }

    // Sort by timestamp (newest first) and limit
    entries = entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    // Calculate statistics
    const stats = {
      totalEntries: entries.length,
      averageConfidence: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length 
        : 0,
      timespan: entries.length > 0 
        ? entries[0].timestamp - entries[entries.length - 1].timestamp
        : 0,
      interimCount: entries.filter(entry => entry.isInterim).length,
      finalCount: entries.filter(entry => !entry.isInterim).length,
    };

    return NextResponse.json({
      sessionId,
      transcriptions: entries,
      stats,
      hasMore: (transcriptions.get(sessionId)?.length || 0) > limit,
    });

  } catch (error) {
    console.error('Failed to get transcriptions:', error);
    return NextResponse.json(
      { error: 'Failed to get transcriptions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, transcriptionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (transcriptionId) {
      // Delete specific transcription
      const entries = transcriptions.get(sessionId) || [];
      const filteredEntries = entries.filter(entry => entry.id !== transcriptionId);
      
      if (filteredEntries.length === entries.length) {
        return NextResponse.json(
          { error: 'Transcription not found' },
          { status: 404 }
        );
      }
      
      transcriptions.set(sessionId, filteredEntries);
      
      // Also remove from session transcriptions if it matches
      const sessionEntry = sessionTranscriptions.get(sessionId);
      if (sessionEntry?.id === transcriptionId) {
        sessionTranscriptions.delete(sessionId);
      }

      return NextResponse.json({
        sessionId,
        transcriptionId,
        status: 'deleted',
      });
    } else {
      // Delete all transcriptions for session
      transcriptions.delete(sessionId);
      sessionTranscriptions.delete(sessionId);

      return NextResponse.json({
        sessionId,
        status: 'all_deleted',
      });
    }

  } catch (error) {
    console.error('Failed to delete transcriptions:', error);
    return NextResponse.json(
      { error: 'Failed to delete transcriptions' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, transcriptionId, text, confidence, metadata } = body;

    if (!sessionId || !transcriptionId) {
      return NextResponse.json(
        { error: 'Session ID and transcription ID are required' },
        { status: 400 }
      );
    }

    // Find and update transcription
    const entries = transcriptions.get(sessionId) || [];
    const entryIndex = entries.findIndex(entry => entry.id === transcriptionId);

    if (entryIndex === -1) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }

    const entry = entries[entryIndex];
    
    // Update fields
    if (text !== undefined) {
      entry.text = text.trim();
    }
    if (confidence !== undefined) {
      entry.confidence = Math.max(0, Math.min(1, confidence));
    }
    if (metadata !== undefined) {
      entry.metadata = { ...entry.metadata, ...metadata };
    }

    // Update timestamp to indicate modification
    entry.timestamp = Date.now();

    entries[entryIndex] = entry;
    transcriptions.set(sessionId, entries);

    // Update session transcription if it's the same entry
    const sessionEntry = sessionTranscriptions.get(sessionId);
    if (sessionEntry?.id === transcriptionId) {
      sessionTranscriptions.set(sessionId, entry);
    }

    return NextResponse.json({
      id: entry.id,
      sessionId: entry.sessionId,
      timestamp: entry.timestamp,
      text: entry.text,
      confidence: entry.confidence,
      metadata: entry.metadata,
    });

  } catch (error) {
    console.error('Failed to update transcription:', error);
    return NextResponse.json(
      { error: 'Failed to update transcription' },
      { status: 500 }
    );
  }
}

// Helper function to get transcription statistics (for debugging)
// Note: This function is not exported to avoid Next.js route conflicts
function getTranscriptionStats() {
  const totalSessions = transcriptions.size;
  let totalTranscriptions = 0;
  let totalConfidence = 0;
  
  for (const entries of transcriptions.values()) {
    totalTranscriptions += entries.length;
    totalConfidence += entries.reduce((sum, entry) => sum + entry.confidence, 0);
  }
  
  return {
    totalSessions,
    totalTranscriptions,
    averageConfidence: totalTranscriptions > 0 ? totalConfidence / totalTranscriptions : 0,
    currentSessions: sessionTranscriptions.size,
  };
}