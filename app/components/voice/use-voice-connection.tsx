"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RealtimeClient } from "@openai/realtime-api-beta"

export interface VoiceSessionConfig {
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

export interface VoiceConnectionState {
  isConnected: boolean
  isConnecting: boolean
  isRecording: boolean
  error: string | null
  transcript: string
  isSupported: boolean
}

export interface UseVoiceConnectionProps {
  userId: string | undefined
  isAuthenticated: boolean
  sessionConfig?: VoiceSessionConfig
  onTranscript?: (transcript: string) => void
  onError?: (error: string) => void
}

export function useVoiceConnection({
  userId,
  isAuthenticated,
  sessionConfig,
  onError
}: UseVoiceConnectionProps) {
  const [state, setState] = useState<VoiceConnectionState>({
    isConnected: false,
    isConnecting: false,
    isRecording: false,
    error: null,
    transcript: "",
    isSupported: typeof window !== "undefined" && 
      "MediaDevices" in window && 
      "getUserMedia" in window.navigator.mediaDevices
  })

  const realtimeClientRef = useRef<RealtimeClient | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // Initialize voice session
  const initializeSession = useCallback(async () => {
    if (!userId || !isAuthenticated) {
      setState(prev => ({ ...prev, error: "Authentication required" }))
      return
    }

    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: "Voice input not supported in this browser" }))
      return
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true, error: null }))

      // Get session configuration from backend
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          isAuthenticated,
          sessionConfig
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to initialize voice session")
      }

      await response.json() // Response data not currently used but needed for future implementation
      
      setState(prev => ({ 
        ...prev, 
        isConnected: true, 
        isConnecting: false 
      }))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize voice session"
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: errorMessage 
      }))
      onError?.(errorMessage)
    }
  }, [userId, isAuthenticated, sessionConfig, state.isSupported, onError])

  // Start recording
  const startRecording = useCallback(async () => {
    if (!state.isConnected || state.isRecording) return

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })

      mediaStreamRef.current = stream

      // Create audio context for processing
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
        sampleRate: 24000
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0)
        
        // Convert float32 to int16 for OpenAI API
        const int16Buffer = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const sample = Math.max(-1, Math.min(1, inputData[i]))
          int16Buffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        }

        // TODO: Send audio data to WebSocket
        // This would send the audio buffer to the OpenAI Realtime API
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setState(prev => ({ ...prev, isRecording: true, error: null }))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start recording"
      setState(prev => ({ ...prev, error: errorMessage }))
      onError?.(errorMessage)
    }
  }, [state.isConnected, state.isRecording, onError])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!state.isRecording) return

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    // Clean up audio context
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setState(prev => ({ ...prev, isRecording: false }))
  }, [state.isRecording])

  // Disconnect voice session
  const disconnect = useCallback(() => {
    stopRecording()
    
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }

    if (realtimeClientRef.current) {
      realtimeClientRef.current = null
    }

    setState(prev => ({ 
      ...prev, 
      isConnected: false, 
      isConnecting: false,
      transcript: "",
      error: null 
    }))
  }, [stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    state,
    initializeSession,
    startRecording,
    stopRecording,
    disconnect
  }
}