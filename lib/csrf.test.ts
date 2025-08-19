import { describe, it, expect, beforeAll } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from './csrf'

describe('CSRF Security', () => {
  beforeAll(() => {
    process.env.CSRF_SECRET = 'test-csrf-secret-32-chars-long-min'
  })

  describe('generateCsrfToken', () => {
    it('generates a valid CSRF token', () => {
      const token = generateCsrfToken()
      
      expect(typeof token).toBe('string')
      expect(token).toMatch(/^[a-f0-9]{64}:[a-f0-9]{64}$/)
      expect(token.split(':')).toHaveLength(2)
    })

    it('generates unique tokens', () => {
      const token1 = generateCsrfToken()
      const token2 = generateCsrfToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('validateCsrfToken', () => {
    it('validates a correctly generated token', () => {
      const token = generateCsrfToken()
      expect(validateCsrfToken(token)).toBe(true)
    })

    it('rejects invalid token formats', () => {
      expect(validateCsrfToken('invalid')).toBe(false)
      expect(validateCsrfToken('no:colon')).toBe(false)
      expect(validateCsrfToken('')).toBe(false)
      expect(validateCsrfToken(':')).toBe(false)
      expect(validateCsrfToken('raw:')).toBe(false)
      expect(validateCsrfToken(':token')).toBe(false)
    })

    it('rejects tampered tokens', () => {
      const validToken = generateCsrfToken()
      const [raw] = validToken.split(':')
      const tamperedToken = `${raw}:tampered`
      
      expect(validateCsrfToken(tamperedToken)).toBe(false)
    })

    it('rejects tokens with wrong raw part', () => {
      const validToken = generateCsrfToken()
      const [, hash] = validToken.split(':')
      const tamperedToken = `differentraw:${hash}`
      
      expect(validateCsrfToken(tamperedToken)).toBe(false)
    })
  })
})