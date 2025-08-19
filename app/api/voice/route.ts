import { NextRequest } from "next/server"
import { validateAndTrackUsage } from "../chat/api"
import { extractErrorMessage } from "../chat/utils"

export const maxDuration = 60

interface VoiceSessionRequest {
  userId: string
  isAuthenticated: boolean
  sessionConfig?: {
    instructions?: string
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
    turnDetection?: {
      type: "server_vad" | "semantic_vad" | "none"
      threshold?: number
      prefixPaddingMs?: number
      silenceDurationMs?: number
      createResponse?: boolean
    }
    inputAudioTranscription?: {
      model: "whisper-1" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe"
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get("userId")
    const isAuthenticated = url.searchParams.get("isAuthenticated") === "true"

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId parameter" }),
        { status: 400 }
      )
    }

    // Validate user and track usage
    const supabase = await validateAndTrackUsage({
      userId,
      model: "gpt-4o-realtime-preview",
      isAuthenticated,
    })

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401 }
      )
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = req.headers.get("upgrade")
    if (upgradeHeader !== "websocket") {
      return new Response(
        JSON.stringify({ error: "WebSocket upgrade required" }),
        { status: 400 }
      )
    }

    // For now, return a response indicating WebSocket support
    // In a full implementation, we would handle the WebSocket upgrade here
    return new Response(
      JSON.stringify({ 
        message: "Voice WebSocket endpoint ready",
        supportedFeatures: [
          "realtime-conversations", 
          "voice-activity-detection", 
          "transcription"
        ]
      }),
      { 
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )

  } catch (err: unknown) {
    console.error("Error in /api/voice:", err)
    return new Response(
      JSON.stringify({ error: extractErrorMessage(err) }),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VoiceSessionRequest
    const { userId, isAuthenticated, sessionConfig } = body

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400 }
      )
    }

    // Validate user and track usage
    const supabase = await validateAndTrackUsage({
      userId,
      model: "gpt-4o-realtime-preview",
      isAuthenticated,
    })

    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { status: 401 }
      )
    }

    // Get API key for OpenAI
    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      apiKey = (await getEffectiveApiKey(userId, "openai")) || undefined
    }

    if (!apiKey) {
      // Fallback to system API key
      apiKey = process.env.OPENAI_API_KEY
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500 }
      )
    }

    // Initialize OpenAI Realtime client for future use
    // const client = new RealtimeClient({ 
    //   apiKey
    // })

    // Configure session with provided settings or defaults
    const defaultConfig = {
      instructions: sessionConfig?.instructions || 
        "You are RoboRail Assistant, an AI safety and security expert. Provide helpful, accurate responses for technical support and guidance.",
      voice: sessionConfig?.voice || "alloy",
      turnDetection: sessionConfig?.turnDetection || {
        type: "server_vad" as const,
        threshold: 0.5,
        prefixPaddingMs: 300,
        silenceDurationMs: 200,
        createResponse: true
      },
      inputAudioTranscription: sessionConfig?.inputAudioTranscription || {
        model: "whisper-1" as const
      }
    }

    // Return session configuration for client-side WebSocket connection
    return new Response(
      JSON.stringify({
        sessionConfig: defaultConfig,
        websocketUrl: `/api/voice?userId=${userId}&isAuthenticated=${isAuthenticated}`,
        status: "ready"
      }),
      { 
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )

  } catch (err: unknown) {
    console.error("Error creating voice session:", err)
    return new Response(
      JSON.stringify({ error: extractErrorMessage(err) }),
      { status: 500 }
    )
  }
}