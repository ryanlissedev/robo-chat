import type { ChatRequest } from '@/app/types/ai-extended';
import { ChatRequestSchema } from '@/lib/validation/schemas';
import type { ValidatedChatRequest } from '@/lib/services/types';
import { ChatService } from '@/lib/services/ChatService';
import { MessageService } from '@/lib/services/MessageService';
import logger from '@/lib/utils/logger';

export const maxDuration = 60;

/**
 * Simplified chat API route handler
 * Delegates business logic to service classes for better maintainability
 */
export async function POST(req: Request): Promise<Response> {
  let requestData: ChatRequest | undefined;

  try {
    // Parse JSON
    const body = (await req.json()) as unknown;

    // Zod-validate and normalize shape (e.g., message_group_id -> messageGroupId)
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten() }),
        { status: 400 }
      );
    }

    // Additional light validation for required ids
    const validationError = MessageService.validateChatRequest(
      parsed.data as unknown as ChatRequest
    );
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
      });
    }

    // Delegate to ChatService using the fully validated type
    return await ChatService.processChatRequest(
      req,
      parsed.data as ValidatedChatRequest
    );
  } catch (err: unknown) {
    const error = err as {
      code?: string;
      message?: string;
      statusCode?: number;
    };

    // Log error using proper logger instead of console
    logger.error({ error: err, at: 'api.chat.POST' }, 'Chat API error');

    // Return error response
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal Server Error',
        code: error.code,
      }),
      {
        status: error.statusCode || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, POST, OPTIONS' },
  });
}
