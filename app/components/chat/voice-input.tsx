'use client';

import { Microphone, MicrophoneSlash, SpeakerHigh, SpeakerX } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function VoiceInput({ onTranscription, disabled, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && window.speechSynthesis) {
      setIsSupported(true);
      speechSynthesisRef.current = window.speechSynthesis;
    }
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || disabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript + interimTranscript);

      if (finalTranscript) {
        onTranscription(finalTranscript.trim());
        recognition.stop();
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, disabled, onTranscription]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setTranscript('');
  }, []);

  const speakText = useCallback((text: string) => {
    if (!speechSynthesisRef.current || isSpeaking) return;

    // Cancel any ongoing speech
    speechSynthesisRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    // Use a professional voice if available
    const voices = speechSynthesisRef.current.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Microsoft') || voice.name.includes('Google'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesisRef.current.speak(utterance);
  }, [isSpeaking]);

  const toggleSpeech = useCallback(() => {
    if (isSpeaking) {
      speechSynthesisRef.current?.cancel();
      setIsSpeaking(false);
    } else {
      // Speak a sample message for RoboRail
      speakText("RoboRail Assistant ready. Please state your question about operation, maintenance, or safety.");
    }
  }, [isSpeaking, speakText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Voice Input Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={isListening ? stopListening : startListening}
        className={cn(
          "h-8 w-8 p-0 transition-colors",
          isListening && "bg-red-100 border-red-300 hover:bg-red-200"
        )}
        title={isListening ? "Stop listening" : "Start voice input"}
      >
        {isListening ? (
          <MicrophoneSlash className="h-4 w-4 text-red-600" />
        ) : (
          <Microphone className="h-4 w-4" />
        )}
      </Button>

      {/* Text-to-Speech Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={toggleSpeech}
        className={cn(
          "h-8 w-8 p-0 transition-colors",
          isSpeaking && "bg-blue-100 border-blue-300 hover:bg-blue-200"
        )}
        title={isSpeaking ? "Stop speaking" : "Test voice output"}
      >
        {isSpeaking ? (
          <SpeakerHigh className="h-4 w-4 text-blue-600" />
        ) : (
          <SpeakerX className="h-4 w-4" />
        )}
      </Button>

      {/* Live transcript display */}
      {isListening && transcript && (
        <div className="flex-1 text-sm text-muted-foreground italic">
          Listening: "{transcript}"
        </div>
      )}

      {/* Status indicators */}
      <div className="flex items-center gap-1">
        {isListening && (
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
        )}
        {isSpeaking && (
          <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>
    </div>
  );
}

// Hook to add voice output to assistant messages
export function useVoiceOutput() {
  const [isEnabled, setIsEnabled] = useState(false);
  const speechSynthesisRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (window.speechSynthesis) {
      speechSynthesisRef.current = window.speechSynthesis;
    }
  }, []);

  const speakMessage = useCallback((text: string) => {
    if (!speechSynthesisRef.current || !isEnabled) return;

    // Clean the text for better speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/⚠️/g, 'Warning:')
      .replace(/\[.*?\]\(.*?\)/g, 'link')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 0.7;

    // Use a professional voice
    const voices = speechSynthesisRef.current.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Microsoft') || voice.name.includes('Google'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    speechSynthesisRef.current.speak(utterance);
  }, [isEnabled]);

  const toggleVoiceOutput = useCallback(() => {
    setIsEnabled(prev => !prev);
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
    }
  }, []);

  return {
    isEnabled,
    speakMessage,
    toggleVoiceOutput,
  };
}