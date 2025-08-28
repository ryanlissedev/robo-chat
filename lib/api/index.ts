// API utilities and handlers
export { createErrorResponse } from './error-handler';
export { incrementMessageCount, logUserMessage, storeAssistantMessage, validateAndTrackUsage } from './base';

// Types
export type { ExtendedUIMessage } from '../services/types';
export type { SupabaseClientType } from '../services/types';