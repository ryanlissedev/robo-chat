import { describe, it, expect, beforeAll } from 'vitest'
import {
  encryptApiKey,
  decryptApiKey,
  maskApiKey,
  hashApiKey,
  verifyHashedApiKey,
  generateApiKey,
  validateApiKeyFormat,
  secureCompare,
} from './encryption'

describe('Security Encryption Utils', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = Buffer.from('test-key-32-chars-long-for-testing').toString('base64')
  })

  describe('maskApiKey', () => {
    it('masks API key correctly', () => {
      expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1***********cdef')
      expect(maskApiKey('abcd1234')).toBe('abcd1234')
      expect(maskApiKey('short')).toBe('*****')
      expect(maskApiKey('')).toBe('')
    })

    it('handles edge cases', () => {
      expect(maskApiKey('ab')).toBe('**')
      expect(maskApiKey('1234567')).toBe('*******')
      expect(maskApiKey('12345678')).toBe('12345678')
    })
  })

  describe('validateApiKeyFormat', () => {
    it('validates OpenAI API key format', () => {
      expect(validateApiKeyFormat('sk-' + 'a'.repeat(48), 'openai')).toBe(true)
      expect(validateApiKeyFormat('sk-invalid', 'openai')).toBe(false)
      expect(validateApiKeyFormat('invalid', 'openai')).toBe(false)
    })

    it('validates Anthropic API key format', () => {
      expect(validateApiKeyFormat('sk-ant-' + 'a'.repeat(40), 'anthropic')).toBe(true)
      expect(validateApiKeyFormat('sk-ant-short', 'anthropic')).toBe(false)
    })

    it('validates Google API key format', () => {
      expect(validateApiKeyFormat('A'.repeat(39), 'google')).toBe(true)
      expect(validateApiKeyFormat('A'.repeat(38), 'google')).toBe(false)
    })

    it('validates Mistral API key format', () => {
      expect(validateApiKeyFormat('a'.repeat(32), 'mistral')).toBe(true)
      expect(validateApiKeyFormat('a'.repeat(31), 'mistral')).toBe(false)
    })

    it('validates LangSmith API key format', () => {
      expect(validateApiKeyFormat('ls__' + 'a'.repeat(32), 'langsmith')).toBe(true)
      expect(validateApiKeyFormat('ls__short', 'langsmith')).toBe(false)
    })

    it('allows any format for unknown providers', () => {
      expect(validateApiKeyFormat('a'.repeat(16), 'unknown')).toBe(true)
      expect(validateApiKeyFormat('a'.repeat(15), 'unknown')).toBe(false)
    })
  })

  describe('secureCompare', () => {
    it('compares strings securely', () => {
      expect(secureCompare('hello', 'hello')).toBe(true)
      expect(secureCompare('hello', 'world')).toBe(false)
      expect(secureCompare('', '')).toBe(true)
    })

    it('returns false for different lengths', () => {
      expect(secureCompare('short', 'longer')).toBe(false)
      expect(secureCompare('longer', 'short')).toBe(false)
    })
  })

  describe('generateApiKey', () => {
    it('generates API key with default prefix', () => {
      const key = generateApiKey()
      expect(key).toMatch(/^sk-[a-zA-Z0-9_-]+$/)
      expect(key.length).toBeGreaterThan(10)
    })

    it('generates API key with custom prefix', () => {
      const key = generateApiKey('test')
      expect(key).toMatch(/^test-[a-zA-Z0-9_-]+$/)
    })
  })

  describe('encryption/decryption', () => {
    const testApiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyz'
    const testUserId = 'user-123'

    it('encrypts and decrypts API key', () => {
      const encrypted = encryptApiKey(testApiKey)
      const decrypted = decryptApiKey(encrypted.encrypted, encrypted.iv, encrypted.authTag)
      
      expect(decrypted).toBe(testApiKey)
      expect(encrypted.masked).toBe('sk-1*******************************wxyz')
    })

    it('encrypts and decrypts with user ID', () => {
      const encrypted = encryptApiKey(testApiKey, testUserId)
      const decrypted = decryptApiKey(encrypted.encrypted, encrypted.iv, encrypted.authTag, testUserId)
      
      expect(decrypted).toBe(testApiKey)
    })

    it('throws error for empty API key', () => {
      expect(() => encryptApiKey('')).toThrow('API key cannot be empty')
    })
  })

  describe('hashing and verification', () => {
    const testKey = 'test-api-key'

    it('hashes and verifies API key', () => {
      const hashed = hashApiKey(testKey)
      expect(verifyHashedApiKey(testKey, hashed)).toBe(true)
      expect(verifyHashedApiKey('wrong-key', hashed)).toBe(false)
    })

    it('hashes with custom salt', () => {
      const salt = 'custom-salt'
      const hashed = hashApiKey(testKey, salt)
      expect(hashed.startsWith(salt + ':')).toBe(true)
      expect(verifyHashedApiKey(testKey, hashed)).toBe(true)
    })

    it('returns false for invalid hash format', () => {
      expect(verifyHashedApiKey(testKey, 'invalid')).toBe(false)
      expect(verifyHashedApiKey(testKey, 'salt:')).toBe(false)
    })
  })
})