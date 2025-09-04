import { storeAssistantMessage as storeAssistantMessageToDb } from '@/app/api/chat/db';
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
import { logWarning } from '@/lib/utils/logger';

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
  hasGuestCredentials = false,
}: ChatApiParams & {
  hasGuestCredentials?: boolean;
}): Promise<SupabaseClientType | null> {
  const supabase = await validateUserIdentity(userId, isAuthenticated);
  if (!supabase) {
    return null;
  }

  // Check if user is authenticated
  if (isAuthenticated) {
    // For authenticated users, check API key requirements
    const provider = getProviderForModel(model);

    // All providers now require API keys since Ollama was removed
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
  } else {
    // For unauthenticated users
    const isFreeModel =
      FREE_MODELS_IDS.includes(model) ||
      NON_AUTH_ALLOWED_MODELS.includes(model);

    // Check if AI Gateway is configured
    const hasAIGateway = Boolean(process.env.AI_GATEWAY_API_KEY);

    // Allow access if:
    // 1. It's a free model
    // 2. Guest has provided BYOK credentials
    // 3. AI Gateway is configured (all models available through gateway)
    if (!isFreeModel && !hasGuestCredentials && !hasAIGateway) {
      throw new Error(
        'This model requires authentication or an API key. Please sign in or provide your API key to access this model.'
      );
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

/**
 * Ensures a chat exists in the database before saving user messages
 * Creates the chat if it doesn't exist
 */
async function ensureChatExistsForUser(
  supabase: SupabaseClientType,
  chatId: string,
  userId: string
): Promise<boolean> {
  try {
    // First check if chat exists
    const { data: existingChat, error: checkError } = await supabase
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .single();

    if (existingChat && !checkError) {
      return true; // Chat exists
    }

    // Chat doesn't exist, create it
    const { error: insertError } = await supabase.from('chats').insert({
      id: chatId,
      user_id: userId,
      title: 'New Chat',
      model: 'gpt-4o-mini', // Default model
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

    return !insertError;
  } catch {
    return false;
  }
}

export async function logUserMessage({
  supabase,
  userId,
  chatId,
  content,
  attachments,
  message_group_id,
}: Omit<LogUserMessageParams, 'model' | 'isAuthenticated'>): Promise<void> {
  if (!supabase) {
    return;
  }

  // Skip database operations for guest users when rate limiting is disabled
  const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isGuestUser =
    userId.startsWith('guest-') || userId.startsWith('temp-guest-');

  if (isGuestUser && (isRateLimitDisabled || isDevelopment)) {
    return;
  }

  // Ensure chat exists before inserting message
  const chatExists = await ensureChatExistsForUser(supabase, chatId, userId);
  if (!chatExists) {
    // If we can't ensure chat exists, skip saving to avoid foreign key constraint
    return;
  }

  const { error } = await supabase.from('messages').insert({
    chat_id: chatId,
    role: 'user',
    content: sanitizeUserInput(content),
    experimental_attachments: attachments,
    user_id: userId,
    message_group_id,
  } as never);

  if (error) {
    // Silently handle error to avoid breaking chat flow
    logWarning('Failed to save user message', { error: error.message });
  }
}

export async function storeAssistantMessage({
  supabase,
  chatId,
  messages,
  userId,
  message_group_id,
  model,
  langsmithRunId,
}: StoreAssistantMessageParams): Promise<void> {
  if (!supabase) {
    return;
  }

  // For guest users, we need to extract userId from the messages or chatId context
  // Since we don't have userId directly, we'll check if any message content suggests guest user
  const hasGuestContext =
    chatId && (chatId.includes('guest-') || chatId.includes('temp-guest-'));
  const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (hasGuestContext && (isRateLimitDisabled || isDevelopment)) {
    return;
  }

  try {
    await storeAssistantMessageToDb({
      supabase,
      chatId,
      messages,
      userId,
      message_group_id,
      model,
      langsmithRunId,
    });
  } catch {
    // Silently handle error to avoid breaking chat flow
  }
}
