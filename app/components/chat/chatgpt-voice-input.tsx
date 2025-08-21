'use client';

import { Mic, MicOff, AudioAudioWaveform } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/user-store/provider';

interface ChatGPTVoiceInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onSend?: () => void;
  chatId?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatGPTVoiceInput({ 
  value,
  onValueChange,
  onSend,
  chatId,
  disabled,
  placeholder = "Ask about RoboRail operation, maintenance, or safety...",
  className 
}: ChatGPTVoiceInputProps) {
  const { user } = useUser();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(10).fill(0));
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [showAudioWaveform, setShowAudioWaveform] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for voice support
  useEffect(() => {
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const hasWebAudio = typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined';
    setIsSupported(hasMediaRecorder && hasWebAudio);
  }, []);

  // Real-time audio visualization
  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Create 10 frequency bands for waveform visualization
    const bandSize = Math.floor(dataArray.length / 10);
    const levels = Array.from({ length: 10 }, (_, i) => {
      const start = i * bandSize;
      const end = start + bandSize;
      const slice = dataArray.slice(start, end);
      const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
      return Math.min(average / 255, 1);
    });

    setAudioLevels(levels);

    if (isListening) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    }
  }, [isListening]);

  // Update recording progress
  const updateProgress = useCallback(() => {
    if (!recordingStartTimeRef.current) return;
    
    const elapsed = Date.now() - recordingStartTimeRef.current;
    const progress = Math.min(elapsed / 30000, 1); // 30 second max
    setRecordingProgress(progress);
    
    if (progress >= 1) {
      stopRecording();
    }
  }, []);

  // Initialize audio recording
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

      // Set up audio analysis for waveform
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      return stream;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      throw error;
    }
  }, []);

  // Start voice recording
  const startRecording = useCallback(async () => {
    if (!isSupported || disabled || isListening) return;

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
        await processVoiceInput(audioBlob);
        cleanup();
      };

      mediaRecorderRef.current = mediaRecorder;
      recordingStartTimeRef.current = Date.now();
      
      // Start progress tracking
      progressIntervalRef.current = setInterval(updateProgress, 100);
      
      mediaRecorder.start();
      setIsListening(true);
      setShowAudioWaveform(true);
      updateAudioLevels();

    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [isSupported, disabled, isListening, initializeAudio, updateAudioLevels, updateProgress]);

  // Stop voice recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      setShowAudioWaveform(false);
    }
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    
    recordingStartTimeRef.current = null;
    setRecordingProgress(0);
  }, [isListening]);

  // Process voice input with OpenAI
  const processVoiceInput = useCallback(async (audioBlob: Blob) => {
    if (!user?.id || !chatId) return;

    setIsProcessing(true);

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
        // Add transcription to current input
        const newValue = value ? `${value} ${result.transcription}` : result.transcription;
        onValueChange(newValue);
        
        // Focus the textarea
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Voice processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, chatId, value, onValueChange]);

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
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setAudioLevels(new Array(10).fill(0));
  }, []);

  // Toggle recording
  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && onSend) {
        onSend();
      }
    }
  }, [value, onSend]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className={cn("relative", className)}>
      {/* Main Input Container */}
      <div className={cn(
        "relative flex items-center bg-gray-100 rounded-[24px] border border-gray-200 overflow-hidden transition-all duration-200 shadow-sm",
        isListening && "border-red-300 bg-red-50 shadow-red-100",
        isProcessing && "border-blue-300 bg-blue-50 shadow-blue-100",
        "hover:border-gray-300 focus-within:border-blue-400 focus-within:shadow-blue-100"
      )}>
        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isListening || isProcessing}
          className={cn(
            "flex-1 resize-none bg-transparent border-none outline-none px-5 py-3 text-base placeholder:text-gray-500",
            "min-h-[52px] max-h-[120px] overflow-y-auto scrollbar-hide leading-6",
            (isListening || isProcessing) && "text-gray-400"
          )}
          rows={1}
          style={{ 
            fieldSizing: 'content',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        />

        {/* Mic Button */}
        <div className="flex items-center gap-2 px-3">
          {isSupported && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isProcessing}
              onClick={handleMicClick}
              className={cn(
                "h-10 w-10 p-0 rounded-full transition-all duration-200 hover:scale-105",
                isListening 
                  ? "text-red-600 hover:text-red-700 bg-red-100 hover:bg-red-200 scale-110" 
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              )}
            >
              {isProcessing ? (
                <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" />
              ) : isListening ? (
                <MicSlash className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* AudioWaveform Visualization Button */}
          {showAudioWaveform && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-full bg-orange-100 hover:bg-orange-200 border border-orange-200"
              disabled
            >
              <div className="flex items-center justify-center gap-px">
                {audioLevels.slice(0, 4).map((level, i) => (
                  <div
                    key={i}
                    className="w-1 bg-orange-600 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(3, level * 16)}px`,
                    }}
                  />
                ))}
              </div>
            </Button>
          )}
        </div>
      </div>

      {/* Recording Progress Bar */}
      {isListening && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 rounded-b-[24px] overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-100 ease-out rounded-r-[24px]"
            style={{ width: `${recordingProgress * 100}%` }}
          />
        </div>
      )}

      {/* Status Text */}
      {(isListening || isProcessing) && (
        <div className="absolute -bottom-6 left-4 text-xs text-muted-foreground">
          {isListening && "🎙️ Listening..."}
          {isProcessing && "🤖 Processing voice..."}
        </div>
      )}
    </div>
  );
}

// Enhanced hook for ChatGPT-style voice input
export function useChatGPTVoiceInput() {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');

  const toggleVoiceMode = useCallback(() => {
    setIsVoiceMode(prev => !prev);
  }, []);

  const handleTranscription = useCallback((text: string) => {
    setLastTranscription(text);
  }, []);

  return {
    isVoiceMode,
    lastTranscription,
    toggleVoiceMode,
    handleTranscription,
  };
}