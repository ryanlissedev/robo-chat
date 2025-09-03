import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import type { CredentialSource } from '@/lib/utils/metrics';

// Re-export commonly used types
export type { ChatRequest, ExtendedUIMessage } from '@/app/types/ai-extended';

// Supabase client type - properly typed instead of any
export type SupabaseClientType = SupabaseClient;

// Message content type for better type safety
export interface MessageContent {
  type: string;
  text?: string;
  [key: string]: unknown;
}

// Message transformation types
export interface TransformedMessage {
  role: 'user' | 'assistant' | 'system';
  content?: string | MessageContent[];
  parts?: MessageContent[];
  id?: string;
  [key: string]: unknown;
}

// Usage metrics interface
export interface UsageMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

// Response types with proper typing
export interface ResponseWithUsage {
  response: Response;
  messages: ExtendedUIMessage[];
  usage?: UsageMetrics;
}

// Service error type
export interface ServiceError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Credential validation result
export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  source?: CredentialSource;
}

// Chat processing context
export interface ChatProcessingContext {
  userId: string;
  sessionId?: string;
  model: string;
  provider: string;
  timestamp: Date;
}

// Service layer types for API Key management
export type StorageScope = 'request' | 'tab' | 'session' | 'persistent';

// Types for credential resolution
export interface GuestCredentials {
  provider?: string;
  apiKey?: string;
  source?: string;
}

export interface CredentialResult {
  apiKey?: string;
  source: CredentialSource;
  error?: string;
}

export interface ApiKey {
  id: string;
  provider: string;
  masked_key: string;
  encrypted_key?: string;
  last_used?: string | null;
  created_at: string;
  is_active: boolean;
}

export interface GuestCredential {
  masked: string;
  plaintext: string;
  scope: StorageScope;
  passphrase?: string;
}

export interface SaveApiKeyRequest {
  provider: string;
  key: string;
  storageScope?: StorageScope;
  passphrase?: string;
}

export interface ApiKeyTestResult {
  success: boolean;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
}

// Service interfaces for mocking
export interface IApiKeyService {
  loadApiKeys(): Promise<Record<string, ApiKey>>;
  saveApiKey(request: SaveApiKeyRequest): Promise<ApiKey>;
  deleteApiKey(provider: string): Promise<void>;
  testApiKey(provider: string): Promise<ApiKeyTestResult>;
}

export interface IGuestCredentialService {
  loadCredentials(): Promise<Record<string, GuestCredential>>;
  saveCredential(request: SaveApiKeyRequest): Promise<GuestCredential>;
  deleteCredential(provider: string): Promise<void>;
  loadPersistentCredential(
    provider: string,
    passphrase: string
  ): Promise<GuestCredential>;
}

export interface IValidationService {
  validateApiKey(provider: string, key: string): ValidationResult;
  validateStorageRequest(request: SaveApiKeyRequest): ValidationResult;
}

export interface ICredentialResolver {
  isGuestMode(): boolean;
  getApiKeyService(): IApiKeyService | IGuestCredentialService;
}
