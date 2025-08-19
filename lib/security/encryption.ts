import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "crypto"

// Enhanced encryption with multiple layers of security
const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const ITERATIONS = 100000

// Get encryption key from environment
function getEncryptionKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }

  // Derive key using PBKDF2 for additional security
  const salt = process.env.ENCRYPTION_SALT || "RoboRail-Default-Salt-2025"
  return pbkdf2Sync(masterKey, salt, ITERATIONS, 32, "sha256")
}

// Encrypt API key with AES-256-GCM
export function encryptApiKey(plaintext: string, userId?: string): {
  encrypted: string
  iv: string
  authTag: string
  masked: string
} {
  if (!plaintext) {
    throw new Error("API key cannot be empty")
  }

  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  // Add additional authenticated data (AAD) if userId provided
  if (userId) {
    cipher.setAAD(Buffer.from(userId), { plaintextLength: plaintext.length })
  }

  let encrypted = cipher.update(plaintext, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    masked: maskApiKey(plaintext)
  }
}

// Decrypt API key
export function decryptApiKey(
  encryptedData: string, 
  ivHex: string, 
  authTagHex?: string,
  userId?: string
): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(ivHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  // Set auth tag if provided (for GCM mode)
  if (authTagHex) {
    const authTag = Buffer.from(authTagHex, "hex")
    decipher.setAuthTag(authTag)
  }

  // Add AAD if userId provided
  if (userId) {
    decipher.setAAD(Buffer.from(userId))
  }

  let decrypted = decipher.update(encryptedData, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

// Mask API key for display
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return "*".repeat(key?.length || 0)
  }

  // Show first 4 and last 4 characters
  const prefix = key.slice(0, 4)
  const suffix = key.slice(-4)
  const masked = "*".repeat(Math.max(0, key.length - 8))
  
  return `${prefix}${masked}${suffix}`
}

// Hash API key for comparison without decryption
export function hashApiKey(key: string, salt?: string): string {
  const actualSalt = salt || randomBytes(16).toString("hex")
  const hash = pbkdf2Sync(key, actualSalt, ITERATIONS, 64, "sha512")
  return `${actualSalt}:${hash.toString("hex")}`
}

// Verify hashed API key
export function verifyHashedApiKey(key: string, hashedKey: string): boolean {
  const [salt, hash] = hashedKey.split(":")
  if (!salt || !hash) return false

  const computedHash = pbkdf2Sync(key, salt, ITERATIONS, 64, "sha512")
  return computedHash.toString("hex") === hash
}

// Generate a secure random API key
export function generateApiKey(prefix: string = "sk"): string {
  const randomPart = randomBytes(32).toString("base64url")
  return `${prefix}-${randomPart}`
}

// Validate API key format
export function validateApiKeyFormat(key: string, provider: string): boolean {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[a-zA-Z0-9]{48,}$/,
    anthropic: /^sk-ant-[a-zA-Z0-9-]{40,}$/,
    google: /^[a-zA-Z0-9-_]{39}$/,
    mistral: /^[a-zA-Z0-9]{32,}$/,
    langsmith: /^ls__[a-zA-Z0-9]{32,}$/,
  }

  const pattern = patterns[provider.toLowerCase()]
  if (!pattern) {
    // Allow any format for unknown providers
    return key.length >= 16
  }

  return pattern.test(key)
}

// Rotate encryption key (for key rotation)
export function rotateApiKey(
  oldEncrypted: string,
  oldIv: string,
  oldAuthTag?: string,
  userId?: string
): {
  encrypted: string
  iv: string
  authTag: string
} {
  // Decrypt with old key
  const plaintext = decryptApiKey(oldEncrypted, oldIv, oldAuthTag, userId)
  
  // Re-encrypt with new key
  const { encrypted, iv, authTag } = encryptApiKey(plaintext, userId)
  
  return { encrypted, iv, authTag }
}

// Secure comparison to prevent timing attacks
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

// Export types
export interface EncryptedApiKey {
  encrypted: string
  iv: string
  authTag: string
  masked: string
}

export interface ApiKeyValidation {
  isValid: boolean
  error?: string
}