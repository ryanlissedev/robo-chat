// API utilities and handlers
export { createErrorResponse } from '../../app/api/chat/utils';
export { incrementMessageCount, logUserMessage, storeAssistantMessage, validateAndTrackUsage } from '../../app/api/chat/api';

// Types
export type { ExtendedUIMessage } from '../services/types';
export type { SupabaseClientType } from '../services/types';