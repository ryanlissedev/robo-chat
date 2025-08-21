'use client';

import { useState, useCallback } from 'react';
import { Gear, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RealtimeVoice, useRealtimeVoice } from './realtime-voice';

interface VoiceInputBarProps {
  chatId?: string;
  onTranscription?: (text: string) => void;
  onResponse?: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export function VoiceInputBar({ 
  chatId, 
  onTranscription, 
  onResponse, 
  isOpen, 
  onToggle,
  className 
}: VoiceInputBarProps) {
  const {
    mode,
    handleTranscription,
    handleResponse,
    handleModeChange,
  } = useRealtimeVoice();

  const [showSettings, setShowSettings] = useState(false);

  const handleTranscriptionWithCallback = useCallback((text: string) => {
    handleTranscription(text);
    onTranscription?.(text);
  }, [handleTranscription, onTranscription]);

  const handleResponseWithCallback = useCallback((text: string) => {
    handleResponse(text);
    onResponse?.(text);
  }, [handleResponse, onResponse]);

  if (!isOpen) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg",
      "animate-in slide-in-from-bottom-2 duration-300",
      className
    )}>
      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-border p-4 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Voice Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Voice Mode</label>
                <div className="flex gap-2 mt-2">
                  <button
                    className={cn(
                      "px-3 py-2 text-sm rounded-md transition-all",
                      mode === 'transcription' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                    onClick={() => handleModeChange('transcription')}
                  >
                    Transcription Mode
                    <div className="text-xs text-muted-foreground mt-1">
                      Record → Process → Respond
                    </div>
                  </button>
                  <button
                    className={cn(
                      "px-3 py-2 text-sm rounded-md transition-all",
                      mode === 'realtime' 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted hover:bg-muted/80"
                    )}
                    onClick={() => handleModeChange('realtime')}
                  >
                    Realtime Mode
                    <div className="text-xs text-muted-foreground mt-1">
                      Live conversation
                    </div>
                  </button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <p><strong>Transcription Mode:</strong> Record your voice, get transcription, then AI responds with text and audio.</p>
                <p><strong>Realtime Mode:</strong> Live conversation with interruption support and real-time responses.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Voice Interface */}
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Voice Interface */}
            <div className="flex-1">
              <RealtimeVoice
                chatId={chatId}
                onTranscription={handleTranscriptionWithCallback}
                onResponse={handleResponseWithCallback}
                mode={mode}
                onModeChange={handleModeChange}
                className="w-full"
              />
            </div>

            {/* Settings Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "h-8 w-8 p-0 transition-colors",
                showSettings 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Gear className="h-4 w-4" />
            </Button>
          </div>

          {/* HGG Branding */}
          <div className="flex items-center justify-center mt-3 text-xs text-muted-foreground">
            <span>RoboRail Voice Assistant powered by HGG Profiling Equipment</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing the voice input bar
export function useVoiceInputBar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    toggle,
    open,
    close,
  };
}