/**
 * Generate a UUID v4 compatible string
 * Provides fallback for environments where crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Check if crypto.randomUUID is available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback for older browsers or environments without crypto.randomUUID
  // This generates a valid UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Validate if a string is a valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Generate a guest user UUID
 * Ensures compatibility across all environments
 */
export function generateGuestUserId(): string {
  const uuid = generateUUID()
  // Ensure it's valid before returning
  if (!isValidUUID(uuid)) {
    console.warn('Generated UUID failed validation, regenerating...')
    return generateUUID()
  }
  return uuid
}