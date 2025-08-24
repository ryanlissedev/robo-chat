import { NextRequest, NextResponse } from 'next/server';
import type { VoiceSessionConfig } from '@/lib/types/voice';

// WebRTC configuration for OpenAI Realtime API
const OPENAI_REALTIME_ENDPOINT = 'wss://api.openai.com/v1/realtime';

// In-memory storage for WebRTC offers (use Redis in production)
const pendingOffers = new Map<string, {
  sessionId: string;
  offer: string;
  config: VoiceSessionConfig;
  createdAt: Date;
}>();

// Cleanup old offers every 2 minutes
setInterval(() => {
  const now = new Date();
  for (const [offerId, offer] of pendingOffers.entries()) {
    if (now.getTime() - offer.createdAt.getTime() > 2 * 60 * 1000) {
      pendingOffers.delete(offerId);
    }
  }
}, 2 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, offer, config } = body;

    if (!sessionId || !offer) {
      return NextResponse.json(
        { error: 'Session ID and offer are required' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log(`Processing WebRTC offer for session: ${sessionId}`);

    // Store the offer temporarily
    pendingOffers.set(sessionId, {
      sessionId,
      offer,
      config: config || {},
      createdAt: new Date(),
    });

    // Create WebRTC answer for OpenAI Realtime API
    const answer = await createRealtimeAnswer(offer, config);

    if (!answer) {
      return NextResponse.json(
        { error: 'Failed to create WebRTC answer' },
        { status: 500 }
      );
    }

    // Clean up stored offer
    pendingOffers.delete(sessionId);

    return NextResponse.json({
      sessionId,
      answer,
      status: 'success',
    });

  } catch (error) {
    console.error('Failed to process WebRTC offer:', error);
    return NextResponse.json(
      { error: 'Failed to process WebRTC offer' },
      { status: 500 }
    );
  }
}

async function createRealtimeAnswer(offer: string, config: VoiceSessionConfig): Promise<string | null> {
  try {
    // Configuration for OpenAI Realtime API
    const realtimeConfig = {
      model: config.model || 'gpt-4o-realtime-preview',
      voice: config.voice || 'nova',
      instructions: generateInstructions(config),
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1'
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 800,
      },
      tools: [],
      tool_choice: 'auto',
      temperature: 0.7,
      max_response_output_tokens: 4096,
    };

    // Create WebSocket connection to OpenAI Realtime API
    // Note: Node.js WebSocket doesn't support headers in constructor
    const ws = new WebSocket(OPENAI_REALTIME_ENDPOINT);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebRTC offer timeout'));
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        
        // Send session configuration
        ws.send(JSON.stringify({
          type: 'session.update',
          session: realtimeConfig,
        }));

        // Send WebRTC offer
        ws.send(JSON.stringify({
          type: 'webrtc.offer',
          offer: {
            type: 'offer',
            sdp: offer,
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'webrtc.answer') {
            clearTimeout(timeout);
            ws.close();
            resolve(data.answer.sdp);
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(data.error?.message || 'OpenAI Realtime API error'));
          }
        } catch (parseError) {
          console.error('Failed to parse WebRTC message:', parseError);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection error'));
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code !== 1000) {
          reject(new Error(`WebSocket closed with code ${event.code}`));
        }
      };
    });

  } catch (error) {
    console.error('Failed to create realtime answer:', error);
    return null;
  }
}

function generateInstructions(config: VoiceSessionConfig): string {
  const baseInstructions = `You are RoboRail, an advanced AI assistant specializing in railway operations, safety protocols, and technical expertise.`;
  
  const personalityInstructions = {
    'safety-focused': `
      PRIMARY FOCUS: Railway safety is your absolute priority. Always:
      - Emphasize safety protocols and procedures
      - Identify potential hazards before they become issues
      - Reference relevant safety standards and regulations
      - Provide clear, actionable safety guidance
      - Use precise, unambiguous language
      - Confirm understanding of critical safety information
    `,
    'technical-expert': `
      TECHNICAL EXPERTISE: You are a deep technical specialist. Always:
      - Provide detailed technical explanations
      - Reference specific systems, components, and specifications
      - Use industry-standard terminology
      - Offer multiple solution approaches when applicable
      - Include relevant calculations or measurements
      - Suggest diagnostic procedures and troubleshooting steps
    `,
    'friendly-assistant': `
      HELPFUL COMPANION: You are approachable yet professional. Always:
      - Use clear, friendly language
      - Break down complex concepts into understandable parts
      - Ask clarifying questions when needed
      - Provide context and background information
      - Be encouraging and supportive
      - Adapt your communication style to the user's level
    `,
  };

  const safetyProtocols = config.safetyProtocols ? `
    SAFETY PROTOCOLS ENABLED:
    - Always verify safety procedures before providing operational guidance
    - Flag any potentially unsafe suggestions or requests
    - Require explicit confirmation for high-risk operations
    - Default to the safest option when multiple approaches exist
    - Immediately highlight emergency procedures when relevant
  ` : '';

  const voiceGuidelines = `
    VOICE INTERACTION GUIDELINES:
    - Speak clearly and at an appropriate pace
    - Use natural pauses for complex information
    - Repeat critical information when necessary
    - Ask for confirmation on important points
    - Provide verbal cues for transitions between topics
    - Keep responses concise but complete
    - Use active voice and direct statements
  `;

  return [
    baseInstructions,
    personalityInstructions[config.personalityMode as keyof typeof personalityInstructions] || personalityInstructions['safety-focused'],
    safetyProtocols,
    voiceGuidelines,
  ].join('\n').trim();
}

export async function GET() {
  try {
    // Return status of pending offers (for debugging)
    const offers = Array.from(pendingOffers.entries()).map(([sessionId, offer]) => ({
      sessionId,
      createdAt: offer.createdAt,
      hasConfig: Boolean(offer.config),
    }));

    return NextResponse.json({
      pendingOffers: offers.length,
      offers: offers,
    });

  } catch (error) {
    console.error('Failed to get WebRTC offers status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}