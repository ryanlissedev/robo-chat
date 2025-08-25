'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AudioWaveform, X, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from '../visualizer/audio-visualizer';

interface RealtimeAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscriptReady?: (transcript: string) => void;
}

export function RealtimeAudioModal({
  isOpen,
  onClose,
  onTranscriptReady,
}: RealtimeAudioModalProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Initialize WebSocket connection to OpenAI Realtime API
  const connectToRealtimeAPI = useCallback(async () => {
    try {
      // Get API key from environment or server
      const response = await fetch('/api/realtime/connect', { method: 'POST' });
      const { url, headers } = await response.json();
      
      const websocket = new WebSocket(url || 'wss://api.openai.com/v1/realtime');
      
      websocket.onopen = () => {
        setIsConnected(true);
        setError(null);
        console.log('Connected to OpenAI Realtime API');
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'response.audio_transcript.delta') {
          setTranscript(prev => prev + data.delta);
        } else if (data.type === 'response.audio_transcript.done') {
          if (onTranscriptReady && transcript) {
            onTranscriptReady(transcript);
          }
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Please try again.');
        setIsConnected(false);
      };

      websocket.onclose = () => {
        setIsConnected(false);
        console.log('Disconnected from OpenAI Realtime API');
      };

      setWs(websocket);
    } catch (err) {
      console.error('Failed to connect:', err);
      setError('Failed to connect to realtime service');
    }
  }, [transcript, onTranscriptReady]);

  // Start audio recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          // Send audio data to OpenAI
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.result) {
              ws.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: reader.result.toString().split(',')[1], // Base64 audio
              }));
            }
          };
          reader.readAsDataURL(event.data);
          audioChunks.push(event.data);
        }
      };

      // Visualizer setup
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          requestAnimationFrame(updateLevel);
        }
      };
      updateLevel();

      recorder.start(100); // Send chunks every 100ms
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Microphone access denied or unavailable');
    }
  }, [ws, isRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setMediaRecorder(null);
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  }, [mediaRecorder, ws]);

  // Handle connection toggle
  const toggleConnection = useCallback(async () => {
    if (isConnected) {
      stopRecording();
      ws?.close();
      setWs(null);
      setIsConnected(false);
    } else {
      await connectToRealtimeAPI();
    }
  }, [isConnected, ws, connectToRealtimeAPI, stopRecording]);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      stopRecording();
      ws?.close();
    };
  }, [ws, stopRecording]);

  // Handle modal close
  const handleClose = useCallback(() => {
    stopRecording();
    ws?.close();
    setTranscript('');
    setError(null);
    onClose();
  }, [ws, stopRecording, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent 
        className={cn(
          "max-w-2xl w-[calc(100%-1rem)] sm:w-[90vw] md:w-full",
          "h-[calc(100vh-2rem)] sm:h-[80vh] md:h-[600px]",
          "p-3 sm:p-4 md:p-6",
          "overflow-hidden"
        )}
        hasCloseButton={false}
      >
        <DialogHeader className="pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <AudioWaveform className="size-5 sm:size-6 text-primary" />
              <div>
                <DialogTitle className="text-lg sm:text-xl">Realtime Audio</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm mt-0.5 sm:mt-1">
                  Talk naturally with AI
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="rounded-full hover:bg-secondary/80 size-8 sm:size-9"
            >
              <X className="size-4 sm:size-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col h-[calc(100%-60px)] sm:h-[calc(100%-80px)] gap-3 sm:gap-4 pt-3 sm:pt-4">
          {/* Status Section */}
          <div className="flex items-center justify-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              isConnected 
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            )}>
              <div className={cn(
                "size-2 rounded-full",
                isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"
              )} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            {error && (
              <div className="text-sm text-red-500 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Audio Visualizer */}
          <div className="flex-1 flex items-center justify-center p-3 sm:p-4 bg-secondary/20 rounded-lg">
            {isRecording ? (
              <AudioVisualizer 
                audioLevel={audioLevel} 
                isActive={isRecording}
                className="w-full h-24 sm:h-32"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <AudioWaveform className="size-12 sm:size-16 mx-auto mb-2 sm:mb-4 opacity-30" />
                <p className="text-xs sm:text-sm">
                  {isConnected 
                    ? 'Ready to listen. Tap the microphone.'
                    : 'Tap connect to start.'}
                </p>
              </div>
            )}
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="p-3 sm:p-4 bg-secondary/10 rounded-lg max-h-32 sm:max-h-40 overflow-y-auto">
              <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-muted-foreground">Transcript:</p>
              <p className="text-xs sm:text-sm">{transcript}</p>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 pt-3 sm:pt-4 border-t">
            <Button
              variant={isConnected ? "destructive" : "default"}
              size="default"
              onClick={toggleConnection}
              className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4"
            >
              {isConnected ? (
                <>
                  <PhoneOff className="size-4 sm:size-5" />
                  <span className="hidden sm:inline">Disconnect</span>
                  <span className="sm:hidden">End</span>
                </>
              ) : (
                <>
                  <Phone className="size-4 sm:size-5" />
                  Connect
                </>
              )}
            </Button>

            <Button
              variant={isRecording ? "secondary" : "default"}
              size="default"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isConnected}
              className={cn(
                "gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4",
                isRecording && "animate-pulse"
              )}
            >
              {isRecording ? (
                <>
                  <MicOff className="size-4 sm:size-5" />
                  <span className="hidden sm:inline">Stop Recording</span>
                  <span className="sm:hidden">Stop</span>
                </>
              ) : (
                <>
                  <Mic className="size-4 sm:size-5" />
                  <span className="hidden sm:inline">Start Recording</span>
                  <span className="sm:hidden">Record</span>
                </>
              )}
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-[10px] sm:text-xs text-center text-muted-foreground space-y-0.5 sm:space-y-1">
            <p>Tap the microphone to speak, or hold to record.</p>
            <p className="sm:hidden">Swipe down to close.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}