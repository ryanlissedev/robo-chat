'use client';

import { Mic, MicOff, Volume2, VolumeX, AudioWaveform, Square, Pause } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/user-store/provider';

interface VoiceAgentProps {
  chatId?: string;
  onTranscription?: (text: string) => void;
  onResponse?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

interface VoiceResponse {
  success: boolean;
  transcription: string;
  response_text: string;
  audio: string;
  session_id: string;
  error?: string;
}

export function VoiceAgent({ 
  chatId, 
  onTranscription, 
  onResponse, 
  disabled, 
  className 
}: VoiceAgentProps) {
  const { user } = useUser();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check for voice support
  useEffect(() => {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasWebAudio = typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
    setIsSupported(hasMediaRecorder && hasWebAudio);
  }, []);

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(average / 255);

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!isSupported || disabled || isRecording) return;

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

      // Set up audio analysis for visualization
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Set up media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript('');
      updateAudioLevel();

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [isSupported, disabled, isRecording, updateAudioLevel]);

  // Square recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isRecording]);

  // Process audio with OpenAI voice API
  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!user?.id || !chatId) return;

    setIsProcessing(true);
    setTranscript('Processing...');

    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));

      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          userId: user.id,
          chatId,
          isAuthenticated: !!user?.id && !user?.anonymous,
        }),
      });

      const result: VoiceResponse = await response.json();

      if (result.success) {
        setTranscript(result.transcription);
        setCurrentResponse(result.response_text);
        
        // Call callbacks
        onTranscription?.(result.transcription);
        onResponse?.(result.response_text);

        // Play response audio
        if (result.audio) {
          await playAudioResponse(result.audio);
        }
      } else {
        setTranscript(`Error: ${result.error || 'Failed to process audio'}`);
      }
    } catch (error) {
      console.error('Voice processing error:', error);
      setTranscript('Error processing voice request');
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, chatId, onTranscription, onResponse]);

  // Play audio response
  const playAudioResponse = useCallback(async (audioBase64: string) => {
    try {
      setIsPlaying(true);
      
      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlaying(false);
    }
  }, []);

  // Square audio playback
  const stopAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  if (!isSupported) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        Voice not supported in this browser
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Main Voice Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || isProcessing}
        onClick={toggleRecording}
        className={cn(
          "h-10 w-10 p-0 transition-all duration-200",
          isRecording && "bg-red-100 border-red-300 hover:bg-red-200 scale-110",
          isProcessing && "bg-blue-100 border-blue-300"
        )}
        title={isRecording ? "Square recording" : "Start voice interaction"}
      >
        {isProcessing ? (
          <AudioWaveform className="h-5 w-5 text-blue-600 animate-pulse" />
        ) : isRecording ? (
          <MicSlash className="h-5 w-5 text-red-600" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {/* Audio Level Indicator */}
      {isRecording && (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1 bg-red-500 rounded-full transition-all duration-100",
                audioLevel * 5 > i ? "h-4" : "h-1"
              )}
            />
          ))}
        </div>
      )}

      {/* Square Audio Button */}
      {isPlaying && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={stopAudio}
          className="h-8 w-8 p-0 bg-blue-100 border-blue-300 hover:bg-blue-200"
          title="Square audio"
        >
          <Square className="h-4 w-4 text-blue-600" />
        </Button>
      )}

      {/* Status Text */}
      <div className="flex-1 min-w-0">
        {isRecording && (
          <div className="text-sm text-red-600 font-medium animate-pulse">
            🎙️ Listening...
          </div>
        )}
        {isProcessing && (
          <div className="text-sm text-blue-600 font-medium">
            🤖 Processing...
          </div>
        )}
        {isPlaying && (
          <div className="text-sm text-green-600 font-medium flex items-center gap-1">
            <Volume2 className="h-4 w-4" />
            Speaking response
          </div>
        )}
        {transcript && !isRecording && !isProcessing && !isPlaying && (
          <div className="text-sm text-muted-foreground truncate">
            "{transcript}"
          </div>
        )}
      </div>

      {/* Voice Status Indicators */}
      <div className="flex items-center gap-1">
        {isRecording && (
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        )}
        {isProcessing && (
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
        )}
        {isPlaying && (
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    </div>
  );
}

// Enhanced hook for voice interactions
export function useVoiceAgent(chatId?: string) {
  const [isActive, setIsActive] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [voiceHistory, setVoiceHistory] = useState<Array<{
    transcription: string;
    response: string;
    timestamp: Date;
  }>>([]);

  const handleTranscription = useCallback((text: string) => {
    setLastTranscription(text);
  }, []);

  const handleResponse = useCallback((text: string) => {
    setLastResponse(text);
    setVoiceHistory(prev => [...prev, {
      transcription: lastTranscription,
      response: text,
      timestamp: new Date(),
    }]);
  }, [lastTranscription]);

  const clearHistory = useCallback(() => {
    setVoiceHistory([]);
    setLastTranscription('');
    setLastResponse('');
  }, []);

  return {
    isActive,
    setIsActive,
    lastTranscription,
    lastResponse,
    voiceHistory,
    handleTranscription,
    handleResponse,
    clearHistory,
  };
}