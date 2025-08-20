import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from '@/lib/config';
import { validateUserIdentity } from '@/lib/server/api';

export async function getMessageUsage(
  userId: string,
  isAuthenticated: boolean
) {
  // TEMPORARY: Bypass rate limits for guest users when disabled
  const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isAuthenticated && (isRateLimitDisabled || isDevelopment)) {
    return {
      remaining: NON_AUTH_DAILY_MESSAGE_LIMIT,
      limit: NON_AUTH_DAILY_MESSAGE_LIMIT,
      used: 0,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  const supabase = await validateUserIdentity(userId, isAuthenticated);
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('daily_message_count, daily_pro_message_count')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to fetch message usage');
  }

  const dailyLimit = isAuthenticated
    ? AUTH_DAILY_MESSAGE_LIMIT
    : NON_AUTH_DAILY_MESSAGE_LIMIT;

  const dailyCount = data.daily_message_count || 0;
  const dailyProCount = data.daily_pro_message_count || 0;

  return {
    dailyCount,
    dailyProCount,
    dailyLimit,
    remaining: dailyLimit - dailyCount,
    remainingPro: DAILY_LIMIT_PRO_MODELS - dailyProCount,
  };
}
