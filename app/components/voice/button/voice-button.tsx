'use client';

import React from 'react';
import { AudioWaveform, Mic, MicOff, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '../store/voice-store';
import { RealtimeAudioModal } from '../modal/realtime-audio-modal';

interface VoiceButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onTranscriptReady?: (transcript: string) => void;
  disabled?: boolean;
}

const sizeMap = {
  sm: 'size-8',
  md: 'size-10', 
  lg: 'size-12',
};

const iconSizeMap = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

export function VoiceButton({ 
  className, 
  size = 'md',
  onTranscriptReady,
  disabled = false 
}: VoiceButtonProps) {
  const {
    status,
    isRecording,
    error,
    finalTranscript,
    startSession,
    startRecording,
    stopRecording,
    reset,
  } = useVoiceStore();

  const [isPressed, setIsPressed] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Handle transcript changes
  useEffect(() => {
    if (finalTranscript && onTranscriptReady) {
      onTranscriptReady(finalTranscript);
    }
  }, [finalTranscript, onTranscriptReady]);

  // Visual feedback for recording state
  useEffect(() => {
    setShowPulse(isRecording);
  }, [isRecording]);

  const handleClick = useCallback(async () => {
    if (disabled) return;

    // If status is idle and we click the AudioWaveform icon, show the modal
    if (status === 'idle') {
      setShowModal(true);
      return;
    }

    try {
      if (status === 'connected') {
        startRecording();
      } else if (status === 'recording') {
        stopRecording();
      } else if (status === 'error') {
        reset();
      }
    } catch (error) {
      console.error('Voice button error:', error);
    }
  }, [status, disabled, startRecording, stopRecording, reset]);

  const handleMouseDown = useCallback(() => {
    if (disabled || status !== 'connected') return;
    setIsPressed(true);
    startRecording();
  }, [disabled, status, startRecording]);

  const handleMouseUp = useCallback(() => {
    if (!isPressed) return;
    setIsPressed(false);
    if (isRecording) {
      stopRecording();
    }
  }, [isPressed, isRecording, stopRecording]);

  // Handle mouse leave to prevent stuck recording
  const handleMouseLeave = useCallback(() => {
    if (isPressed) {
      setIsPressed(false);
      if (isRecording) {
        stopRecording();
      }
    }
  }, [isPressed, isRecording, stopRecording]);

  const getButtonState = useCallback((): {
    variant: 'default' | 'destructive' | 'ghost' | 'secondary';
    icon: React.ReactElement;
    tooltip: string;
    ariaLabel: string;
  } => {
    const iconSize = iconSizeMap[size];
    
    switch (status) {
      case 'idle':
        return {
          variant: 'ghost',
          icon: <AudioWaveform className={iconSize} />,
          tooltip: 'Start voice session',
          ariaLabel: 'Start voice session',
        };
      
      case 'connecting':
        return {
          variant: 'secondary',
          icon: <AudioWaveform className={cn(iconSize, 'animate-pulse')} />,
          tooltip: 'Connecting...',
          ariaLabel: 'Connecting to voice service',
        };
      
      case 'connected':
        return {
          variant: 'ghost',
          icon: <Mic className={iconSize} />,
          tooltip: 'Click or hold to record',
          ariaLabel: 'Start recording',
        };
      
      case 'recording':
      case 'transcribing':
        return {
          variant: 'default',
          icon: <Square className={cn(iconSize, 'fill-current')} />,
          tooltip: 'Recording... Click to stop',
          ariaLabel: 'Stop recording',
        };
      
      case 'processing':
        return {
          variant: 'secondary',
          icon: <AudioWaveform className={cn(iconSize, 'animate-pulse')} />,
          tooltip: 'Processing audio...',
          ariaLabel: 'Processing audio',
        };
      
      case 'error':
        return {
          variant: 'destructive',
          icon: <MicOff className={iconSize} />,
          tooltip: error?.message || 'Voice error - click to retry',
          ariaLabel: 'Voice error, click to retry',
        };
      
      case 'disconnecting':
        return {
          variant: 'ghost',
          icon: <AudioWaveform className={cn(iconSize, 'animate-pulse')} />,
          tooltip: 'Disconnecting...',
          ariaLabel: 'Disconnecting from voice service',
        };
      
      default:
        return {
          variant: 'ghost',
          icon: <AudioWaveform className={iconSize} />,
          tooltip: 'Voice input',
          ariaLabel: 'Voice input',
        };
    }
  }, [status, size, error]);

  const buttonState = getButtonState();
  const isActive = status === 'recording' || status === 'transcribing';

  const handleModalTranscript = useCallback((transcript: string) => {
    setShowModal(false);
    if (onTranscriptReady) {
      onTranscriptReady(transcript);
    }
  }, [onTranscriptReady]);

  return (
    <>
      <RealtimeAudioModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onTranscriptReady={handleModalTranscript}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
            aria-label={buttonState.ariaLabel}
            className={cn(
              sizeMap[size],
              'rounded-full transition-all duration-200 relative',
              isActive && 'ring-2 ring-primary ring-offset-2',
              showPulse && 'animate-pulse',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
            disabled={disabled || status === 'connecting' || status === 'processing' || status === 'disconnecting'}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            size="sm"
            type="button"
            variant={buttonState.variant}
          >
            {buttonState.icon}
            
            {/* Recording indicator */}
            {isActive && (
              <div className="absolute -top-1 -right-1 size-3 bg-red-500 rounded-full animate-ping" />
            )}
            
            {/* Connection indicator */}
            {status === 'connected' && !isActive && (
              <div className="absolute -top-1 -right-1 size-2 bg-green-500 rounded-full" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{buttonState.tooltip}</p>
          {status === 'connected' && (
            <p className="text-xs text-muted-foreground mt-1">
              Hold to record, release to stop
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
    </>
  );
}