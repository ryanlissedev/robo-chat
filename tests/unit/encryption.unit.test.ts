import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  hashApiKey,
  verifyHashedApiKey,
  generateApiKey,
  validateApiKeyFormat,
  rotateApiKey,
  secureCompare
} from '../../lib/security/encryption'

/**
 * Encryption Utilities Unit Tests
 * Tests core encryption functionality in isolation
 */

describe('Encryption Utilities Unit Tests', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Set up test environment variables
    process.env.ENCRYPTION_KEY = 'test-key-for-unit-testing-12345678'
    process.env.ENCRYPTION_SALT = 'test-salt-for-unit-testing'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('encryptApiKey', () => {
    test('should encrypt API key successfully', () => {
      // Given: A plain API key
      const plainKey = 'sk-test123456789abcdefghijklmnop'
      const userId = 'user123'

      // When: Key is encrypted
      const encrypted = encryptApiKey(plainKey, userId)

      // Then: Encrypted data should have all required fields
      expect(encrypted).toBeDefined()
      expect(encrypted.encrypted).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.authTag).toBeDefined()
      expect(encrypted.masked).toBeDefined()

      // And: Encrypted data should be different from plain key
      expect(encrypted.encrypted).not.toBe(plainKey)
      expect(encrypted.iv).toHaveLength(32) // 16 bytes as hex string
      expect(encrypted.authTag).toHaveLength(32) // 16 bytes as hex string
      expect(encrypted.masked).toBe('sk-t**********************lmnop')
    })

    test('should produce different encryption results for same key', () => {
      // Given: Same API key encrypted twice
      const plainKey = 'sk-identical123456789'

      // When: Key is encrypted multiple times
      const encrypted1 = encryptApiKey(plainKey)
      const encrypted2 = encryptApiKey(plainKey)

      // Then: Results should be different (due to random IV)
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag)

      // But: Masked version should be identical
      expect(encrypted1.masked).toBe(encrypted2.masked)
    })

    test('should handle empty or invalid input', () => {
      // Given: Invalid inputs
      const invalidInputs = ['', null, undefined]

      // When/Then: Should throw appropriate errors
      invalidInputs.forEach(input => {
        expect(() => encryptApiKey(input as any)).toThrow('API key cannot be empty')
      })
    })

    test('should include userId in authenticated encryption', () => {
      // Given: Same key with different user IDs
      const plainKey = 'sk-samekey123456789'
      const userId1 = 'user1'
      const userId2 = 'user2'

      // When: Key is encrypted with different user IDs
      const encrypted1 = encryptApiKey(plainKey, userId1)
      const encrypted2 = encryptApiKey(plainKey, userId2)

      // Then: Results should be different (AAD includes userId)
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted)
      expect(encrypted1.authTag).not.toBe(encrypted2.authTag)
    })
  })

  describe('decryptApiKey', () => {
    test('should decrypt API key successfully', () => {
      // Given: Encrypted API key
      const plainKey = 'sk-decrypt123456789test'
      const userId = 'testuser'
      const encrypted = encryptApiKey(plainKey, userId)

      // When: Key is decrypted
      const decrypted = decryptApiKey(
        encrypted.encrypted,
        encrypted.iv,
        encrypted.authTag,
        userId
      )

      // Then: Decrypted key should match original
      expect(decrypted).toBe(plainKey)
    })

    test('should fail decryption with wrong userId', () => {
      // Given: Key encrypted with specific userId
      const plainKey = 'sk-wronguser123456789'
      const correctUserId = 'correct-user'
      const wrongUserId = 'wrong-user'
      const encrypted = encryptApiKey(plainKey, correctUserId)

      // When/Then: Decryption with wrong userId should fail
      expect(() => 
        decryptApiKey(encrypted.encrypted, encrypted.iv, encrypted.authTag, wrongUserId)
      ).toThrow()
    })

    test('should fail decryption with tampered data', () => {
      // Given: Encrypted key with tampered data
      const plainKey = 'sk-tampered123456789'
      const encrypted = encryptApiKey(plainKey)

      // When: Attempting to decrypt tampered data
      const tamperedEncrypted = encrypted.encrypted.slice(0, -4) + 'xxxx'
      const tamperedIv = encrypted.iv.slice(0, -4) + 'yyyy'
      const tamperedAuthTag = encrypted.authTag.slice(0, -4) + 'zzzz'

      // Then: Decryption should fail
      expect(() => 
        decryptApiKey(tamperedEncrypted, encrypted.iv, encrypted.authTag)
      ).toThrow()

      expect(() => 
        decryptApiKey(encrypted.encrypted, tamperedIv, encrypted.authTag)
      ).toThrow()

      expect(() => 
        decryptApiKey(encrypted.encrypted, encrypted.iv, tamperedAuthTag)
      ).toThrow()
    })

    test('should handle backward compatibility without authTag', () => {
      // Given: Legacy encryption without auth tag
      const plainKey = 'sk-legacy123456789'
      const encrypted = encryptApiKey(plainKey)

      // When: Decrypting without authTag parameter
      // Note: This tests backward compatibility scenario
      const decryptedWithoutAuthTag = decryptApiKey(
        encrypted.encrypted,
        encrypted.iv
      )

      // Then: Should still decrypt correctly
      expect(decryptedWithoutAuthTag).toBe(plainKey)
    })
  })

  describe('maskApiKey', () => {
    test('should mask standard length API keys', () => {
      // Given: Standard API keys of different lengths
      const testKeys = [
        { key: 'sk-test123456789', expected: 'sk-t*****6789' },
        { key: 'sk-anthropic123456789012345', expected: 'sk-a*****************2345' },
        { key: 'AIzaSyABCDEFGHIJKLMNOP1234567890', expected: 'AIza**************************7890' }
      ]

      // When/Then: Each key should be masked correctly
      testKeys.forEach(({ key, expected }) => {
        const masked = maskApiKey(key)
        expect(masked).toBe(expected)
        expect(masked).toHaveLength(key.length)
      })
    })

    test('should handle short keys', () => {
      // Given: Very short keys
      const shortKeys = ['123', 'abcd', '1234567']

      // When/Then: Short keys should be completely masked
      shortKeys.forEach(key => {
        const masked = maskApiKey(key)
        expect(masked).toBe('*'.repeat(key.length))
      })
    })

    test('should handle edge cases', () => {
      // Given: Edge case inputs
      expect(maskApiKey('')).toBe('')
      expect(maskApiKey(null as any)).toBe('')
      expect(maskApiKey(undefined as any)).toBe('')
    })

    test('should preserve first and last 4 characters', () => {
      // Given: Long API key
      const longKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz'

      // When: Key is masked
      const masked = maskApiKey(longKey)

      // Then: First and last 4 characters should be preserved
      expect(masked.slice(0, 4)).toBe(longKey.slice(0, 4))
      expect(masked.slice(-4)).toBe(longKey.slice(-4))
      expect(masked.slice(4, -4)).toBe('*'.repeat(longKey.length - 8))
    })
  })

  describe('hashApiKey', () => {
    test('should create consistent hash for same input', () => {
      // Given: Same API key and salt
      const apiKey = 'sk-hash123456789'
      const salt = 'test-salt'

      // When: Key is hashed multiple times with same salt
      const hash1 = hashApiKey(apiKey, salt)
      const hash2 = hashApiKey(apiKey, salt)

      // Then: Hashes should be identical
      expect(hash1).toBe(hash2)
      expect(hash1).toContain(':')
      expect(hash1.split(':')[0]).toBe(salt)
    })

    test('should create different hash for different salts', () => {
      // Given: Same key with different salts
      const apiKey = 'sk-salt123456789'
      const salt1 = 'salt1'
      const salt2 = 'salt2'

      // When: Key is hashed with different salts
      const hash1 = hashApiKey(apiKey, salt1)
      const hash2 = hashApiKey(apiKey, salt2)

      // Then: Hashes should be different
      expect(hash1).not.toBe(hash2)
      expect(hash1.split(':')[0]).toBe(salt1)
      expect(hash2.split(':')[0]).toBe(salt2)
    })

    test('should generate random salt when not provided', () => {
      // Given: API key without explicit salt
      const apiKey = 'sk-randomsalt123456789'

      // When: Key is hashed without salt
      const hash1 = hashApiKey(apiKey)
      const hash2 = hashApiKey(apiKey)

      // Then: Different salts should be generated
      expect(hash1).not.toBe(hash2)
      expect(hash1.split(':')).toHaveLength(2)
      expect(hash2.split(':')).toHaveLength(2)
      expect(hash1.split(':')[0]).not.toBe(hash2.split(':')[0])
    })
  })

  describe('verifyHashedApiKey', () => {
    test('should verify correct API key', () => {
      // Given: API key and its hash
      const apiKey = 'sk-verify123456789'
      const hashedKey = hashApiKey(apiKey, 'test-salt')

      // When: Key is verified
      const isValid = verifyHashedApiKey(apiKey, hashedKey)

      // Then: Verification should succeed
      expect(isValid).toBe(true)
    })

    test('should reject incorrect API key', () => {
      // Given: Hash of one key but different key for verification
      const correctKey = 'sk-correct123456789'
      const wrongKey = 'sk-wrong123456789'
      const hashedKey = hashApiKey(correctKey, 'test-salt')

      // When: Wrong key is verified
      const isValid = verifyHashedApiKey(wrongKey, hashedKey)

      // Then: Verification should fail
      expect(isValid).toBe(false)
    })

    test('should handle malformed hash', () => {
      // Given: Malformed hash strings
      const apiKey = 'sk-malformed123456789'
      const malformedHashes = [
        'invalid-hash',
        'no-colon-separator',
        'only:one:part',
        '',
        'salt:',
        ':hash'
      ]

      // When/Then: All malformed hashes should be rejected
      malformedHashes.forEach(malformedHash => {
        const isValid = verifyHashedApiKey(apiKey, malformedHash)
        expect(isValid).toBe(false)
      })
    })
  })

  describe('generateApiKey', () => {
    test('should generate API key with default prefix', () => {
      // When: API key is generated with default prefix
      const apiKey = generateApiKey()

      // Then: Key should have correct format
      expect(apiKey).toMatch(/^sk-[a-zA-Z0-9_-]{43}$/)
      expect(apiKey).toHaveLength(47) // 'sk-' + 44 base64url chars
    })

    test('should generate API key with custom prefix', () => {
      // Given: Custom prefix
      const customPrefix = 'custom-prefix'

      // When: API key is generated with custom prefix
      const apiKey = generateApiKey(customPrefix)

      // Then: Key should use custom prefix
      expect(apiKey).toStartWith(`${customPrefix}-`)
      expect(apiKey).toMatch(/^custom-prefix-[a-zA-Z0-9_-]{43}$/)
    })

    test('should generate unique keys', () => {
      // When: Multiple keys are generated
      const keys = Array.from({ length: 10 }, () => generateApiKey())

      // Then: All keys should be unique
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(10)
    })

    test('should use base64url encoding (no padding)', () => {
      // When: API key is generated
      const apiKey = generateApiKey()
      const keyPart = apiKey.split('-')[1]

      // Then: Key part should not contain padding or invalid chars
      expect(keyPart).not.toContain('=')
      expect(keyPart).not.toContain('+')
      expect(keyPart).not.toContain('/')
      expect(keyPart).toMatch(/^[a-zA-Z0-9_-]+$/)
    })
  })

  describe('validateApiKeyFormat', () => {
    test('should validate OpenAI API keys', () => {
      // Given: Valid and invalid OpenAI keys
      const validKeys = [
        'sk-1234567890abcdefghijklmnopqrstuvwxyz123456789012',
        'sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      ]
      const invalidKeys = [
        'sk-short',
        'invalid-prefix123456789',
        'sk-',
        'sk-contains@special#chars'
      ]

      // When/Then: Valid keys should pass, invalid should fail
      validKeys.forEach(key => {
        expect(validateApiKeyFormat(key, 'openai')).toBe(true)
        expect(validateApiKeyFormat(key, 'OpenAI')).toBe(true) // Case insensitive
      })

      invalidKeys.forEach(key => {
        expect(validateApiKeyFormat(key, 'openai')).toBe(false)
      })
    })

    test('should validate Anthropic API keys', () => {
      // Given: Valid and invalid Anthropic keys
      const validKeys = [
        'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz',
        'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh-ijkl'
      ]
      const invalidKeys = [
        'sk-ant-short',
        'sk-wrong-prefix123456789',
        'not-anthropic-key'
      ]

      // When/Then: Validation should work correctly
      validKeys.forEach(key => {
        expect(validateApiKeyFormat(key, 'anthropic')).toBe(true)
      })

      invalidKeys.forEach(key => {
        expect(validateApiKeyFormat(key, 'anthropic')).toBe(false)
      })
    })

    test('should validate Google API keys', () => {
      // Given: Valid Google API key format
      const validKey = 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567'
      const invalidKeys = [
        'AIzaSy-short',
        'wrong-prefix-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        'AIzaSy@invalid#chars'
      ]

      // When/Then: Validation should work
      expect(validateApiKeyFormat(validKey, 'google')).toBe(true)
      
      invalidKeys.forEach(key => {
        expect(validateApiKeyFormat(key, 'google')).toBe(false)
      })
    })

    test('should handle unknown providers with length check', () => {
      // Given: Unknown provider with long enough key
      const longKey = 'unknown-provider-key-1234567890abcdef'
      const shortKey = 'short'

      // When/Then: Should use generic length validation
      expect(validateApiKeyFormat(longKey, 'unknown-provider')).toBe(true)
      expect(validateApiKeyFormat(shortKey, 'unknown-provider')).toBe(false)
    })
  })

  describe('rotateApiKey', () => {
    test('should rotate encrypted API key', () => {
      // Given: Original encrypted API key
      const originalPlainKey = 'sk-original123456789'
      const userId = 'rotate-test-user'
      const originalEncrypted = encryptApiKey(originalPlainKey, userId)

      // When: Key is rotated
      const rotatedEncrypted = rotateApiKey(
        originalEncrypted.encrypted,
        originalEncrypted.iv,
        originalEncrypted.authTag,
        userId
      )

      // Then: New encrypted data should be different
      expect(rotatedEncrypted.encrypted).not.toBe(originalEncrypted.encrypted)
      expect(rotatedEncrypted.iv).not.toBe(originalEncrypted.iv)
      expect(rotatedEncrypted.authTag).not.toBe(originalEncrypted.authTag)

      // But: Should decrypt to same original key
      const decryptedRotated = decryptApiKey(
        rotatedEncrypted.encrypted,
        rotatedEncrypted.iv,
        rotatedEncrypted.authTag,
        userId
      )
      expect(decryptedRotated).toBe(originalPlainKey)
    })

    test('should handle rotation without userId', () => {
      // Given: Encrypted key without userId AAD
      const plainKey = 'sk-nouserid123456789'
      const encrypted = encryptApiKey(plainKey)

      // When: Key is rotated without userId
      const rotated = rotateApiKey(encrypted.encrypted, encrypted.iv, encrypted.authTag)

      // Then: Should work correctly
      const decrypted = decryptApiKey(rotated.encrypted, rotated.iv, rotated.authTag)
      expect(decrypted).toBe(plainKey)
    })
  })

  describe('secureCompare', () => {
    test('should return true for identical strings', () => {
      // Given: Identical strings
      const str1 = 'identical-string-123'
      const str2 = 'identical-string-123'

      // When: Strings are compared
      const result = secureCompare(str1, str2)

      // Then: Should return true
      expect(result).toBe(true)
    })

    test('should return false for different strings', () => {
      // Given: Different strings
      const testCases = [
        ['different1', 'different2'],
        ['short', 'longer-string'],
        ['UPPERCASE', 'lowercase'],
        ['same-length1', 'same-length2']
      ]

      // When/Then: All should return false
      testCases.forEach(([str1, str2]) => {
        expect(secureCompare(str1, str2)).toBe(false)
      })
    })

    test('should return false for different length strings', () => {
      // Given: Different length strings
      const short = 'short'
      const long = 'much-longer-string'

      // When: Strings are compared
      const result = secureCompare(short, long)

      // Then: Should return false immediately
      expect(result).toBe(false)
    })

    test('should be timing-safe (constant time)', () => {
      // Given: Strings that would fail early vs late in normal comparison
      const baseString = 'a'.repeat(1000)
      const earlyDiff = 'b' + 'a'.repeat(999) // Differs in first char
      const lateDiff = 'a'.repeat(999) + 'b' // Differs in last char

      // When: Comparing with timing measurement
      const times: number[] = []

      // Perform multiple comparisons to reduce noise
      for (let i = 0; i < 100; i++) {
        const start = process.hrtime.bigint()
        secureCompare(baseString, earlyDiff)
        const end = process.hrtime.bigint()
        times.push(Number(end - start))
      }

      const earlyAvg = times.reduce((a, b) => a + b) / times.length

      times.length = 0
      for (let i = 0; i < 100; i++) {
        const start = process.hrtime.bigint()
        secureCompare(baseString, lateDiff)
        const end = process.hrtime.bigint()
        times.push(Number(end - start))
      }

      const lateAvg = times.reduce((a, b) => a + b) / times.length

      // Then: Timing should be similar (within 50% variance)
      // This is a basic check - in practice, timing attacks are more sophisticated
      const ratio = Math.abs(earlyAvg - lateAvg) / Math.min(earlyAvg, lateAvg)
      expect(ratio).toBeLessThan(0.5)
    })

    test('should handle empty strings', () => {
      // Given: Empty strings
      expect(secureCompare('', '')).toBe(true)
      expect(secureCompare('', 'not-empty')).toBe(false)
      expect(secureCompare('not-empty', '')).toBe(false)
    })
  })

  describe('Environment Dependencies', () => {
    test('should throw error when ENCRYPTION_KEY is missing', () => {
      // Given: Missing encryption key
      delete process.env.ENCRYPTION_KEY

      // When/Then: Should throw appropriate error
      expect(() => encryptApiKey('sk-test123')).toThrow('ENCRYPTION_KEY environment variable is required')
    })

    test('should use default salt when ENCRYPTION_SALT is missing', () => {
      // Given: Missing encryption salt
      delete process.env.ENCRYPTION_SALT
      const plainKey = 'sk-defaultsalt123'

      // When: Key is encrypted and decrypted
      const encrypted = encryptApiKey(plainKey)
      const decrypted = decryptApiKey(encrypted.encrypted, encrypted.iv, encrypted.authTag)

      // Then: Should work with default salt
      expect(decrypted).toBe(plainKey)
    })
  })
})