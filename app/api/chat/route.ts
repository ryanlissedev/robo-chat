import { ChatService } from '@/lib/services/ChatService';
import type { ChatRequest } from '@/lib/services/types';
import logger from '@/lib/utils/logger';
import { createErrorResponse } from './utils';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Parse request data
    const requestData = (await req.json()) as ChatRequest;

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
