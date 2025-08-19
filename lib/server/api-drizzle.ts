import { createClient } from "@/lib/supabase/server"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import { isSupabaseEnabled } from "../supabase/config"
import { validateGuestUser, getUserById } from "@/lib/db/operations"

/**
 * Enhanced user identity validation using Drizzle ORM
 * Fixes the guest user ID validation issue with consistent behavior
 * @param userId - The ID of the user.
 * @param isAuthenticated - Whether the user is authenticated.
 * @returns The Supabase client.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean
) {
  if (!isSupabaseEnabled) {
    return null
  }

  const supabase = isAuthenticated
    ? await createClient()
    : await createGuestServerClient()

  if (!supabase) {
    throw new Error("Failed to initialize Supabase client")
  }

  if (isAuthenticated) {
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError || !authData?.user?.id) {
      throw new Error("Unable to get authenticated user")
    }

    if (authData.user.id !== userId) {
      throw new Error("User ID does not match authenticated user")
    }
  } else {
    // Use Drizzle for consistent guest user validation
    // This fixes the inconsistency between dev/prod environments
    const isValidGuest = await validateGuestUser(userId)
    
    if (!isValidGuest) {
      throw new Error("Invalid or missing guest user")
    }
  }

  return supabase
}

/**
 * Get user details using Drizzle ORM
 * Provides type-safe user data retrieval
 */
export async function getUserDetails(userId: string) {
  try {
    const user = await getUserById(userId)
    
    if (!user) {
      return null
    }
    
    return {
      id: user.id,
      email: user.email,
      anonymous: user.anonymous,
      systemPrompt: user.systemPrompt,
      themeMode: user.themeMode,
      favoriteModels: user.favoriteModels || [],
      dailyMessageCount: user.dailyMessageCount,
      dailyProMessageCount: user.dailyProMessageCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastActiveAt: user.lastActiveAt
    }
  } catch (error) {
    console.error("Failed to get user details:", error)
    return null
  }
}