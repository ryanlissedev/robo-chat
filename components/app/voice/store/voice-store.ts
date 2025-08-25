'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type VoiceSessionStatus = 
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'recording' 
  | 'transcribing'
  | 'processing'
  | 'error'
  | 'disconnecting';

export type TranscriptionEntry = {
  id: string;
  timestamp: number;
  text: string;
  confidence: number;
  isInterim: boolean;
  speakerId?: string;
};

export type VoiceConfig = {
  model: 'gpt-4o-realtime-preview' | 'gpt-4o-realtime-preview-2024-10-01';
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  language: string;
  enableVAD: boolean; // Voice Activity Detection
  noiseSuppressionLevel: 'low' | 'medium' | 'high';
  echoReduction: boolean;
  autoIndexTranscripts: boolean; // Auto-index transcripts to vector store
};

export type VoiceError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
};

export interface VoiceState {
  // Session management
  sessionId: string | null;
  status: VoiceSessionStatus;
  isRecording: boolean;
  isPlaying: boolean;
  
  // Audio configuration
  config: VoiceConfig;
  
  // Transcription data
  transcriptions: TranscriptionEntry[];
  currentTranscript: string;
  finalTranscript: string;
  
  // Audio levels and visualization
  inputLevel: number;
  outputLevel: number;
  visualizationData: Float32Array | null;
  
  // Error handling
  error: VoiceError | null;
  lastErrorTime: number;
  reconnectAttempts: number;
  
  // RoboRail personality
  personalityMode: 'safety-focused' | 'technical-expert' | 'friendly-assistant';
  safetyProtocols: boolean;
  
  // Vector store integration
  userId?: string;
  vectorStoreId?: string | null;
  indexingStatus: 'idle' | 'indexing' | 'completed' | 'failed';
  
  // Actions
  startSession: () => Promise<void>;
  stopSession: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearTranscriptions: () => void;
  updateConfig: (config: Partial<VoiceConfig>) => void;
  setError: (error: VoiceError | null) => void;
  addTranscription: (entry: TranscriptionEntry) => void;
  updateCurrentTranscript: (text: string) => void;
  finalizeTranscript: () => void;
  updateAudioLevels: (inputLevel: number, outputLevel?: number) => void;
  updateVisualizationData: (data: Float32Array) => void;
  setPersonalityMode: (mode: 'safety-focused' | 'technical-expert' | 'friendly-assistant') => void;
  setSafetyProtocols: (enabled: boolean) => void;
  setUserId: (userId: string) => void;
  indexTranscript: (transcript: string, metadata?: Record<string, unknown>) => Promise<void>;
  reset: () => void;
}

const defaultConfig: VoiceConfig = {
  model: 'gpt-4o-realtime-preview',
  voice: 'nova',
  language: 'en-US',
  enableVAD: true,
  noiseSuppressionLevel: 'medium',
  echoReduction: true,
  autoIndexTranscripts: true,
};

const initialState = {
  sessionId: null,
  status: 'idle' as VoiceSessionStatus,
  isRecording: false,
  isPlaying: false,
  config: defaultConfig,
  transcriptions: [],
  currentTranscript: '',
  finalTranscript: '',
  inputLevel: 0,
  outputLevel: 0,
  visualizationData: null,
  error: null,
  lastErrorTime: 0,
  reconnectAttempts: 0,
  personalityMode: 'safety-focused' as const,
  safetyProtocols: true,
  userId: undefined,
  vectorStoreId: null,
  indexingStatus: 'idle' as const,
};

export const useVoiceStore = create<VoiceState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      startSession: async () => {
        const { status } = get();
        if (status !== 'idle') return;

        try {
          set({ status: 'connecting' });
          
          const response = await fetch('/api/voice/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              config: get().config,
              personalityMode: get().personalityMode,
              safetyProtocols: get().safetyProtocols 
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to start session: ${response.statusText}`);
          }

          const { sessionId } = await response.json();
          
          set({
            sessionId,
            status: 'connected',
            error: null,
            reconnectAttempts: 0,
          });
        } catch (error) {
          const voiceError: VoiceError = {
            code: 'SESSION_START_FAILED',
            message: error instanceof Error ? error.message : 'Failed to start voice session',
            timestamp: Date.now(),
          };
          
          set({
            status: 'error',
            error: voiceError,
            lastErrorTime: Date.now(),
          });
        }
      },

      stopSession: () => {
        const { sessionId } = get();
        if (!sessionId) return;

        set({ status: 'disconnecting' });
        
        // Clean up WebRTC connection
        fetch('/api/voice/session', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(console.error);

        set({
          sessionId: null,
          status: 'idle',
          isRecording: false,
          isPlaying: false,
          currentTranscript: '',
          inputLevel: 0,
          outputLevel: 0,
          visualizationData: null,
        });
      },

      startRecording: () => {
        const { status } = get();
        if (status !== 'connected') return;
        
        set({ 
          isRecording: true, 
          status: 'recording',
          currentTranscript: '' 
        });
      },

      stopRecording: () => {
        set({ 
          isRecording: false,
          status: 'connected' 
        });
      },

      clearTranscriptions: () => {
        set({ 
          transcriptions: [],
          currentTranscript: '',
          finalTranscript: '' 
        });
      },

      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig }
        }));
      },

      setError: (error) => {
        set({ 
          error,
          lastErrorTime: error ? Date.now() : 0,
          status: error ? 'error' : get().status 
        });
      },

      addTranscription: (entry) => {
        set((state) => ({
          transcriptions: [...state.transcriptions, entry]
        }));
      },

      updateCurrentTranscript: (text) => {
        set({ currentTranscript: text });
      },

      finalizeTranscript: async () => {
        const { currentTranscript, config, userId, sessionId, personalityMode } = get();
        if (currentTranscript.trim()) {
          set({ 
            finalTranscript: currentTranscript,
            currentTranscript: ''
          });
          
          // Auto-index transcript if enabled
          if (config.autoIndexTranscripts && userId) {
            try {
              await get().indexTranscript(currentTranscript, {
                sessionId,
                personalityMode,
                timestamp: new Date().toISOString(),
                language: config.language,
                voice: config.voice,
              });
            } catch (error) {
              console.error('Failed to auto-index transcript:', error);
              // Set error state so the UI can display the error
              get().setError({
                code: 'AUTO_INDEXING_FAILED',
                message: error instanceof Error ? error.message : 'Failed to auto-index transcript',
                timestamp: Date.now(),
              });
            }
          }
        }
      },

      updateAudioLevels: (inputLevel, outputLevel = 0) => {
        set({ inputLevel, outputLevel });
      },

      updateVisualizationData: (data) => {
        set({ visualizationData: data });
      },

      setPersonalityMode: (mode) => {
        set({ personalityMode: mode });
      },

      setSafetyProtocols: (enabled) => {
        set({ safetyProtocols: enabled });
      },

      setUserId: (userId) => {
        set({ userId });
      },

      indexTranscript: async (transcript, metadata = {}) => {
        const { userId, sessionId } = get();
        
        if (!userId) {
          throw new Error('User ID required for transcript indexing');
        }

        set({ indexingStatus: 'indexing' });
        
        try {
          const response = await fetch('/api/voice/transcripts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transcript,
              userId,
              sessionId,
              metadata,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to index transcript: ${response.statusText}`);
          }

          const result = await response.json();
          
          set({
            indexingStatus: 'completed',
            vectorStoreId: result.vectorStoreId,
          });
          
          console.log('Transcript indexed successfully:', result);
        } catch (error) {
          set({ indexingStatus: 'failed' });
          console.error('Transcript indexing failed:', error);
          throw error;
        }
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'voice-store',
      version: 1,
    }
  )
);

// Selector hooks for optimal performance
export const useVoiceStatus = () => useVoiceStore((state) => state.status);
export const useVoiceError = () => useVoiceStore((state) => state.error);
export const useVoiceTranscription = () => useVoiceStore((state) => ({
  current: state.currentTranscript,
  final: state.finalTranscript,
  transcriptions: state.transcriptions,
}));
export const useVoiceConfig = () => useVoiceStore((state) => state.config);
export const useVoiceAudio = () => useVoiceStore((state) => ({
  isRecording: state.isRecording,
  isPlaying: state.isPlaying,
  inputLevel: state.inputLevel,
  outputLevel: state.outputLevel,
  visualizationData: state.visualizationData,
}));