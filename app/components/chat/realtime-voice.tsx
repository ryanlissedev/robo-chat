'use client';

import { Mic, MicOff, Square, Pause, Play, AudioWaveform } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/user-store/provider';

interface RealtimeVoiceProps {
  chatId?: string;
  onTranscription?: (text: string) => void;
  onResponse?: (text: string) => void;
  disabled?: boolean;
  className?: string;
  mode?: 'transcription' | 'realtime';
  onModeChange?: (mode: 'transcription' | 'realtime') => void;
}

export function RealtimeVoice({ 
  chatId, 
  onTranscription, 
  onResponse, 
  disabled, 
  className,
  mode = 'transcription',
  onModeChange 
}: RealtimeVoiceProps) {
  const { user } = useUser();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  // Check for voice support
  useEffect(() => {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasWebAudio = typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
    const hasWebSocket = typeof WebSocket !== 'undefined';
    setIsSupported(hasMediaRecorder && hasWebAudio && hasWebSocket);
  }, []);

  // Real-time audio level visualization
  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Create 20 frequency bands for visualization
    const bandSize = Math.floor(dataArray.length / 20);
    const levels = Array.from({ length: 20 }, (_, i) => {
      const start = i * bandSize;
      const end = start + bandSize;
      const slice = dataArray.slice(start, end);
      const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
      return Math.min(average / 255, 1);
    });

    setAudioLevels(levels);

    if (isListening || isConnected) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    }
  }, [isListening, isConnected]);

  // Initialize audio context and microphone
  const initializeAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // Set up audio analysis
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      return stream;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }, []);

  // Transcription mode (original functionality)
  const startTranscription = useCallback(async () => {
    if (!isSupported || disabled) return;

    try {
      const stream = await initializeAudio();
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await processTranscription(audioBlob);
        cleanup();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      updateAudioLevels();

    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  }, [isSupported, disabled, initializeAudio, updateAudioLevels]);

  const stopTranscription = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  // Process transcription with OpenAI
  const processTranscription = useCallback(async (audioBlob: Blob) => {
    if (!user?.id || !chatId) return;

    setIsProcessing(true);
    setTranscript('Processing...');

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          userId: user.id,
          chatId,
          isAuthenticated: !!user?.id && !user?.anonymous,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setTranscript(result.transcription);
        onTranscription?.(result.transcription);
        onResponse?.(result.response_text);
      } else {
        setTranscript(`Error: ${result.error || 'Failed to process audio'}`);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscript('Error processing voice request');
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, chatId, onTranscription, onResponse]);

  // Realtime mode (WebSocket-based)
  const startRealtime = useCallback(async () => {
    if (!isSupported || disabled || !user?.id) return;

    try {
      const stream = await initializeAudio();
      
      // Create WebSocket connection for realtime
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`);
      websocketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsListening(true);
        updateAudioLevels();
        
        // Configure session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are the RoboRail Assistant. Provide expert support for RoboRail operation, maintenance, and safety. Be concise and prioritize safety.',
            voice: 'nova',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 200,
            },
          },
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'conversation.item.input_audio_transcription.completed':
            setTranscript(data.transcript);
            onTranscription?.(data.transcript);
            break;
          case 'response.audio.delta':
            // Handle audio response streaming
            break;
          case 'response.text.done':
            onResponse?.(data.text);
            break;
          case 'error':
            console.error('Realtime error:', data.error);
            break;
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsListening(false);
        cleanup();
      };

      // Set up audio streaming
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          event.data.arrayBuffer().then(buffer => {
            ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buffer)))),
            }));
          });
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Send chunks every 100ms

    } catch (error) {
      console.error('Failed to start realtime:', error);
    }
  }, [isSupported, disabled, user?.id, initializeAudio, updateAudioLevels, onTranscription, onResponse]);

  const stopRealtime = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close();
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsConnected(false);
    setIsListening(false);
    cleanup();
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevels(new Array(20).fill(0));
  }, []);

  // Toggle between modes
  const handleToggle = useCallback(() => {
    if (isListening || isConnected) {
      if (mode === 'transcription') {
        stopTranscription();
      } else {
        stopRealtime();
      }
    } else {
      if (mode === 'transcription') {
        startTranscription();
      } else {
        startRealtime();
      }
    }
  }, [mode, isListening, isConnected, startTranscription, stopTranscription, startRealtime, stopRealtime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [cleanup]);

  if (!isSupported) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Voice not supported in this browser
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          className={cn(
            "px-3 py-1 text-xs rounded-full transition-all",
            mode === 'transcription' 
              ? "bg-blue-100 text-blue-700 border border-blue-300" 
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
          onClick={() => onModeChange?.('transcription')}
          disabled={isListening || isConnected}
        >
          Transcription
        </button>
        <button
          className={cn(
            "px-3 py-1 text-xs rounded-full transition-all",
            mode === 'realtime' 
              ? "bg-blue-100 text-blue-700 border border-blue-300" 
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
          onClick={() => onModeChange?.('realtime')}
          disabled={isListening || isConnected}
        >
          Realtime
        </button>
      </div>

      {/* Audio Visualization */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {audioLevels.map((level, i) => (
          <div
            key={i}
            className={cn(
              "w-1 bg-gray-300 rounded-full transition-all duration-75",
              isListening || isConnected 
                ? "bg-gradient-to-t from-blue-500 to-blue-300" 
                : "bg-gray-200"
            )}
            style={{
              height: `${Math.max(4, level * 32)}px`,
              opacity: isListening || isConnected ? 0.7 + (level * 0.3) : 0.3,
            }}
          />
        ))}
      </div>

      {/* Main Voice Button */}
      <Button
        type="button"
        size="sm"
        disabled={disabled || isProcessing}
        onClick={handleToggle}
        className={cn(
          "h-12 w-12 rounded-full transition-all duration-200 shadow-lg",
          isListening || isConnected
            ? "bg-red-500 hover:bg-red-600 text-white scale-110 shadow-red-200" 
            : "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-200 hover:border-gray-300",
          isProcessing && "bg-blue-500 hover:bg-blue-600"
        )}
      >
        {isProcessing ? (
          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
        ) : isListening || isConnected ? (
          <Square className="h-5 w-5" />
        ) : mode === 'realtime' ? (
          <AudioWaveform className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {/* Status Text */}
      <div className="flex flex-col items-start min-w-0">
        {isListening && (
          <div className="text-sm text-red-600 font-medium">
            {mode === 'realtime' ? '🔴 Live' : '🎙️ Recording'}
          </div>
        )}
        {isProcessing && (
          <div className="text-sm text-blue-600 font-medium">
            Processing...
          </div>
        )}
        {isConnected && mode === 'realtime' && (
          <div className="text-sm text-green-600 font-medium">
            ✓ Connected
          </div>
        )}
        {transcript && !isListening && !isProcessing && (
          <div className="text-sm text-muted-foreground truncate max-w-48">
            "{transcript}"
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing voice modes
export function useRealtimeVoice() {
  const [mode, setMode] = useState<'transcription' | 'realtime'>('transcription');
  const [isActive, setIsActive] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastResponse, setLastResponse] = useState('');

  const handleTranscription = useCallback((text: string) => {
    setLastTranscription(text);
  }, []);

  const handleResponse = useCallback((text: string) => {
    setLastResponse(text);
  }, []);

  const handleModeChange = useCallback((newMode: 'transcription' | 'realtime') => {
    if (!isActive) {
      setMode(newMode);
    }
  }, [isActive]);

  return {
    mode,
    isActive,
    lastTranscription,
    lastResponse,
    handleTranscription,
    handleResponse,
    handleModeChange,
    setIsActive,
  };
}