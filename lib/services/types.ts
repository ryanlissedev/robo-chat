import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import type { CredentialSource } from '@/lib/utils/metrics';

// Re-export commonly used types
export type { ChatRequest, ExtendedUIMessage } from '@/app/types/ai-extended';

// Supabase client type
export type SupabaseClientType = any; // TODO: Import proper Supabase type

// Message transformation types
export type TransformedMessage = {
  role: 'user' | 'assistant' | 'system';
  content?: string | Array<{ type: string; text?: string; [key: string]: any }>;
  parts?: any[];
  id?: string;
  [key: string]: any;
};

// Response types
export type ResponseWithUsage = {
  response: any;
  messages: any[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
};

// Service layer types for API Key management
export type StorageScope = 'request' | 'tab' | 'session' | 'persistent';

// Types for credential resolution
export type GuestCredentials = {
  provider?: string;
  apiKey?: string;
  source?: string;
};

export type CredentialResult = {
  apiKey?: string;
  source: CredentialSource;
  error?: string;
};

export type ApiKey = {
  id: string;
  provider: string;
  masked_key: string;
  encrypted_key?: string;
  last_used?: string | null;
  created_at: string;
  is_active: boolean;
};

export type GuestCredential = {
  masked: string;
  plaintext: string;
  scope: StorageScope;
  passphrase?: string;
};

export type SaveApiKeyRequest = {
  provider: string;
  key: string;
  storageScope?: StorageScope;
  passphrase?: string;
};

export type ApiKeyTestResult = {
  success: boolean;
  error?: string;
};

export type ValidationResult = {
  isValid: boolean;
  error?: string;
  message?: string;
};

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
