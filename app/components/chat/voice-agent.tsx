'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface VoiceAgentProps {
  chatId: string;
  onTranscription?: (transcription: string) => void;
  onResponse?: (response: string) => void;
  disabled?: boolean;
}

interface VoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  error: string | null;
}

export function VoiceAgent({
  chatId,
  onTranscription,
  onResponse,
  disabled = false,
}: VoiceAgentProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isRecording: false,
    isProcessing: false,
    isPlaying: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if voice is supported
  const isVoiceSupported = typeof window !== 'undefined' && 
    'MediaRecorder' in window && 
    'navigator' in window && 
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices;

  const processAudio = useCallback(async (audioBlob: Blob) => {
    try {
      // Convert audio to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        // Call the voice API
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Audio.split(',')[1], // Remove data:audio/wav;base64, prefix
            chatId,
            userId: 'test-user', // In real implementation, get from user context
            isAuthenticated: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Voice API error: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          // Handle transcription
          if (data.transcription && onTranscription) {
            onTranscription(data.transcription);
          }

          // Handle response text
          if (data.response_text && onResponse) {
            onResponse(data.response_text);
          }

          // Play audio response if available
          if (data.audio) {
            await playAudio(data.audio);
          }
        } else {
          throw new Error(data.error || 'Voice processing failed');
        }
      };
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to process audio',
      }));
    } finally {
      setVoiceState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [chatId, onTranscription, onResponse]);

  const startRecording = useCallback(async () => {
    try {
      if (!isVoiceSupported) {
        throw new Error('Voice not supported in this browser');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await processAudio(audioBlob);
        
        // Stop all tracks to free up the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setVoiceState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording',
      }));
    }
  }, [isVoiceSupported, processAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setVoiceState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
    }
  }, []);

  const playAudio = async (base64Audio: string) => {
    try {
      setVoiceState(prev => ({ ...prev, isPlaying: true }));
      
      const audioBlob = new Blob(
        [Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setVoiceState(prev => ({ ...prev, isPlaying: false }));
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setVoiceState(prev => ({
          ...prev,
          isPlaying: false,
          error: 'Failed to play audio response',
        }));
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      setVoiceState(prev => ({
        ...prev,
        isPlaying: false,
        error: error instanceof Error ? error.message : 'Failed to play audio',
      }));
    }
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setVoiceState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (voiceState.isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [voiceState.isRecording, stopRecording, startRecording]);

  // Show error state or unsupported message
  if (!isVoiceSupported) {
    return (
      <div className="text-sm text-muted-foreground p-2 text-center">
        Voice not supported in this browser
      </div>
    );
  }

  if (voiceState.error) {
    return (
      <div className="text-sm text-destructive p-2 text-center">
        {voiceState.error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleRecording}
        disabled={disabled || voiceState.isProcessing}
        title={voiceState.isRecording ? 'Stop recording' : 'Start voice interaction'}
        className={`
          ${voiceState.isRecording ? 'bg-red-100 border-red-300 text-red-700' : ''}
          ${voiceState.isProcessing ? 'opacity-50' : ''}
        `}
      >
        {voiceState.isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {voiceState.isProcessing && (
          <span className="ml-1 text-xs">Processing...</span>
        )}
      </Button>

      {voiceState.isPlaying && (
        <Button
          variant="outline"
          size="sm"
          onClick={stopAudio}
          title="Stop audio playback"
        >
          <VolumeX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export default VoiceAgent;