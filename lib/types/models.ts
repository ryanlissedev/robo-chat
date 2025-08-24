/**
 * Type definitions for model configuration and settings
 */

export interface ModelSettings {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  seed?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}

export interface ModelProvider {
  id: string;
  name: string;
  description?: string;
  supportedFeatures?: string[];
}

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  inputCost?: number;
  outputCost?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  maxTokens?: number;
  settings?: ModelSettings;
}

export interface ModelConfig {
  model: string;
  provider: string;
  settings: ModelSettings;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TestChatMessage {
  role: 'user' | 'assistant';
  content: string;
}