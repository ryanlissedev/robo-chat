import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// Simulate browser crypto
import 'happy-dom'

import {
  deriveKeyFromPassphrase,
  encryptWithKey,
  decryptWithKey,
  encryptWithPassphrase,
  decryptWithPassphrase,
  importAesKeyRaw,
  generateEphemeralAesKey,
  maskKey,
  setMemoryCredential,
  getMemoryCredential,
  setSessionCredential,
  getSessionCredential,
  setPersistentCredential,
  getPersistentCredential,
  clearAllGuestCredentialsFor,
  type EncryptBundle,
} from '@/lib/security/web-crypto'

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

describe('web-crypto (browser)', () => {
  beforeAll(() => {
    // Ensure subtle exists
    expect(globalThis.crypto && globalThis.crypto.subtle).toBeTruthy()
  })

  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    // Clear any in-memory state
    clearAllGuestCredentialsFor('test-provider')
  })

  it('encrypt/decrypt with AES key', async () => {
    const key = await generateEphemeralAesKey()
    const plaintext = 'secret-value-123'
    const bundle = await encryptWithKey(plaintext, key)
    const roundTrip = await decryptWithKey(bundle, key)
    expect(roundTrip).toBe(plaintext)
  })

  it('PBKDF2 derive and passphrase encrypt/decrypt', async () => {
    const pass = 'passphrase'
    const plaintext = 'api-key-XYZ'
    const bundle = await encryptWithPassphrase(plaintext, pass)
    const roundTrip = await decryptWithPassphrase(bundle, pass)
    expect(roundTrip).toBe(plaintext)
  })

  it('import raw AES key and encrypt', async () => {
    const raw = new Uint8Array(32)
    const key = await importAesKeyRaw(raw)
    const bundle = await encryptWithKey('hello', key)
    const back = await decryptWithKey(bundle, key)
    expect(back).toBe('hello')
  })

  it('maskKey shows prefix and tail', () => {
    const masked = maskKey('sk-super-secret-abcdef')
    expect(masked.includes('…')).toBe(true)
    expect(masked.endsWith('cdef')).toBe(true)
  })

  it('memory/session/persistent flows', async () => {
    const provider = 'openai'

    await setMemoryCredential(provider, 'sk-memory-123456')
    const mem = getMemoryCredential(provider)
    expect(mem?.masked).toContain('…')

    await setSessionCredential(provider, 'sk-session-abcdef')
    const ses = await getSessionCredential(provider)
    expect(ses?.plaintext).toBe('sk-session-abcdef')

    await setPersistentCredential(provider, 'sk-persist-ghijk', 'pw')
    const per = await getPersistentCredential(provider, 'pw')
    expect(per?.plaintext).toBe('sk-persist-ghijk')

    clearAllGuestCredentialsFor(provider)
    expect(getMemoryCredential(provider)).toBeNull()
  })

  describe('Error Handling', () => {
    it('should handle empty strings gracefully', async () => {
      const key = await generateEphemeralAesKey()
      const bundle = await encryptWithKey('', key)
      const decrypted = await decryptWithKey(bundle, key)
      expect(decrypted).toBe('')
    })

    it('should throw on missing salt for passphrase decryption', async () => {
      const bundle: EncryptBundle = {
        ciphertextB64: 'dummy',
        ivB64: 'dummy',
        alg: 'AES-GCM',
        v: 1,
        // saltB64 missing
      }
      
      await expect(decryptWithPassphrase(bundle, 'pass')).rejects.toThrow(
        'Missing salt for passphrase decryption'
      )
    })

    it('should throw on invalid ciphertext', async () => {
      const key = await generateEphemeralAesKey()
      const bundle: EncryptBundle = {
        ciphertextB64: 'invalid-base64',
        ivB64: 'aW52YWxpZA==', // 'invalid' in base64
        alg: 'AES-GCM',
        v: 1,
      }
      
      await expect(decryptWithKey(bundle, key)).rejects.toThrow()
    })

    it('should throw on wrong passphrase', async () => {
      const plaintext = 'secret'
      const bundle = await encryptWithPassphrase(plaintext, 'correct-pass')
      
      await expect(decryptWithPassphrase(bundle, 'wrong-pass')).rejects.toThrow()
    })

    it('should handle corrupted storage data gracefully', async () => {
      sessionStorage.setItem('guestByok:session:test', 'corrupted-json')
      
      // Should throw due to invalid JSON, not return null
      await expect(getSessionCredential('test')).rejects.toThrow('Failed to parse session storage data')
    })
  })

  describe('Key Masking', () => {
    it('should mask very short keys', () => {
      // The implementation always shows first 4 chars + ellipsis + last 4 chars
      expect(maskKey('abc')).toBe('abc…abc') // Shows full key as prefix, then ellipsis, then full key as suffix
      expect(maskKey('ab')).toBe('ab…ab')
      expect(maskKey('a')).toBe('a…a')
      expect(maskKey('')).toBe('')
    })

    it('should handle custom visible length', () => {
      const key = 'sk-1234567890abcdef'
      const masked = maskKey(key, 2)
      expect(masked).toBe('sk-1…ef')
    })

    it('should handle unicode characters', () => {
      const key = 'sk-🔑-secret-key-🗝️'
      const masked = maskKey(key)
      expect(masked).toContain('…')
      // The maskKey function takes individual characters, so unicode gets split
      // The first 4 characters by index are: 's', 'k', '-', and half of the emoji
      expect(masked.startsWith('sk-')).toBe(true)
    })
  })

  describe('PBKDF2 Key Derivation', () => {
    it('should derive same key from same passphrase and salt', async () => {
      const passphrase = 'test-passphrase'
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt)
      const key2 = await deriveKeyFromPassphrase(passphrase, salt)
      
      // Keys should be functionally identical (test by encrypting/decrypting)
      const plaintext = 'test-data'
      const bundle1 = await encryptWithKey(plaintext, key1)
      const decrypted = await decryptWithKey(bundle1, key2)
      expect(decrypted).toBe(plaintext)
    })

    it('should derive different keys from different salts', async () => {
      const passphrase = 'test-passphrase'
      const salt1 = new Uint8Array(16).fill(1)
      const salt2 = new Uint8Array(16).fill(2)
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt1)
      const key2 = await deriveKeyFromPassphrase(passphrase, salt2)
      
      // Keys should be different (test by cross-decryption failure)
      const plaintext = 'test-data'
      const bundle1 = await encryptWithKey(plaintext, key1)
      
      await expect(decryptWithKey(bundle1, key2)).rejects.toThrow()
    })

    it('should handle custom iteration counts', async () => {
      const passphrase = 'test-passphrase'
      const salt = new Uint8Array(16).fill(1)
      
      const key1 = await deriveKeyFromPassphrase(passphrase, salt, 1000)
      const key2 = await deriveKeyFromPassphrase(passphrase, salt, 2000)
      
      // Different iteration counts should produce different keys
      const plaintext = 'test-data'
      const bundle1 = await encryptWithKey(plaintext, key1)
      
      await expect(decryptWithKey(bundle1, key2)).rejects.toThrow()
    })
  })

  describe('Storage Helpers', () => {
    it('should handle missing session key gracefully', async () => {
      // First set a valid session credential to initialize SESSION_AES_KEY
      await setSessionCredential('temp', 'temp-key')
      
      // Now manually set invalid session storage data
      // This should fail during decryption and the function should handle it gracefully
      sessionStorage.setItem('guestByok:session:test', JSON.stringify({
        ciphertextB64: 'dGVzdA==',
        ivB64: 'aXZfdGVzdA==',
        alg: 'AES-GCM',
        v: 1
      }))
      
      // Should throw due to invalid ciphertext with wrong key
      await expect(getSessionCredential('test')).rejects.toThrow()
    })

    it('should handle non-existent providers gracefully', () => {
      expect(getMemoryCredential('non-existent')).toBeNull()
    })

    it('should handle non-existent session credentials gracefully', async () => {
      const result = await getSessionCredential('non-existent')
      expect(result).toBeNull()
    })

    it('should handle non-existent persistent credentials gracefully', async () => {
      const result = await getPersistentCredential('non-existent', 'any-pass')
      expect(result).toBeNull()
    })

    it('should maintain separate credentials per provider', async () => {
      await setMemoryCredential('provider1', 'key1')
      await setMemoryCredential('provider2', 'key2')
      
      const cred1 = getMemoryCredential('provider1')
      const cred2 = getMemoryCredential('provider2')
      
      expect(cred1).not.toBeNull()
      expect(cred2).not.toBeNull()
      expect(cred1?.masked).not.toBe(cred2?.masked)
    })
  })

  describe('AES Encryption', () => {
    it('should produce different ciphertexts for same plaintext', async () => {
      const key = await generateEphemeralAesKey()
      const plaintext = 'same-plaintext'
      
      const bundle1 = await encryptWithKey(plaintext, key)
      const bundle2 = await encryptWithKey(plaintext, key)
      
      // Different IVs should produce different ciphertexts
      expect(bundle1.ciphertextB64).not.toBe(bundle2.ciphertextB64)
      expect(bundle1.ivB64).not.toBe(bundle2.ivB64)
      
      // But both should decrypt to same plaintext
      expect(await decryptWithKey(bundle1, key)).toBe(plaintext)
      expect(await decryptWithKey(bundle2, key)).toBe(plaintext)
    })

    it('should handle large plaintexts', async () => {
      const key = await generateEphemeralAesKey()
      const largePlaintext = 'A'.repeat(10000) // 10KB string
      
      const bundle = await encryptWithKey(largePlaintext, key)
      const decrypted = await decryptWithKey(bundle, key)
      
      expect(decrypted).toBe(largePlaintext)
    })

    it('should use proper IV length', async () => {
      const key = await generateEphemeralAesKey()
      const bundle = await encryptWithKey('test', key)
      
      // IV should be base64 encoded 12 bytes (96 bits) = 16 chars in base64
      const ivBytes = atob(bundle.ivB64)
      expect(ivBytes.length).toBe(12)
    })

    it('should use custom IV when provided', async () => {
      const key = await generateEphemeralAesKey()
      const customIv = new Uint8Array(12).fill(42)
      
      const bundle = await encryptWithKey('test', key, customIv)
      
      // Should use the provided IV
      const decodedIv = new Uint8Array(atob(bundle.ivB64).split('').map(c => c.charCodeAt(0)))
      expect(decodedIv).toEqual(customIv)
    })
  })

  describe('Bundle Structure', () => {
    it('should have correct bundle structure for key encryption', async () => {
      const key = await generateEphemeralAesKey()
      const bundle = await encryptWithKey('test', key)
      
      expect(bundle).toHaveProperty('ciphertextB64')
      expect(bundle).toHaveProperty('ivB64')
      expect(bundle).toHaveProperty('alg', 'AES-GCM')
      expect(bundle).toHaveProperty('v', 1)
      expect(bundle).not.toHaveProperty('saltB64')
      
      expect(typeof bundle.ciphertextB64).toBe('string')
      expect(typeof bundle.ivB64).toBe('string')
    })

    it('should have correct bundle structure for passphrase encryption', async () => {
      const bundle = await encryptWithPassphrase('test', 'pass')
      
      expect(bundle).toHaveProperty('ciphertextB64')
      expect(bundle).toHaveProperty('ivB64')
      expect(bundle).toHaveProperty('saltB64')
      expect(bundle).toHaveProperty('alg', 'AES-GCM')
      expect(bundle).toHaveProperty('v', 1)
      
      expect(typeof bundle.ciphertextB64).toBe('string')
      expect(typeof bundle.ivB64).toBe('string')
      expect(typeof bundle.saltB64).toBe('string')
    })
  })

  describe('Security Properties', () => {
    it('should never store plaintext in memory storage', async () => {
      const provider = 'test-provider'
      const plaintext = 'secret-api-key'
      
      await setMemoryCredential(provider, plaintext)
      const stored = getMemoryCredential(provider)
      
      // Check that no property contains the plaintext
      const storedStr = JSON.stringify(stored)
      expect(storedStr).not.toContain(plaintext)
      expect(stored?.masked).not.toBe(plaintext)
    })

    it('should never store plaintext in session storage', async () => {
      const provider = 'test-provider'
      const plaintext = 'secret-api-key'
      
      await setSessionCredential(provider, plaintext)
      
      // Check session storage doesn't contain plaintext
      const sessionData = sessionStorage.getItem(`guestByok:session:${provider}`)
      expect(sessionData).toBeTruthy()
      expect(sessionData!).not.toContain(plaintext)
    })

    it('should never store plaintext in local storage', async () => {
      const provider = 'test-provider'
      const plaintext = 'secret-api-key'
      const passphrase = 'user-passphrase'
      
      await setPersistentCredential(provider, plaintext, passphrase)
      
      // Check local storage doesn't contain plaintext
      const localData = localStorage.getItem(`guestByok:persistent:${provider}`)
      expect(localData).toBeTruthy()
      expect(localData!).not.toContain(plaintext)
      expect(localData!).not.toContain(passphrase)
    })

    it('should generate unique salts for each passphrase encryption', async () => {
      const plaintext = 'same-secret'
      const passphrase = 'same-passphrase'
      
      const bundle1 = await encryptWithPassphrase(plaintext, passphrase)
      const bundle2 = await encryptWithPassphrase(plaintext, passphrase)
      
      expect(bundle1.saltB64).not.toBe(bundle2.saltB64)
      expect(bundle1.ciphertextB64).not.toBe(bundle2.ciphertextB64)
    })
  })
})

