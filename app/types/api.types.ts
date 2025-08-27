import type { Attachment } from '@ai-sdk/ui-utils';
import type { SupabaseClient } from '@supabase/ssr';
import type { Database, Json } from '@/app/types/database.types';
import type { ReasoningEffort } from '@/lib/openproviders/types';

export type SupabaseClientType = SupabaseClient<Database>;

export type ContentPart = {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Json;
  result?: Json;
  toolInvocation?: {
    state: string;
    step: number;
    toolCallId: string;
    toolName: string;
    args?: Json;
    result?: Json;
  };
  reasoningText?: string;
  details?: Json[];
};

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'data' | 'tool' | 'tool-call';
  content: string | null | ContentPart[];
  reasoningText?: string;
};

export type ChatApiParams = {
  userId: string;
  model: string;
  isAuthenticated: boolean;
};

export type LogUserMessageParams = {
  supabase: SupabaseClientType;
  userId: string;
  chatId: string;
  content: string;
  attachments?: Attachment[];
  model: string;
  isAuthenticated: boolean;
  message_group_id?: string;
};

export type StoreAssistantMessageParams = {
  supabase: SupabaseClientType;
  chatId: string;
  messages: Message[];
  userId?: string;
  message_group_id?: string;
  model?: string;
  langsmithRunId?: string | null;
  reasoningEffort?: ReasoningEffort;
};

export type ApiErrorResponse = {
  error: string;
  details?: string;
};

export type ApiSuccessResponse<T = unknown> = {
  success: true;
  data?: T;
};

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
