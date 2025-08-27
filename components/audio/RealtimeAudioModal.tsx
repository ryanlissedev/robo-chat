'use client';

import { AudioWaveform, Settings, Volume2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { VoiceButton } from '@/components/app/voice/button/voice-button';
import { useVoiceIntegration } from '@/components/app/voice/hooks/use-voice-integration';
import { useWebRTCConnection } from '@/components/app/voice/hooks/use-webrtc-connection';
import type { VoiceConfig } from '@/components/app/voice/store/voice-store';
import { useVoiceStore } from '@/components/app/voice/store/voice-store';
import {
  AudioVisualizer,
  AudioVisualizerPresets,
} from '@/components/app/voice/visualizer/audio-visualizer';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { clientLogger } from '@/lib/utils/client-logger';

interface RealtimeAudioModalProps {
  children?: React.ReactNode;
  className?: string;
  onTranscriptReady?: (transcript: string) => void;
  isUserAuthenticated?: boolean;
  userId?: string;
}

export function RealtimeAudioModal({
  children,
  className,
  onTranscriptReady,
  isUserAuthenticated = false,
  userId,
}: RealtimeAudioModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const {
    status,
    isRecording,
    currentTranscript,
    finalTranscript,
    inputLevel,
    error,
    config,
    personalityMode,
    safetyProtocols,
    startSession,
    stopSession,
    updateConfig,
    setPersonalityMode,
    setSafetyProtocols,
    setUserId,
    clearTranscriptions,
    reset,
  } = useVoiceStore();

  // WebRTC connection for real-time audio streaming
  const { isConnecting, error: connectionError } = useWebRTCConnection();

  // Voice integration with vector store indexing (invoked for side effects)
  useVoiceIntegration({
    userId: isUserAuthenticated ? userId : undefined,
    autoIndexTranscripts: true,
    onTranscriptIndexed: (result) => {
      clientLogger.info('Transcript indexed to vector store', { result });
    },
    onIndexError: (error) => {
      clientLogger.error('Transcript indexing failed', error);
    },
  });

  // Set user ID when authenticated
  useEffect(() => {
    if (isUserAuthenticated && userId) {
      setUserId(userId);
    }
  }, [isUserAuthenticated, userId, setUserId]);

  // Handle modal open/close
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open) {
        stopSession();
        setShowSettings(false);
      }
    },
    [stopSession]
  );

  // Initialize session when modal opens
  useEffect(() => {
    if (isOpen && status === 'idle') {
      startSession();
    }
  }, [isOpen, status, startSession]);

  // Handle voice transcript completion
  useEffect(() => {
    if (finalTranscript && onTranscriptReady) {
      onTranscriptReady(finalTranscript);
      clearTranscriptions();
    }
  }, [finalTranscript, onTranscriptReady, clearTranscriptions]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError) {
      clientLogger.error('WebRTC connection error', connectionError);
    }
  }, [connectionError]);

  // Voice configuration handlers
  const handleVoiceChange = useCallback(
    (voice: VoiceConfig['voice']) => {
      updateConfig({ voice });
    },
    [updateConfig]
  );

  const handleLanguageChange = useCallback(
    (language: string) => {
      updateConfig({ language });
    },
    [updateConfig]
  );

  const handlePersonalityChange = useCallback(
    (mode: typeof personalityMode) => {
      setPersonalityMode(mode);
    },
    [setPersonalityMode]
  );

  // Get status display text and color
  const getStatusDisplay = useCallback(() => {
    switch (status) {
      case 'idle':
        return { text: 'Ready to start', color: 'text-gray-500' };
      case 'connecting':
        return { text: 'Connecting...', color: 'text-blue-500' };
      case 'connected':
        return { text: 'Connected', color: 'text-green-500' };
      case 'recording':
        return { text: 'Recording...', color: 'text-red-500' };
      case 'transcribing':
        return { text: 'Transcribing...', color: 'text-blue-500' };
      case 'processing':
        return { text: 'Processing...', color: 'text-blue-500' };
      case 'error':
        return { text: 'Error', color: 'text-red-500' };
      default:
        return { text: 'Unknown', color: 'text-gray-500' };
    }
  }, [status]);

  const statusDisplay = getStatusDisplay();
  const hasTranscript = currentTranscript.trim().length > 0;
  const canRecord = status === 'connected' && !error;
  const isProcessing =
    status === 'connecting' ||
    status === 'processing' ||
    status === 'transcribing';

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {children || (
            <Button
              variant="ghost"
              size="sm"
              className={cn('rounded-full', className)}
              aria-label="Open realtime audio modal"
            >
              <AudioWaveform className="size-5" />
            </Button>
          )}
        </DialogTrigger>

        <DialogContent
          className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          hasCloseButton={false}
        >
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <Volume2 className="size-6" />
                Realtime Audio
              </DialogTitle>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setShowSettings(!showSettings)}
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0"
                      aria-label="Open voice settings"
                    >
                      <Settings className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Voice settings</p>
                  </TooltipContent>
                </Tooltip>

                <Button
                  onClick={() => setIsOpen(false)}
                  size="sm"
                  variant="ghost"
                  className="size-8 p-0"
                  aria-label="Close realtime audio modal"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <DialogDescription className="text-sm text-muted-foreground">
              Real-time voice conversation with OpenAI&#39;s audio API.
              {!isUserAuthenticated && ' Sign in to save transcripts.'}
            </DialogDescription>

            {/* Status indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div
                className={cn('size-2 rounded-full', {
                  'bg-gray-400': status === 'idle',
                  'bg-blue-500 animate-pulse':
                    status === 'connecting' || status === 'processing',
                  'bg-green-500': status === 'connected',
                  'bg-red-500': status === 'recording' || status === 'error',
                  'bg-yellow-500': status === 'transcribing',
                })}
              />
              <span className={statusDisplay.color}>{statusDisplay.text}</span>
              {isConnecting && (
                <span className="text-xs text-muted-foreground">(WebRTC)</span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Settings panel */}
            {showSettings && (
              <div className="p-4 bg-gray-50 rounded-lg space-y-4">
                <h3 className="font-medium text-sm">Voice Configuration</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Voice
                    </label>
                    <select
                      value={config.voice}
                      onChange={(e) =>
                        handleVoiceChange(e.target.value as typeof config.voice)
                      }
                      className="w-full p-2 text-xs border rounded"
                      aria-label="Select voice"
                    >
                      <option value="alloy">Alloy</option>
                      <option value="echo">Echo</option>
                      <option value="fable">Fable</option>
                      <option value="onyx">Onyx</option>
                      <option value="nova">Nova</option>
                      <option value="shimmer">Shimmer</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Language
                    </label>
                    <select
                      value={config.language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className="w-full p-2 text-xs border rounded"
                      aria-label="Select language"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                      <option value="it-IT">Italian</option>
                      <option value="pt-BR">Portuguese</option>
                      <option value="ja-JP">Japanese</option>
                      <option value="zh-CN">Chinese</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Safety Protocols
                    </label>
                    <Switch
                      checked={safetyProtocols}
                      onCheckedChange={setSafetyProtocols}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Voice Activity Detection
                    </label>
                    <Switch
                      checked={config.enableVAD}
                      onCheckedChange={(checked) =>
                        updateConfig({ enableVAD: checked })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Personality Mode
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        'safety-focused',
                        'technical-expert',
                        'friendly-assistant',
                      ] as const
                    ).map((mode) => (
                      <Button
                        key={mode}
                        onClick={() => handlePersonalityChange(mode)}
                        size="sm"
                        variant={
                          personalityMode === mode ? 'default' : 'outline'
                        }
                        className="text-xs"
                      >
                        {mode === 'safety-focused' && '🛡️ Safety'}
                        {mode === 'technical-expert' && '🔧 Technical'}
                        {mode === 'friendly-assistant' && '😊 Assistant'}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audio visualizer */}
            <div className="flex justify-center">
              <AudioVisualizer
                {...AudioVisualizerPresets.standard}
                className="w-full max-w-md"
                variant={isRecording ? 'waveform' : 'pulse'}
                width={320}
                height={80}
                color="#3b82f6"
              />
            </div>

            {/* Audio level indicator */}
            {(isRecording || inputLevel > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Input Level</span>
                  <span>{inputLevel}%</span>
                </div>
                <Progress value={inputLevel} className="h-2" />
              </div>
            )}

            {/* Recording controls */}
            <div className="flex justify-center py-4">
              <VoiceButton
                size="lg"
                className="size-20"
                onTranscriptReady={onTranscriptReady}
                disabled={!canRecord}
              />
            </div>

            {/* Instructions */}
            <div className="text-center space-y-2">
              {canRecord ? (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Click to start/stop recording</p>
                  <p className="text-xs">
                    Hold for continuous recording • Release to stop
                  </p>
                </div>
              ) : isProcessing ? (
                <div className="text-sm text-blue-600">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin size-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                    Setting up audio connection...
                  </div>
                </div>
              ) : error ? (
                <div className="text-sm text-red-600 space-y-2">
                  <p className="font-medium">⚠️ Audio Error</p>
                  <p className="text-xs">{error.message}</p>
                  <Button
                    onClick={() => reset()}
                    size="sm"
                    variant="outline"
                    className="text-xs"
                  >
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  <p>Initializing audio session...</p>
                </div>
              )}
            </div>

            {/* Real-time transcription */}
            {hasTranscript && (
              <div className="space-y-2">
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Live Transcription</h4>
                  <div className="p-3 bg-gray-50 rounded-lg min-h-[60px]">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {currentTranscript}
                      {isRecording && (
                        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer info */}
            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Powered by OpenAI Realtime API •
                {isUserAuthenticated
                  ? ' Transcripts auto-saved'
                  : ' Sign in to save transcripts'}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
