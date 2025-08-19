import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/lib/config"
import { validateUserIdentity } from "@/lib/server/api-drizzle"
import { getUserMessageCounts } from "@/lib/db/operations"

export async function getMessageUsage(
  userId: string,
  isAuthenticated: boolean
) {
  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) return null

  try {
    // Use Drizzle ORM for type-safe database operations
    const counts = await getUserMessageCounts(userId)
    
    const dailyLimit = isAuthenticated
      ? AUTH_DAILY_MESSAGE_LIMIT
      : NON_AUTH_DAILY_MESSAGE_LIMIT

    const dailyCount = counts.dailyMessageCount || 0
    const dailyProCount = counts.dailyProMessageCount || 0

    return {
      dailyCount,
      dailyProCount,
      dailyLimit,
      remaining: dailyLimit - dailyCount,
      remainingPro: DAILY_LIMIT_PRO_MODELS - dailyProCount,
    }
  } catch (error) {
    console.error("Rate limit check error:", error)
    // Return default limits on any error
    const dailyLimit = isAuthenticated
      ? AUTH_DAILY_MESSAGE_LIMIT
      : NON_AUTH_DAILY_MESSAGE_LIMIT

    return {
      dailyCount: 0,
      dailyProCount: 0,
      dailyLimit,
      remaining: dailyLimit,
      remainingPro: DAILY_LIMIT_PRO_MODELS,
    }
  }
}
