import { saveFinalAssistantMessage } from '@/app/api/chat/db';
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from '@/app/types/api.types';
import { FREE_MODELS_IDS, NON_AUTH_ALLOWED_MODELS } from '@/lib/config';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { sanitizeUserInput } from '@/lib/sanitize';
import { validateUserIdentity } from '@/lib/server/api';
import { checkUsageByModel, incrementUsage } from '@/lib/usage';
import { getUserKey, type ProviderWithoutOllama } from '@/lib/user-keys';

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<SupabaseClientType | null> {
  // TEMPORARY: Complete bypass for guest users when rate limiting is disabled
  const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isAuthenticated && (isRateLimitDisabled || isDevelopment)) {
    // For guest users with rate limiting disabled, skip all validation
    return null; // This signals to skip database operations
  }

  const supabase = await validateUserIdentity(userId, isAuthenticated);
  if (!supabase) {
    return null;
  }

  // Check if user is authenticated
  if (isAuthenticated) {
    // For authenticated users, check API key requirements
    const provider = getProviderForModel(model);

    if (provider !== 'ollama') {
      const userApiKey = await getUserKey(
        userId,
        provider as ProviderWithoutOllama
      );

      // If no API key and model is not in free list, deny access
      if (!(userApiKey || FREE_MODELS_IDS.includes(model))) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
        );
      }
    }
  } else {
    // For unauthenticated users, check if rate limiting is disabled
    const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Allow all models for guest users when rate limiting is disabled
    if (!(isRateLimitDisabled || isDevelopment)) {
      // Only restrict models when rate limiting is enabled
      if (!NON_AUTH_ALLOWED_MODELS.includes(model)) {
        throw new Error(
          'This model requires authentication. Please sign in to access more models.'
        );
      }
    }
  }

  // Check usage limits for the model
  await checkUsageByModel(supabase, userId, model, isAuthenticated);

  return supabase;
}

export async function incrementMessageCount({
  supabase,
  userId,
}: {
  supabase: SupabaseClientType;
  userId: string;
}): Promise<void> {
  if (!supabase) {
    return;
  }

  try {
    await incrementUsage(supabase, userId);
  } catch {
    // Don't throw error as this shouldn't block the chat
  }
}

export async function logUserMessage({
  supabase,
  userId,
  chatId,
  content,
  attachments,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    role: 'user',
    content: sanitizeUserInput(content),
    experimental_attachments: attachments,
    user_id: userId,
    message_group_id,
  });

  if (error) {
  }
}

export async function storeAssistantMessage({
  supabase,
  chatId,
  messages,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<void> {
  if (!supabase) {
    return;
  }
  try {
    await saveFinalAssistantMessage(
      supabase,
      chatId,
      messages,
      message_group_id,
      model
    );
  } catch {
    // Silently handle errors - don't block the response
  }
}
