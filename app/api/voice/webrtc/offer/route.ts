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

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
      return NextResponse.json(
        { error: 'Valid Session ID is required' },
        { status: 400 }
      );
    }

    if (!offer || typeof offer !== 'string' || !offer.trim()) {
      return NextResponse.json(
        { error: 'Valid WebRTC offer is required' },
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

    // Validate config if provided
    const validatedConfig = config && typeof config === 'object' ? config : {};

    // Store the offer temporarily
    pendingOffers.set(sessionId, {
      sessionId,
      offer,
      config: validatedConfig,
      createdAt: new Date(),
    });

    try {
      // Create WebRTC answer for OpenAI Realtime API
      const answer = await createRealtimeAnswer(offer, validatedConfig);

      if (!answer || typeof answer !== 'string' || !answer.trim()) {
        throw new Error('Invalid or empty WebRTC answer received');
      }

      // Clean up stored offer
      pendingOffers.delete(sessionId);

      return NextResponse.json({
        sessionId,
        answer,
        status: 'success',
      });
    } catch (answerError) {
      // Clean up stored offer on failure
      pendingOffers.delete(sessionId);
      throw answerError;
    }

  } catch (error) {
    console.error('Failed to process WebRTC offer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to process WebRTC offer',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

async function createRealtimeAnswer(offer: string, config: VoiceSessionConfig): Promise<string | null> {
  if (!offer || typeof offer !== 'string' || !offer.trim()) {
    throw new Error('Invalid offer provided to createRealtimeAnswer');
  }

  try {
    // Validate and sanitize config
    const safeConfig = config || {};
    
    // Configuration for OpenAI Realtime API
    const realtimeConfig = {
      model: typeof safeConfig.model === 'string' ? safeConfig.model : 'gpt-4o-realtime-preview',
      voice: typeof safeConfig.voice === 'string' ? safeConfig.voice : 'nova',
      instructions: generateInstructions(safeConfig),
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
      temperature: typeof safeConfig.temperature === 'number' ? safeConfig.temperature : 0.7,
      max_response_output_tokens: typeof safeConfig.maxTokens === 'number' ? safeConfig.maxTokens : 4096,
    };

    // Create WebSocket connection to OpenAI Realtime API
    // Note: Node.js WebSocket doesn't support headers in constructor
    const ws = new WebSocket(OPENAI_REALTIME_ENDPOINT);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        reject(new Error('WebRTC offer timeout after 10 seconds'));
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        console.log('Connected to OpenAI Realtime API');
        
        try {
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
        } catch (sendError) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`Failed to send WebRTC messages: ${sendError}`));
        }
      };

      ws.onmessage = (event) => {
        try {
          if (!event.data) {
            console.warn('Received empty WebSocket message');
            return;
          }
          
          const data = JSON.parse(event.data);
          
          if (data.type === 'webrtc.answer') {
            if (!data.answer || !data.answer.sdp) {
              clearTimeout(timeout);
              ws.close();
              reject(new Error('Invalid WebRTC answer: missing SDP'));
              return;
            }
            
            clearTimeout(timeout);
            ws.close();
            resolve(data.answer.sdp);
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            ws.close();
            const errorMsg = data.error?.message || data.error || 'OpenAI Realtime API error';
            reject(new Error(`OpenAI API Error: ${errorMsg}`));
          }
        } catch (parseError) {
          console.error('Failed to parse WebRTC message:', parseError);
          // Don't reject here, wait for timeout or proper message
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
          reject(new Error(`WebSocket closed unexpectedly with code ${event.code}: ${event.reason || 'Unknown reason'}`));
        }
      };
    });

  } catch (error) {
    console.error('Failed to create realtime answer:', error);
    throw error; // Re-throw instead of returning null for better error handling
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

  // Safely get personality mode with fallback
  const personalityMode = (config && typeof config.personalityMode === 'string') 
    ? config.personalityMode as keyof typeof personalityInstructions
    : 'safety-focused';

  const selectedPersonality = personalityInstructions[personalityMode] || personalityInstructions['safety-focused'];

  // Safely check safety protocols
  const safetyProtocols = (config && config.safetyProtocols !== false) ? `
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
    selectedPersonality,
    safetyProtocols,
    voiceGuidelines,
  ].filter(Boolean).join('\n').trim();
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