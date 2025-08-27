import { createClient } from '@/lib/supabase/client';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { decryptApiKey } from '@/lib/security/encryption';

export async function POST(request: NextRequest) {
  try {
    const { transcript, userId, sessionId, metadata } = await request.json();

    if (!transcript || !userId) {
      return NextResponse.json(
        { error: 'Transcript and userId are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get user's OpenAI API key
    const { data: keyData, error: keyError } = await supabase
      .from('user_keys')
      .select('encrypted_key, iv')
      .eq('user_id', userId)
      .eq('provider', 'openai')
      .single();

    if (keyError || !keyData?.encrypted_key) {
      return NextResponse.json(
        { error: 'OpenAI API key not found' },
        { status: 401 }
      );
    }

    // Decrypt the API key
    let apiKey: string;
    try {
      apiKey = decryptApiKey(
        keyData.encrypted_key,
        keyData.iv,
        '', // auth_tag doesn't exist in schema
        userId
      );
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt API key' },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Create transcript content for file storage
    // Note: OpenAI v5+ has different vector store APIs
    // For now, we'll store transcripts as files and return success

    // Create transcript file content
    const timestamp = new Date().toISOString();
    const transcriptContent = `Voice Transcript - ${timestamp}
Session ID: ${sessionId || 'unknown'}
Metadata: ${JSON.stringify(metadata || {}, null, 2)}

Transcript:
${transcript}`;

    // Upload transcript as file
    const transcriptFile = new File(
      [transcriptContent],
      `transcript_${timestamp.replace(/[:.]/g, '-')}.txt`,
      { type: 'text/plain' }
    );

    let uploadedFile: { id: string } | null = null;
    try {
      const fileResponse = await openai.files.create({
        file: transcriptFile,
        purpose: 'assistants',
      });

      if (!fileResponse || typeof fileResponse.id !== 'string' || !fileResponse.id.trim()) {
        throw new Error('Failed to create OpenAI file - invalid response or missing file ID');
      }
      
      uploadedFile = { id: fileResponse.id };
    } catch (error) {
      console.error('OpenAI file creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return NextResponse.json(
        { 
          error: 'Failed to upload transcript file', 
          details: errorMessage 
        },
        { status: 500 }
      );
    }

    // Ensure uploadedFile exists before proceeding
    if (!uploadedFile || !uploadedFile.id) {
      console.error('Missing uploaded file data');
      return NextResponse.json(
        { error: 'File upload completed but file data is missing' },
        { status: 500 }
      );
    }

    // Store transcript metadata in database for future indexing
    const { error: insertError } = await supabase
      .from('voice_transcripts')
      .insert({
        user_id: userId,
        session_id: sessionId || null,
        transcript: transcript,
        file_id: uploadedFile.id,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to store transcript metadata:', insertError);
      // Don't fail the entire request if DB insert fails - file is already uploaded
      return NextResponse.json({
        success: true,
        fileId: uploadedFile.id,
        message: 'Transcript uploaded successfully but metadata storage failed',
        warning: 'Database storage failed - transcript may not be searchable',
      });
    }

    return NextResponse.json({
      success: true,
      fileId: uploadedFile.id,
      message: 'Transcript stored successfully',
    });

  } catch (error) {
    console.error('Transcript indexing error:', error);
    return NextResponse.json(
      { error: 'Failed to index transcript' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('query');

    if (!userId || !query) {
      return NextResponse.json(
        { error: 'userId and query are required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Search transcripts from database (no API key needed for database search)
    const { data: transcripts, error: searchError } = await supabase
      .from('voice_transcripts')
      .select('*')
      .eq('user_id', userId)
      .ilike('transcript', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (searchError) {
      console.error('Transcript search error:', searchError);
      return NextResponse.json(
        {
          error: 'Search failed',
          details: searchError.message || 'Database search error',
          results: [],
        },
        { status: 500 }
      );
    }

    // Ensure transcripts is an array
    const results = Array.isArray(transcripts) ? transcripts : [];
    
    return NextResponse.json({
      results: results,
      message: `Found ${results.length} matching transcripts`,
      total: results.length,
    });

  } catch (error) {
    console.error('Transcript search error:', error);
    return NextResponse.json(
      { error: 'Failed to search transcripts' },
      { status: 500 }
    );
  }
}