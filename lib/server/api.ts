import { createClient } from "@/lib/supabase/server"
import { createGuestServerClient } from "@/lib/supabase/server-guest"
import { isSupabaseEnabled } from "../supabase/config"

/**
 * Validates the user's identity
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
    // Guest user validation
    try {
      // First try to validate UUID format
      const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      
      if (!isUuidFormat) {
        throw new Error("Invalid guest user ID format")
      }

      // In development, skip database validation to allow testing
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      
      if (!isDevelopment) {
        // In production, validate guest user exists in database
        const { data: userRecord, error: userError } = await supabase
          .from("users")
          .select("id")
          .eq("id", userId)
          .eq("anonymous", true)
          .maybeSingle()

        if (userError || !userRecord) {
          throw new Error("Invalid or missing guest user")
        }
      }
    } catch (error) {
      throw new Error("Invalid guest user ID")
    }
  }

  return supabase
}
