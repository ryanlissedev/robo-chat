/**
 * Type definitions for voice-related functionality
 */

export interface VoiceSessionConfig {
  model?: string;
  voice?: string;
  personalityMode?: 'safety-focused' | 'technical-expert' | 'friendly-assistant';
  safetyProtocols?: boolean;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface VoiceSessionRequest {
  config: VoiceSessionConfig;
  personalityMode?: string;
  safetyProtocols?: boolean;
}

export interface VoiceSession {
  id: string;
  status: 'active' | 'inactive';
  config: VoiceSessionConfig;
  personalityMode: string;
  safetyProtocols: boolean;
  createdAt: Date;
  lastActiveAt: Date;
}

export interface WebRTCOfferRequest {
  sessionId: string;
  offer: string;
  config?: VoiceSessionConfig;
}

export interface WebRTCOfferResponse {
  sessionId: string;
  answer: string;
  status: 'success' | 'error';
}

export interface TranscriptRequest {
  transcript: string;
  userId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TranscriptSearchRequest {
  userId: string;
  query: string;
}

export interface VectorStoreFile {
  id: string;
  created_at: number;
  status: string;
}

export interface TranscriptSearchResponse {
  vectorStoreId?: string;
  fileCount: number;
  results: VectorStoreFile[];
  message: string;
}