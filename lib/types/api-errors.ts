/**
 * Type definitions for API error handling
 */

export interface OpenAIError {
  message?: string;
  code?: string;
  type?: string;
}

export interface AnthropicError {
  message?: string;
  error_type?: string;
  error_code?: string;
}

export interface MistralError {
  message?: string;
  code?: string;
}

export interface GoogleAIError {
  message?: string;
  code?: string;
  status?: string;
}

export interface LangSmithError {
  message?: string;
  detail?: string;
  code?: number;
}

export type APIError = 
  | OpenAIError 
  | AnthropicError 
  | MistralError 
  | GoogleAIError 
  | LangSmithError 
  | Error;

export interface APITestResult {
  success: boolean;
  error: string;
}

export interface UserPreferencesUpdate {
  layout?: string;
  prompt_suggestions?: boolean;
  show_tool_invocations?: boolean;
  show_conversation_previews?: boolean;
  multi_model_enabled?: boolean;
  hidden_models?: string[];
}