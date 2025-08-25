import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Get OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Return connection details for the client
    // Note: In production, you might want to use a proxy server
    // to avoid exposing the API key to the client
    return NextResponse.json({
      url: 'wss://api.openai.com/v1/realtime',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      }
    });
  } catch (error) {
    console.error('Failed to setup realtime connection:', error);
    return NextResponse.json(
      { error: 'Failed to setup connection' },
      { status: 500 }
    );
  }
}