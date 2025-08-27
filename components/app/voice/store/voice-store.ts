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
        if (status !== 'idle') {
          console.warn(`Cannot start session in ${status} state`);
          return;
        }

        try {
          set({ status: 'connecting' });
          
          const { config, personalityMode, safetyProtocols } = get();
          
          const requestBody = {
            config: config || {},
            personalityMode: personalityMode || 'safety-focused',
            safetyProtocols: safetyProtocols ?? true,
          };
          
          const response = await fetch('/api/voice/session', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || response.statusText };
            }
            
            throw new Error(
              `Failed to start session (${response.status}): ${
                errorData.error || response.statusText
              }`
            );
          }

          const result = await response.json();
          
          if (!result || typeof result.sessionId !== 'string' || !result.sessionId.trim()) {
            throw new Error('Invalid session response: missing or invalid session ID');
          }
          
          set({
            sessionId: result.sessionId,
            status: 'connected',
            error: null,
            reconnectAttempts: 0,
          });
        } catch (error) {
          console.error('Voice session start failed:', error);
          
          const voiceError: VoiceError = {
            code: 'SESSION_START_FAILED',
            message: error instanceof Error ? error.message : 'Failed to start voice session',
            details: error instanceof Error ? { name: error.name, stack: error.stack } : undefined,
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
        if (!sessionId) {
          console.warn('No active session to stop');
          return;
        }

        set({ status: 'disconnecting' });
        
        // Clean up WebRTC connection
        fetch('/api/voice/session', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        })
        .then(response => {
          if (!response.ok) {
            console.warn(`Session cleanup failed (${response.status}): ${response.statusText}`);
          }
        })
        .catch(error => {
          console.error('Session cleanup error:', error);
        });

        set({
          sessionId: null,
          status: 'idle',
          isRecording: false,
          isPlaying: false,
          currentTranscript: '',
          inputLevel: 0,
          outputLevel: 0,
          visualizationData: null,
          error: null,
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
        
        if (!currentTranscript || !currentTranscript.trim()) {
          return;
        }
        
        set({ 
          finalTranscript: currentTranscript,
          currentTranscript: ''
        });
        
        // Auto-index transcript if enabled
        if (config?.autoIndexTranscripts && userId) {
          try {
            const metadata = {
              sessionId: sessionId || null,
              personalityMode: personalityMode || 'safety-focused',
              timestamp: new Date().toISOString(),
              language: config?.language || 'en-US',
              voice: config?.voice || 'nova',
            };
            
            await get().indexTranscript(currentTranscript, metadata);
          } catch (error) {
            console.error('Failed to auto-index transcript:', error);
            // Set error state so the UI can display the error
            const errorMessage = error instanceof Error 
              ? error.message 
              : 'Failed to auto-index transcript';
              
            get().setError({
              code: 'AUTO_INDEXING_FAILED',
              message: errorMessage,
              details: error instanceof Error ? { stack: error.stack } : undefined,
              timestamp: Date.now(),
            });
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
        
        if (!userId || typeof userId !== 'string' || !userId.trim()) {
          const error = new Error('Valid User ID required for transcript indexing');
          set({ indexingStatus: 'failed' });
          throw error;
        }
        
        if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
          const error = new Error('Valid transcript content required for indexing');
          set({ indexingStatus: 'failed' });
          throw error;
        }

        set({ indexingStatus: 'indexing' });
        
        try {
          const requestBody = {
            transcript: transcript.trim(),
            userId: userId.trim(),
            sessionId: sessionId || null,
            metadata: metadata || {},
          };
          
          const response = await fetch('/api/voice/transcripts', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText || response.statusText };
            }
            
            throw new Error(
              `Failed to index transcript (${response.status}): ${
                errorData.error || errorData.details || response.statusText
              }`
            );
          }

          const result = await response.json();
          
          if (!result || typeof result !== 'object') {
            throw new Error('Invalid response from transcript indexing API');
          }
          
          set({
            indexingStatus: 'completed',
            vectorStoreId: result.vectorStoreId || result.fileId || null,
          });
          
          console.log('Transcript indexed successfully:', result);
          return result;
        } catch (error) {
          set({ indexingStatus: 'failed' });
          console.error('Transcript indexing failed:', error);
          
          // Re-throw with enhanced error information
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Network error: Unable to connect to transcript indexing service');
          }
          
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