import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ROBORAIL_SYSTEM_PROMPT } from '@/lib/config';
import { roborailKnowledgeTool } from '@/lib/tools/roborail-knowledge';
import { validateAndTrackUsage } from '../chat/api';

export const runtime = 'edge';
export const maxDuration = 60;

interface VoiceRequest {
  audio: string; // base64 encoded audio
  userId: string;
  chatId: string;
  isAuthenticated: boolean;
  sessionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as VoiceRequest;
    const { audio, userId, chatId, isAuthenticated, sessionId } = body;

    if (!audio || !userId) {
      return NextResponse.json(
        { error: 'Audio data and user ID are required' },
        { status: 400 }
      );
    }

    // Validate and track usage
    const supabase = await validateAndTrackUsage({
      userId,
      model: 'gpt-4o-realtime-preview',
      isAuthenticated,
    });

    // Get OpenAI API key
    let apiKey: string | undefined;
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import('@/lib/user-keys');
      apiKey = await getEffectiveApiKey(userId, 'openai') || undefined;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is required for voice interaction' },
        { status: 401 }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Step 1: Convert speech to text
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
      model: 'whisper-1',
      language: 'en',
      prompt: 'RoboRail machine operation, maintenance, troubleshooting, safety protocols',
    });

    if (!transcription.text) {
      return NextResponse.json(
        { error: 'Could not transcribe audio' },
        { status: 400 }
      );
    }

    // Step 2: Process the text with RoboRail knowledge
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ROBORAIL_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: transcription.text,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'roborailKnowledge',
            description: 'Access RoboRail-specific technical knowledge, error codes, safety protocols, and troubleshooting information',
            parameters: {
              type: 'object',
              properties: {
                query_type: {
                  type: 'string',
                  enum: ['error_code', 'safety_protocol', 'specification', 'maintenance', 'troubleshooting', 'contact_info', 'general'],
                  description: 'Type of information requested',
                },
                specific_query: {
                  type: 'string',
                  description: 'Specific question or error code',
                },
                safety_level: {
                  type: 'string',
                  enum: ['basic', 'detailed'],
                  description: 'Level of safety information detail',
                },
              },
              required: ['query_type', 'specific_query'],
            },
          },
        },
      ],
      temperature: 0.7,
      max_tokens: 500, // Keep responses concise for voice
    });

    let responseText = completion.choices[0]?.message?.content || 'I apologize, but I could not process your request.';

    // If the model called the roborail knowledge tool, process it
    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function.name === 'roborailKnowledge') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const knowledgeResult = await roborailKnowledgeTool.execute(args);
        
        if (knowledgeResult.success) {
          // Format the response for voice output
          const data = knowledgeResult.data as any;
          if (data.error_code) {
            responseText = `Error code ${data.error_code}: ${data.description}. ${data.safety_note}`;
          } else if (data.safety_protocols) {
            responseText = `Here are the safety protocols: ${data.safety_protocols.preOperation?.slice(0, 3).join(', ')}. Always prioritize safety.`;
          } else if (data.troubleshooting) {
            responseText = `For this issue, check: ${data.troubleshooting.causes?.slice(0, 2).join(', ')}. Solutions include: ${data.troubleshooting.solutions?.slice(0, 2).join(', ')}.`;
          } else {
            responseText = `Based on the RoboRail knowledge base: ${JSON.stringify(data).substring(0, 200)}...`;
          }
        }
      } catch (error) {
        console.error('Error processing knowledge tool:', error);
      }
    }

    // Clean response text for better voice synthesis
    const cleanedText = responseText
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/⚠️/g, 'Warning:')
      .replace(/\[.*?\]\(.*?\)/g, 'link')
      .substring(0, 500) // Limit length for voice
      .trim();

    // Step 3: Convert text to speech
    const ttsResponse = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'nova', // Professional female voice
      input: cleanedText,
      response_format: 'mp3',
      speed: 0.9, // Slightly slower for industrial environment
    });

    // Convert response to base64
    const audioArrayBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

    // Log the interaction if supabase is available
    if (supabase) {
      try {
        await supabase
          .from('voice_interactions')
          .insert({
            user_id: userId,
            chat_id: chatId,
            session_id: sessionId || chatId,
            transcription: transcription.text,
            response_text: cleanedText,
            created_at: new Date().toISOString(),
          });
      } catch (error) {
        console.error('Failed to log voice interaction:', error);
      }
    }

    return NextResponse.json({
      success: true,
      transcription: transcription.text,
      response_text: cleanedText,
      audio: audioBase64,
      session_id: sessionId || chatId,
    });

  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process voice request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Alternative streaming implementation for real-time voice
export async function PUT(request: NextRequest) {
  try {
    const { audio, userId, isAuthenticated } = await request.json();

    if (!audio || !userId) {
      return NextResponse.json(
        { error: 'Audio data and user ID are required' },
        { status: 400 }
      );
    }

    // Get API key
    let apiKey: string | undefined;
    if (isAuthenticated) {
      const { getEffectiveApiKey } = await import('@/lib/user-keys');
      apiKey = await getEffectiveApiKey(userId, 'openai') || undefined;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key required' },
        { status: 401 }
      );
    }

    // Create a streaming response for real-time voice interaction
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const openai = new OpenAI({ apiKey });
          
          // Process audio in chunks for real-time response
          const audioBuffer = Buffer.from(audio, 'base64');
          
          // Quick transcription
          const transcription = await openai.audio.transcriptions.create({
            file: new File([audioBuffer], 'audio.webm', { type: 'audio/webm' }),
            model: 'whisper-1',
            language: 'en',
          });

          // Send transcription immediately
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'transcription', 
              text: transcription.text 
            })}\n\n`)
          );

          // Quick response generation
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: ROBORAIL_SYSTEM_PROMPT },
              { role: 'user', content: transcription.text }
            ],
            max_tokens: 200,
            temperature: 0.7,
          });

          const responseText = completion.choices[0]?.message?.content || 'Unable to process request';
          
          // Send response text
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'response', 
              text: responseText 
            })}\n\n`)
          );

          // Generate and send audio
          const ttsResponse = await openai.audio.speech.create({
            model: 'tts-1',
            voice: 'nova',
            input: responseText.substring(0, 300),
            response_format: 'mp3',
            speed: 0.9,
          });

          const audioArrayBuffer = await ttsResponse.arrayBuffer();
          const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'audio', 
              data: audioBase64 
            })}\n\n`)
          );

          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              message: error instanceof Error ? error.message : 'Unknown error' 
            })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process streaming voice request' },
      { status: 500 }
    );
  }
}