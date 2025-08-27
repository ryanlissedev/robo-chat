'use client';

import {
  ArrowUp,
  Check,
  Copy,
  PencilIcon,
  RotateCcw,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '../store/voice-store';

interface TranscriptionPanelProps {
  className?: string;
  onSendTranscript?: (text: string) => void;
  onClose?: () => void;
  isVisible?: boolean;
}

export function TranscriptionPanel({
  className,
  onSendTranscript,
  onClose,
  isVisible = false,
}: TranscriptionPanelProps) {
  const {
    status,
    currentTranscript,
    finalTranscript,
    transcriptions,
    error,
    personalityMode,
    safetyProtocols,
    clearTranscriptions,
    updateCurrentTranscript,
    finalizeTranscript,
    reset,
  } = useVoiceStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editableText, setEditableText] = useState('');
  const [confidence, setConfidence] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update confidence based on latest transcription entry
  useEffect(() => {
    const latestEntry = transcriptions[transcriptions.length - 1];
    if (latestEntry && !latestEntry.isInterim) {
      setConfidence(Math.round(latestEntry.confidence * 100));
    }
  }, [transcriptions]);

  // Update editable text when final transcript changes
  useEffect(() => {
    if (finalTranscript && !isEditing) {
      setEditableText(finalTranscript);
    }
  }, [finalTranscript, isEditing]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
    setEditableText(finalTranscript || currentTranscript);
  }, [finalTranscript, currentTranscript]);

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditableText(finalTranscript);
  }, [finalTranscript]);

  const handleSaveEditing = useCallback(async () => {
    setIsEditing(false);
    updateCurrentTranscript(editableText);
    await finalizeTranscript();
  }, [editableText, updateCurrentTranscript, finalizeTranscript]);

  const handleSendTranscript = useCallback(() => {
    const textToSend = isEditing
      ? editableText
      : finalTranscript || currentTranscript;
    if (textToSend.trim()) {
      onSendTranscript?.(textToSend.trim());
      clearTranscriptions();
      setEditableText('');
      setIsEditing(false);
    }
  }, [
    isEditing,
    editableText,
    finalTranscript,
    currentTranscript,
    onSendTranscript,
    clearTranscriptions,
  ]);

  const handleCopyText = useCallback(async () => {
    const textToCopy = isEditing
      ? editableText
      : finalTranscript || currentTranscript;
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (_error) {}
  }, [isEditing, editableText, finalTranscript, currentTranscript]);

  const handleClear = useCallback(() => {
    clearTranscriptions();
    setEditableText('');
    setIsEditing(false);
  }, [clearTranscriptions]);

  const handleRetry = useCallback(() => {
    reset();
    setEditableText('');
    setIsEditing(false);
  }, [reset]);

  const getPersonalityIndicator = useCallback(() => {
    switch (personalityMode) {
      case 'safety-focused':
        return { label: 'Safety Mode', color: 'text-green-600', icon: '🛡️' };
      case 'technical-expert':
        return { label: 'Technical Mode', color: 'text-blue-600', icon: '🔧' };
      case 'friendly-assistant':
        return {
          label: 'Assistant Mode',
          color: 'text-purple-600',
          icon: '😊',
        };
      default:
        return { label: 'Standard Mode', color: 'text-gray-600', icon: '🤖' };
    }
  }, [personalityMode]);

  const displayText = isEditing
    ? editableText
    : finalTranscript || currentTranscript;
  const hasText = displayText.trim().length > 0;
  const isRecording = status === 'recording' || status === 'transcribing';
  const isProcessing = status === 'processing' || status === 'connecting';
  const hasError = status === 'error' && error;
  const personality = getPersonalityIndicator();

  if (!isVisible) return null;

  return (
    <TooltipProvider>
      <Card
        className={cn(
          'w-full max-w-2xl mx-auto border-2 transition-all duration-300',
          isRecording && 'border-red-200 bg-red-50/50',
          hasError && 'border-red-300 bg-red-50',
          className
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Volume2 className="size-5" />
              Voice Transcription
              {isRecording && (
                <div className="flex items-center gap-1">
                  <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-normal text-muted-foreground">
                    Recording...
                  </span>
                </div>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'text-xs px-2 py-1 rounded-full bg-gray-100',
                  personality.color
                )}
              >
                <span className="mr-1">{personality.icon}</span>
                {personality.label}
              </div>
              {safetyProtocols && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      🔒 Safe
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Safety protocols enabled</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {onClose && (
                <Button
                  onClick={onClose}
                  size="sm"
                  variant="ghost"
                  className="size-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Confidence indicator */}
          {confidence > 0 && !isRecording && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Confidence:</span>
              <Progress value={confidence} className="w-20 h-2" />
              <span>{confidence}%</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {hasError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <X className="size-5" />
                Voice Error
              </div>
              <p className="text-red-600 text-sm mb-3">{error.message}</p>
              <Button onClick={handleRetry} size="sm" variant="outline">
                <RotateCcw className="size-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Live transcription area */}
              <div
                className={cn(
                  'min-h-[120px] p-4 border-2 border-dashed rounded-lg transition-all',
                  isRecording
                    ? 'border-red-300 bg-red-50/30'
                    : 'border-gray-200 bg-gray-50/50',
                  hasText && 'border-solid bg-white'
                )}
              >
                {isEditing ? (
                  <Textarea
                    ref={textareaRef}
                    value={editableText}
                    onChange={(e) => setEditableText(e.target.value)}
                    className="min-h-[100px] border-none p-0 resize-none focus-visible:ring-0 text-base"
                    placeholder="Edit your transcription..."
                  />
                ) : (
                  <div className="min-h-[100px]">
                    {hasText ? (
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {displayText}
                        {isRecording && (
                          <span className="inline-block w-2 h-5 bg-gray-400 animate-pulse ml-1" />
                        )}
                      </p>
                    ) : (
                      <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin size-4 border-2 border-gray-300 border-t-gray-600 rounded-full" />
                            <span>Processing audio...</span>
                          </div>
                        ) : isRecording ? (
                          <span>Listening... Start speaking</span>
                        ) : (
                          <span>No transcription available</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent transcriptions */}
              {transcriptions.length > 1 && !isEditing && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Recent transcriptions:
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {transcriptions.slice(-5).map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          'text-xs p-2 rounded border',
                          entry.isInterim
                            ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                            : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <span className="opacity-60 mr-2">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        {entry.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3 border-t">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {hasText && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCopyText}
                        size="sm"
                        variant="outline"
                      >
                        <Copy className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy text</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleClear} size="sm" variant="outline">
                        <Trash2 className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear transcription</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {hasText &&
                !hasError &&
                (isEditing ? (
                  <>
                    <Button
                      onClick={handleCancelEditing}
                      size="sm"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEditing}
                      size="sm"
                      variant="default"
                    >
                      <Check className="size-4 mr-2" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleStartEditing}
                      size="sm"
                      variant="outline"
                    >
                      <PencilIcon className="size-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={handleSendTranscript}
                      size="sm"
                      variant="default"
                      disabled={isRecording || isProcessing}
                    >
                      <ArrowUp className="size-4 mr-2" />
                      Send to Chat
                    </Button>
                  </>
                ))}
            </div>
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
