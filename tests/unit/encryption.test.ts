import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Set the environment variable before any imports
process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64')

// Import the module - we'll test the actual functionality without mocking crypto
// This allows us to test the real encryption/decryption behavior
import { encryptKey, decryptKey, maskKey } from '@/lib/encryption'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Encryption Module', () => {
  describe('encryptKey', () => {
    it('should encrypt plaintext and return encrypted data with IV', () => {
      const plaintext = 'test-api-key-123'
      const result = encryptKey(plaintext)

      // Check that the result has the expected structure
      expect(result).toHaveProperty('encrypted')
      expect(result).toHaveProperty('iv')
      
      // Check that encrypted data contains the auth tag separator
      expect(result.encrypted).toMatch(/^.+:.+$/)
      
      // Check that IV is a hex string of expected length (32 hex chars = 16 bytes)
      expect(result.iv).toMatch(/^[a-f0-9]{32}$/)
      
      // Check that the encrypted part and auth tag are both hex strings
      const [encryptedPart, authTag] = result.encrypted.split(':')
      expect(encryptedPart).toMatch(/^[a-f0-9]*$/)
      expect(authTag).toMatch(/^[a-f0-9]{32}$/) // Auth tag is 16 bytes = 32 hex chars
    })

    it('should handle empty plaintext', () => {
      const plaintext = ''
      const result = encryptKey(plaintext)

      expect(result).toHaveProperty('encrypted')
      expect(result).toHaveProperty('iv')
      expect(result.encrypted).toMatch(/^.*:.+$/) // May have empty encrypted part but should have auth tag
      expect(result.iv).toMatch(/^[a-f0-9]{32}$/)
    })

    it('should handle long plaintext', () => {
      const plaintext = 'a'.repeat(1000)
      const result = encryptKey(plaintext)

      expect(result).toHaveProperty('encrypted')
      expect(result).toHaveProperty('iv')
      expect(result.encrypted).toMatch(/^.+:.+$/)
      expect(result.iv).toMatch(/^[a-f0-9]{32}$/)
      
      // Long plaintext should result in longer encrypted data
      const [encryptedPart] = result.encrypted.split(':')
      expect(encryptedPart.length).toBeGreaterThan(100) // Should be much longer for 1000 chars
    })

    it('should generate different IVs for each call', () => {
      const plaintext = 'same-plaintext'
      const result1 = encryptKey(plaintext)
      const result2 = encryptKey(plaintext)

      // Same plaintext should produce different encrypted results due to random IV
      expect(result1.iv).not.toBe(result2.iv)
      expect(result1.encrypted).not.toBe(result2.encrypted)
    })
  })

  describe('decryptKey', () => {
    it('should decrypt data that was encrypted with encryptKey', () => {
      const originalText = 'test-api-key-123'
      
      // First encrypt the data
      const encrypted = encryptKey(originalText)
      
      // Then decrypt it back
      const decrypted = decryptKey(encrypted.encrypted, encrypted.iv)
      
      expect(decrypted).toBe(originalText)
    })

    it('should handle different plaintext lengths', () => {
      const testCases = [
        '',
        'a',
        'short',
        'medium-length-text',
        'very-long-text-that-goes-on-and-on-with-lots-of-characters',
        'special!@#$%^&*()characters',
        '🔑🛡️🔒 unicode characters 测试'
      ]

      testCases.forEach(text => {
        const encrypted = encryptKey(text)
        const decrypted = decryptKey(encrypted.encrypted, encrypted.iv)
        expect(decrypted).toBe(text)
      })
    })

    it('should throw error for invalid encrypted data format', () => {
      const invalidData = 'invaliddata' // No colon separator
      const validIv = '31323334353637383930313233343536'

      expect(() => {
        decryptKey(invalidData, validIv)
      }).toThrow()
    })

    it('should throw error for invalid IV', () => {
      // Create valid encrypted data first
      const encrypted = encryptKey('test')
      
      // Try to decrypt with invalid IV
      expect(() => {
        decryptKey(encrypted.encrypted, 'invalid-iv')
      }).toThrow()
    })

    it('should throw error for wrong auth tag', () => {
      // Create valid encrypted data
      const encrypted = encryptKey('test')
      
      // Tamper with the auth tag
      const [encryptedPart, authTag] = encrypted.encrypted.split(':')
      const wrongAuthTag = 'a'.repeat(authTag.length)
      const tamperedData = `${encryptedPart}:${wrongAuthTag}`
      
      expect(() => {
        decryptKey(tamperedData, encrypted.iv)
      }).toThrow()
    })
  })

  describe('maskKey', () => {
    it('should mask keys longer than 8 characters showing first 4 and last 4', () => {
      const key = 'sk-1234567890abcdef' // 17 chars -> 4 + (17-8) + 4 = 4 + 9 + 4 = 17 chars
      const result = maskKey(key)
      expect(result).toBe('sk-1***********cdef') // 4 + 11 + 4 = 19 chars total, but middle should be 17-8=9 stars
    })

    it('should mask exactly 9 characters showing first 4 and last 4', () => {
      const key = 'sk-123456' // 9 chars -> 4 + (9-8) + 4 = 4 + 1 + 4 = 9 chars
      const result = maskKey(key)
      expect(result).toBe('sk-1*3456') // 4 + 1 + 4 = 9 chars
    })

    it('should mask keys with exactly 8 characters completely', () => {
      const key = '12345678'
      const result = maskKey(key)
      expect(result).toBe('********')
    })

    it('should mask short keys (≤8 chars) completely', () => {
      const key = 'short'
      const result = maskKey(key)
      expect(result).toBe('*****')
    })

    it('should handle empty string', () => {
      const key = ''
      const result = maskKey(key)
      expect(result).toBe('')
    })

    it('should handle single character', () => {
      const key = 'a'
      const result = maskKey(key)
      expect(result).toBe('*')
    })

    it('should handle very long keys', () => {
      const key = 'sk-' + 'a'.repeat(100) + 'xyz' // 3 + 100 + 3 = 106 chars
      const result = maskKey(key)
      // Shows first 4 and last 4: 'sk-a' + '*'.repeat(106-8) + 'axyz' = 'sk-a' + '*'.repeat(98) + 'axyz'
      expect(result).toBe('sk-a' + '*'.repeat(98) + 'axyz')
    })

    it('should handle keys with special characters', () => {
      const key = 'api-key_123!@#$%^&*()' // 21 chars
      const result = maskKey(key)
      // Shows first 4 and last 4: 'api-' + '*'.repeat(21-8) + '&*()'
      expect(result).toBe('api-' + '*'.repeat(13) + '&*()')
    })

    it('should handle numeric strings', () => {
      const key = '1234567890123456'
      const masked = maskKey(key)
      expect(masked).toBe('1234********3456')
    })

    it('should handle keys with mixed case', () => {
      const key = 'AbCdEfGhIjKlMnOpQrSt'
      const masked = maskKey(key)
      expect(masked).toBe('AbCd************QrSt')
    })

    it('should handle whitespace in keys', () => {
      const key = 'key with spaces and tabs'
      const masked = maskKey(key)
      expect(masked).toBe('key ****************tabs')
    })
  })

  describe('Round-trip encryption/decryption', () => {
    it('should encrypt and then decrypt to original plaintext', () => {
      const plaintext = 'test-secret-key-123'
      
      // Encrypt
      const encrypted = encryptKey(plaintext)
      expect(encrypted).toHaveProperty('encrypted')
      expect(encrypted).toHaveProperty('iv')

      // Decrypt
      const decrypted = decryptKey(encrypted.encrypted, encrypted.iv)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters in round-trip', () => {
      const plaintext = 'test-key-with-unicode-🔑-emoji-测试'
      
      const encrypted = encryptKey(plaintext)
      const decrypted = decryptKey(encrypted.encrypted, encrypted.iv)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle various content types', () => {
      const testCases = [
        'simple-api-key',
        'OpenAI_API_Key_with_underscores',
        'key-with-special-chars!@#$%^&*()',
        JSON.stringify({ key: 'value', nested: { data: 123 } }),
        'multi\nline\nkey\nwith\nbreaks',
        '   key with leading and trailing spaces   ',
        'very'.repeat(250) + 'long'.repeat(250) + 'key'
      ]

      testCases.forEach(testCase => {
        const encrypted = encryptKey(testCase)
        const decrypted = decryptKey(encrypted.encrypted, encrypted.iv)
        expect(decrypted).toBe(testCase)
      })
    })

    it('should produce different encrypted output for same input', () => {
      const plaintext = 'same-input-text'
      
      const result1 = encryptKey(plaintext)
      const result2 = encryptKey(plaintext)
      
      // Different IVs should produce different encrypted output
      expect(result1.iv).not.toBe(result2.iv)
      expect(result1.encrypted).not.toBe(result2.encrypted)
      
      // But both should decrypt to the same plaintext
      expect(decryptKey(result1.encrypted, result1.iv)).toBe(plaintext)
      expect(decryptKey(result2.encrypted, result2.iv)).toBe(plaintext)
    })
  })

  describe('Error cases and edge conditions', () => {
    it('should handle invalid IV format during decryption', () => {
      const encrypted = encryptKey('test')
      
      expect(() => {
        decryptKey(encrypted.encrypted, 'invalid-iv-format')
      }).toThrow()
    })

    it('should handle invalid IV length during decryption', () => {
      const encrypted = encryptKey('test')
      
      expect(() => {
        decryptKey(encrypted.encrypted, 'abc123') // Too short
      }).toThrow()
    })

    it('should handle tampered encrypted data', () => {
      const encrypted = encryptKey('test')
      const [encryptedPart, authTag] = encrypted.encrypted.split(':')
      
      // Tamper with encrypted part
      const tamperedEncrypted = encryptedPart.replace(/.$/, 'x') // Change last char
      const tamperedData = `${tamperedEncrypted}:${authTag}`
      
      expect(() => {
        decryptKey(tamperedData, encrypted.iv)
      }).toThrow()
    })

    it('should handle missing colon in encrypted data', () => {
      const validIv = '31323334353637383930313233343536'
      
      expect(() => {
        decryptKey('noColonInData', validIv)
      }).toThrow()
    })

    it('should handle wrong auth tag length', () => {
      const encrypted = encryptKey('test')
      const [encryptedPart] = encrypted.encrypted.split(':')
      
      // Create auth tag with wrong length
      const wrongAuthTag = 'a'.repeat(20) // Should be 32 hex chars
      const wrongData = `${encryptedPart}:${wrongAuthTag}`
      
      expect(() => {
        decryptKey(wrongData, encrypted.iv)
      }).toThrow()
    })
  })

  describe('Security properties', () => {
    it('should use different IVs for identical plaintexts', () => {
      const plaintext = 'identical-plaintext'
      const results = []
      
      // Generate multiple encryptions of the same text
      for (let i = 0; i < 10; i++) {
        results.push(encryptKey(plaintext))
      }
      
      // All IVs should be different
      const ivs = results.map(r => r.iv)
      const uniqueIvs = new Set(ivs)
      expect(uniqueIvs.size).toBe(ivs.length)
      
      // All encrypted data should be different
      const encrypted = results.map(r => r.encrypted)
      const uniqueEncrypted = new Set(encrypted)
      expect(uniqueEncrypted.size).toBe(encrypted.length)
    })

    it('should maintain data integrity', () => {
      const originalData = 'sensitive-api-key-data'
      const encrypted = encryptKey(originalData)
      
      // Multiple decrypt operations should give same result
      const decrypted1 = decryptKey(encrypted.encrypted, encrypted.iv)
      const decrypted2 = decryptKey(encrypted.encrypted, encrypted.iv)
      const decrypted3 = decryptKey(encrypted.encrypted, encrypted.iv)
      
      expect(decrypted1).toBe(originalData)
      expect(decrypted2).toBe(originalData)
      expect(decrypted3).toBe(originalData)
    })

    it('should detect tampering with auth tag', () => {
      const encrypted = encryptKey('secret-data')
      const [encryptedPart, originalAuthTag] = encrypted.encrypted.split(':')
      
      // Try different auth tag modifications - at least some should fail
      const tamperingAttempts = [
        'a'.repeat(originalAuthTag.length), // All 'a's
        '0'.repeat(originalAuthTag.length), // All zeros
        'f'.repeat(originalAuthTag.length), // All 'f's
      ]
      
      let failureCount = 0
      tamperingAttempts.forEach(tamperedAuthTag => {
        const tamperedData = `${encryptedPart}:${tamperedAuthTag}`
        try {
          decryptKey(tamperedData, encrypted.iv)
          // If it doesn't throw, the tampering wasn't detected
        } catch (error) {
          failureCount++
        }
      })
      
      // At least some tampering attempts should be detected
      expect(failureCount).toBeGreaterThan(0)
    })
  })
})