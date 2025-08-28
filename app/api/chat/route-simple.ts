import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import type { SupabaseClientType } from '@/app/types/api.types';
import { ChatService } from '@/lib/services/ChatService';
import { CredentialService } from '@/lib/services/CredentialService';
import { MessageService } from '@/lib/services/MessageService';

export const maxDuration = 60;

/**
 * Simplified chat API route handler
 * Delegates business logic to service classes for better maintainability
 */
export async function POST(req: Request): Promise<Response> {
  let requestData: {
    messages: ExtendedUIMessage[];
    chatId: string;
    userId: string;
    model: string;
    isAuthenticated: boolean;
    systemPrompt: string;
    enableSearch: boolean;
    message_group_id?: string;
    reasoningEffort?: 'low' | 'medium' | 'high';
    verbosity?: 'low' | 'medium' | 'high';
    context?: 'chat' | 'voice';
    personalityMode?:
      | 'safety-focused'
      | 'technical-expert'
      | 'friendly-assistant';
  } | undefined;

  try {
    // Parse and validate request
    requestData = (await req.json()) as {
      messages: ExtendedUIMessage[];
      chatId: string;
      userId: string;
      model: string;
      isAuthenticated: boolean;
      systemPrompt: string;
      enableSearch: boolean;
      message_group_id?: string;
      reasoningEffort?: 'low' | 'medium' | 'high';
      verbosity?: 'low' | 'medium' | 'high';
      context?: 'chat' | 'voice';
      personalityMode?:
        | 'safety-focused'
        | 'technical-expert'
        | 'friendly-assistant';
    };

    // Validate request using service
    const validationError = MessageService.validateChatRequest(requestData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }

    // Delegate to ChatService for processing
    return await ChatService.processChatRequest(req, requestData);
  } catch (err: unknown) {
    const error = err as {
      code?: string;
      message?: string;
      statusCode?: number;
    };

    // Extract model and user info for error tracking
    let modelToUse = 'unknown-model';
    let userIdToUse = 'unknown-user';

    if (requestData) {
      modelToUse = requestData.model || 'unknown-model';
      userIdToUse = requestData.userId || 'unknown-user';

      // Use the model from request data directly for error tracking
    }

    // Track credential error
    CredentialService.trackCredentialError(err, modelToUse, userIdToUse);

    // Log error
    console.error({ error: err, at: 'api.chat.POST' }, 'Chat API error');

    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        code: error.code || 'INTERNAL_ERROR',
      }),
      { status: error.statusCode || 500 }
    );
  }
}
