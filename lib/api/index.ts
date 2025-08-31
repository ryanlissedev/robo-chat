// API utilities and handlers

export {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from '../../app/api/chat/api';
export { createErrorResponse } from '../../app/api/chat/utils';
// Types
export type { ExtendedUIMessage, SupabaseClientType } from '../services/types';
