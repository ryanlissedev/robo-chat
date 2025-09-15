import { ChatService } from '@/lib/services/ChatService';
import logger from '@/lib/utils/logger';
import { ChatRequestSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from './utils';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();

    // Validate request body with Zod
    const validationResult = ChatRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const zerr = validationResult.error;
      const issues = (zerr.issues || []) as Array<{ path?: unknown[] }>;
      let message = 'Invalid chat request';
      if (
        issues.some((issue: { path?: unknown[] }) =>
          Array.isArray(issue.path) && issue.path.includes('messages')
        )
      ) {
        message = 'missing or invalid messages';
      } else if (
        issues.some((issue: { path?: unknown[] }) =>
          Array.isArray(issue.path) && issue.path.includes('chatId')
        ) ||
        issues.some((issue: { path?: unknown[] }) =>
          Array.isArray(issue.path) && issue.path.includes('userId')
        )
      ) {
        message = 'missing chatId or userId';
      }

      logger.warn({ errors: zerr.flatten() }, 'Invalid chat request');
      return createErrorResponse({ message, statusCode: 400 });
    }

    const requestData = validationResult.data;

    // Log the request for debugging
    logger.info({ requestData }, 'Chat API request received');

    // Delegate to ChatService for processing
    return await ChatService.processChatRequest(req, requestData);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.stack : error },
      'Chat API error'
    );
    return createErrorResponse({
      message: error instanceof Error ? error.message : 'Internal server error',
      statusCode: 500,
    });
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, POST, OPTIONS' },
  });
}
