import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabase, TestDatabaseManager } from '../utils/test-database'
import DatabaseFactories from '../factories/database-factories'
import { eq, and, desc, asc, sql, count, isNull, isNotNull } from 'drizzle-orm'
import { users, userKeys, apiKeyAuditLog } from '../../lib/db/schema'
import { encryptApiKey, decryptApiKey, maskApiKey } from '../../lib/security/encryption'
import type { Provider } from '../../lib/db/schema'

/**
 * User Keys Repository Integration Tests
 * Tests API key management with encryption and audit logging
 */

describe('User Keys Repository Integration Tests', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof testDb.getDb>

  beforeAll(async () => {
    testDb = await TestDatabaseManager.createInstance('user-keys-repository-tests')
    db = testDb.getDb()
  })

  afterAll(async () => {
    await TestDatabaseManager.destroyInstance('user-keys-repository-tests')
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  describe('User Key CRUD Operations', () => {
    test('should create encrypted API key with all fields', async () => {
      // Given: User exists and API key data
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const plainApiKey = 'sk-test123456789abcdefghijklmnopqrstuvwxyz12345'
      const provider: Provider = 'openai'
      const encryptedData = encryptApiKey(plainApiKey, user.id)

      const userKeyData = DatabaseFactories.createUserKey(user.id, {
        overrides: {
          provider,
          encryptedKey: `${encryptedData.encrypted}:${encryptedData.iv}:${encryptedData.authTag}`,
          isActive: true
        }
      })

      // When: User key is created
      const [createdKey] = await db.insert(userKeys).values(userKeyData).returning()

      // Then: Key should be created with encryption data
      expect(createdKey).toBeDefined()
      expect(createdKey.id).toBeDefined()
      expect(createdKey.userId).toBe(user.id)
      expect(createdKey.provider).toBe(provider)
      expect(createdKey.encryptedKey).toContain(':') // Contains IV and auth tag
      expect(createdKey.isActive).toBe(true)
      expect(createdKey.createdAt).toBeDefined()
      expect(createdKey.updatedAt).toBeDefined()

      // And: Key should be decryptable
      const [encrypted, iv, authTag] = createdKey.encryptedKey.split(':')
      const decryptedKey = decryptApiKey(encrypted, iv, authTag, user.id)
      expect(decryptedKey).toBe(plainApiKey)
    })

    test('should enforce unique constraint per user-provider combination', async () => {
      // Given: User with existing API key for provider
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const provider: Provider = 'anthropic'
      const firstKey = DatabaseFactories.createUserKey(user.id, {
        overrides: { provider }
      })
      await db.insert(userKeys).values(firstKey)

      // When: Attempting to insert duplicate provider key
      const duplicateKey = DatabaseFactories.createUserKey(user.id, {
        overrides: { provider }
      })

      // Then: Should throw unique constraint violation
      await expect(
        db.insert(userKeys).values(duplicateKey)
      ).rejects.toThrow()
    })

    test('should read user keys by provider', async () => {
      // Given: User with multiple API keys
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const keyData = [
        DatabaseFactories.createUserKey(user.id, { overrides: { provider: 'openai' } }),
        DatabaseFactories.createUserKey(user.id, { overrides: { provider: 'anthropic' } }),
        DatabaseFactories.createUserKey(user.id, { overrides: { provider: 'google' } })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Querying specific provider key
      const [openaiKey] = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          eq(userKeys.provider, 'openai')
        ))
        .limit(1)

      // Then: Correct provider key should be returned
      expect(openaiKey).toBeDefined()
      expect(openaiKey.provider).toBe('openai')
      expect(openaiKey.userId).toBe(user.id)
    })

    test('should update API key and track changes', async () => {
      // Given: Existing user key
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const originalKey = DatabaseFactories.createUserKey(user.id, {
        overrides: { 
          provider: 'openai',
          isActive: true,
          lastUsedAt: null
        }
      })
      const [createdKey] = await db.insert(userKeys).values(originalKey).returning()

      // When: Key is updated
      const newEncryptedData = 'new-encrypted-key-data'
      const now = new Date()

      const [updatedKey] = await db
        .update(userKeys)
        .set({
          encryptedKey: newEncryptedData,
          lastUsedAt: now,
          updatedAt: now
        })
        .where(eq(userKeys.id, createdKey.id))
        .returning()

      // Then: Key should be updated correctly
      expect(updatedKey.encryptedKey).toBe(newEncryptedData)
      expect(updatedKey.lastUsedAt).toEqual(now)
      expect(updatedKey.updatedAt).toEqual(now)
      expect(updatedKey.updatedAt).not.toEqual(createdKey.updatedAt)
    })

    test('should soft delete by deactivating key', async () => {
      // Given: Active user key
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const keyData = DatabaseFactories.createUserKey(user.id, {
        overrides: { isActive: true }
      })
      const [createdKey] = await db.insert(userKeys).values(keyData).returning()

      // When: Key is deactivated
      const [deactivatedKey] = await db
        .update(userKeys)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(userKeys.id, createdKey.id))
        .returning()

      // Then: Key should be deactivated but not deleted
      expect(deactivatedKey.isActive).toBe(false)
      expect(deactivatedKey.id).toBe(createdKey.id)

      // And: Should not appear in active key queries
      const activeKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          eq(userKeys.isActive, true)
        ))

      expect(activeKeys).toHaveLength(0)
    })

    test('should cascade delete when user is deleted', async () => {
      // Given: User with API keys
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const keyData = [
        DatabaseFactories.createUserKey(user.id, { overrides: { provider: 'openai' } }),
        DatabaseFactories.createUserKey(user.id, { overrides: { provider: 'anthropic' } })
      ]
      await db.insert(userKeys).values(keyData)

      // When: User is deleted
      await db.delete(users).where(eq(users.id, user.id))

      // Then: All user keys should be deleted
      const remainingKeys = await db
        .select()
        .from(userKeys)
        .where(eq(userKeys.userId, user.id))

      expect(remainingKeys).toHaveLength(0)
    })
  })

  describe('User Key Queries and Filtering', () => {
    test('should filter keys by activation status', async () => {
      // Given: User with mix of active and inactive keys
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const keyData = [
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'openai', isActive: true } 
        }),
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'anthropic', isActive: false } 
        }),
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'google', isActive: true } 
        })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Filtering by status
      const activeKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          eq(userKeys.isActive, true)
        ))

      const inactiveKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          eq(userKeys.isActive, false)
        ))

      // Then: Correct keys should be returned
      expect(activeKeys).toHaveLength(2)
      expect(inactiveKeys).toHaveLength(1)

      activeKeys.forEach(key => expect(key.isActive).toBe(true))
      inactiveKeys.forEach(key => expect(key.isActive).toBe(false))
    })

    test('should filter keys by usage recency', async () => {
      // Given: Keys with different last used timestamps
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const now = new Date()
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

      const keyData = [
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'openai', lastUsedAt: now } 
        }),
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'anthropic', lastUsedAt: recentDate } 
        }),
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'google', lastUsedAt: oldDate } 
        }),
        DatabaseFactories.createUserKey(user.id, { 
          overrides: { provider: 'mistral', lastUsedAt: null } 
        })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Filtering by recent usage (last 7 days)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const recentlyUsedKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          sql`${userKeys.lastUsedAt} >= ${sevenDaysAgo}`
        ))

      const neverUsedKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          isNull(userKeys.lastUsedAt)
        ))

      // Then: Correct keys should be returned
      expect(recentlyUsedKeys).toHaveLength(2) // now and recentDate
      expect(neverUsedKeys).toHaveLength(1) // mistral key
    })

    test('should query keys by multiple providers', async () => {
      // Given: User with various provider keys
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const providers: Provider[] = ['openai', 'anthropic', 'google', 'xai', 'groq']
      const keyData = providers.map(provider => 
        DatabaseFactories.createUserKey(user.id, { overrides: { provider } })
      )
      await db.insert(userKeys).values(keyData)

      // When: Querying for AI chat providers
      const chatProviders: Provider[] = ['openai', 'anthropic', 'google']
      const chatProviderKeys = await db
        .select()
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          sql`${userKeys.provider} = ANY(${chatProviders})`
        ))

      // Then: Only chat provider keys should be returned
      expect(chatProviderKeys).toHaveLength(3)
      chatProviderKeys.forEach(key => {
        expect(chatProviders).toContain(key.provider)
      })
    })

    test('should sort keys by creation and usage dates', async () => {
      // Given: Keys created at different times
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const now = new Date()
      const keyData = [
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'openai',
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            lastUsedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
          }
        }),
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'anthropic',
            createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            lastUsedAt: now
          }
        }),
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'google',
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            lastUsedAt: null
          }
        })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Sorting by different criteria
      const byCreationDesc = await db
        .select()
        .from(userKeys)
        .where(eq(userKeys.userId, user.id))
        .orderBy(desc(userKeys.createdAt))

      const byLastUsedDesc = await db
        .select()
        .from(userKeys)
        .where(eq(userKeys.userId, user.id))
        .orderBy(desc(userKeys.lastUsedAt))

      // Then: Sorting should be correct
      expect(byCreationDesc[0].provider).toBe('anthropic') // Most recent
      expect(byCreationDesc[2].provider).toBe('openai') // Oldest

      expect(byLastUsedDesc[0].provider).toBe('anthropic') // Most recently used
      // Note: NULL values typically sort last in descending order
    })
  })

  describe('User Key Security Operations', () => {
    test('should handle key rotation with encryption', async () => {
      // Given: User with existing encrypted key
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const originalPlainKey = 'sk-original123456789abcdefg'
      const provider: Provider = 'openai'
      const originalEncrypted = encryptApiKey(originalPlainKey, user.id)
      
      const keyData = DatabaseFactories.createUserKey(user.id, {
        overrides: {
          provider,
          encryptedKey: `${originalEncrypted.encrypted}:${originalEncrypted.iv}:${originalEncrypted.authTag}`
        }
      })
      const [createdKey] = await db.insert(userKeys).values(keyData).returning()

      // When: Key is rotated to new value
      const newPlainKey = 'sk-rotated987654321hijklmn'
      const newEncrypted = encryptApiKey(newPlainKey, user.id)
      
      const [rotatedKey] = await db
        .update(userKeys)
        .set({
          encryptedKey: `${newEncrypted.encrypted}:${newEncrypted.iv}:${newEncrypted.authTag}`,
          updatedAt: new Date()
        })
        .where(eq(userKeys.id, createdKey.id))
        .returning()

      // Then: New key should be decryptable and old key should not work
      const [encrypted, iv, authTag] = rotatedKey.encryptedKey.split(':')
      const decryptedKey = decryptApiKey(encrypted, iv, authTag, user.id)
      expect(decryptedKey).toBe(newPlainKey)
      expect(decryptedKey).not.toBe(originalPlainKey)
    })

    test('should validate key format patterns', async () => {
      // Given: User and different key formats
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const validKeys = [
        { provider: 'openai' as Provider, key: 'sk-1234567890abcdefghijklmnopqrstuvwxyz123456789012' },
        { provider: 'anthropic' as Provider, key: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz12345678' },
        { provider: 'google' as Provider, key: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567' }
      ]

      // When: Keys are encrypted and stored
      const keyData = validKeys.map(({ provider, key }) => {
        const encrypted = encryptApiKey(key, user.id)
        return DatabaseFactories.createUserKey(user.id, {
          overrides: {
            provider,
            encryptedKey: `${encrypted.encrypted}:${encrypted.iv}:${encrypted.authTag}`
          }
        })
      })

      await db.insert(userKeys).values(keyData)

      // Then: All keys should be stored successfully
      const storedKeys = await db
        .select()
        .from(userKeys)
        .where(eq(userKeys.userId, user.id))

      expect(storedKeys).toHaveLength(3)
      
      // Verify each can be decrypted to original format
      storedKeys.forEach((storedKey, index) => {
        const [encrypted, iv, authTag] = storedKey.encryptedKey.split(':')
        const decrypted = decryptApiKey(encrypted, iv, authTag, user.id)
        expect(decrypted).toBe(validKeys[index].key)
      })
    })

    test('should handle key masking for display', async () => {
      // Given: User with API key
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const plainKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz'
      const encrypted = encryptApiKey(plainKey, user.id)
      
      const keyData = DatabaseFactories.createUserKey(user.id, {
        overrides: {
          provider: 'openai',
          encryptedKey: `${encrypted.encrypted}:${encrypted.iv}:${encrypted.authTag}`
        }
      })
      const [createdKey] = await db.insert(userKeys).values(keyData).returning()

      // When: Key is retrieved for display
      const [storedKey] = await db
        .select({
          id: userKeys.id,
          provider: userKeys.provider,
          encryptedKey: userKeys.encryptedKey,
          isActive: userKeys.isActive,
          lastUsedAt: userKeys.lastUsedAt,
          createdAt: userKeys.createdAt
        })
        .from(userKeys)
        .where(eq(userKeys.id, createdKey.id))

      // Then: Key can be decrypted and masked
      const [encryptedPart, iv, authTag] = storedKey.encryptedKey.split(':')
      const decryptedKey = decryptApiKey(encryptedPart, iv, authTag, user.id)
      const maskedKey = maskApiKey(decryptedKey)

      expect(maskedKey).toBe('sk-t****************************wxyz')
      expect(maskedKey).not.toBe(plainKey)
      expect(maskedKey.length).toBe(plainKey.length)
    })
  })

  describe('User Key Statistics and Analytics', () => {
    test('should count keys by provider across users', async () => {
      // Given: Multiple users with various provider keys
      const user1Data = DatabaseFactories.createUser()
      const user2Data = DatabaseFactories.createUser()
      const [user1] = await db.insert(users).values(user1Data).returning()
      const [user2] = await db.insert(users).values(user2Data).returning()

      const keyData = [
        // User 1 keys
        DatabaseFactories.createUserKey(user1.id, { overrides: { provider: 'openai' } }),
        DatabaseFactories.createUserKey(user1.id, { overrides: { provider: 'anthropic' } }),
        // User 2 keys  
        DatabaseFactories.createUserKey(user2.id, { overrides: { provider: 'openai' } }),
        DatabaseFactories.createUserKey(user2.id, { overrides: { provider: 'google' } }),
        DatabaseFactories.createUserKey(user2.id, { overrides: { provider: 'anthropic' } })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Aggregating by provider
      const providerStats = await db
        .select({
          provider: userKeys.provider,
          totalKeys: count(userKeys.id),
          activeKeys: sql`COUNT(*) FILTER (WHERE ${userKeys.isActive} = true)`.mapWith(Number),
          uniqueUsers: sql`COUNT(DISTINCT ${userKeys.userId})`.mapWith(Number)
        })
        .from(userKeys)
        .groupBy(userKeys.provider)
        .orderBy(desc(count(userKeys.id)))

      // Then: Statistics should be accurate
      expect(providerStats).toHaveLength(3)
      
      const openaiStats = providerStats.find(s => s.provider === 'openai')
      const anthropicStats = providerStats.find(s => s.provider === 'anthropic')
      const googleStats = providerStats.find(s => s.provider === 'google')

      expect(openaiStats?.totalKeys).toBe(2)
      expect(openaiStats?.uniqueUsers).toBe(2)
      expect(anthropicStats?.totalKeys).toBe(2)
      expect(anthropicStats?.uniqueUsers).toBe(2)
      expect(googleStats?.totalKeys).toBe(1)
      expect(googleStats?.uniqueUsers).toBe(1)
    })

    test('should analyze key usage patterns', async () => {
      // Given: Keys with different usage patterns
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const now = new Date()
      const keyData = [
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'openai',
            lastUsedAt: now, // Very active
            createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
          }
        }),
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'anthropic',
            lastUsedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // Moderately active
            createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
          }
        }),
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'google',
            lastUsedAt: null, // Never used
            createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
          }
        })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Analyzing usage patterns
      const usageStats = await db
        .select({
          provider: userKeys.provider,
          daysSinceCreated: sql`EXTRACT(DAY FROM NOW() - ${userKeys.createdAt})`.mapWith(Number),
          daysSinceLastUsed: sql`CASE 
            WHEN ${userKeys.lastUsedAt} IS NULL THEN NULL 
            ELSE EXTRACT(DAY FROM NOW() - ${userKeys.lastUsedAt})
          END`.mapWith(Number),
          isRecentlyUsed: sql`${userKeys.lastUsedAt} > NOW() - INTERVAL '7 days'`.mapWith(Boolean)
        })
        .from(userKeys)
        .where(eq(userKeys.userId, user.id))
        .orderBy(asc(userKeys.createdAt))

      // Then: Usage analysis should be accurate
      expect(usageStats).toHaveLength(3)
      
      const openaiStats = usageStats.find(s => s.provider === 'openai')
      const anthropicStats = usageStats.find(s => s.provider === 'anthropic')
      const googleStats = usageStats.find(s => s.provider === 'google')

      expect(openaiStats?.isRecentlyUsed).toBe(true)
      expect(anthropicStats?.isRecentlyUsed).toBe(false)
      expect(googleStats?.daysSinceLastUsed).toBeNull()
    })

    test('should identify inactive keys for cleanup', async () => {
      // Given: Keys with various activity levels
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const now = new Date()
      const keyData = [
        // Active key
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'openai',
            isActive: true,
            lastUsedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
          }
        }),
        // Inactive key but recently used
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'anthropic',
            isActive: false,
            lastUsedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
          }
        }),
        // Active but old unused key
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'google',
            isActive: true,
            lastUsedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          }
        }),
        // Never used key
        DatabaseFactories.createUserKey(user.id, {
          overrides: { 
            provider: 'mistral',
            isActive: true,
            lastUsedAt: null,
            createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
          }
        })
      ]
      await db.insert(userKeys).values(keyData)

      // When: Finding keys for cleanup (inactive or unused for 30+ days)
      const cleanupCandidates = await db
        .select({
          id: userKeys.id,
          provider: userKeys.provider,
          isActive: userKeys.isActive,
          lastUsedAt: userKeys.lastUsedAt,
          createdAt: userKeys.createdAt
        })
        .from(userKeys)
        .where(and(
          eq(userKeys.userId, user.id),
          sql`(
            ${userKeys.isActive} = false 
            OR ${userKeys.lastUsedAt} < NOW() - INTERVAL '30 days'
            OR (${userKeys.lastUsedAt} IS NULL AND ${userKeys.createdAt} < NOW() - INTERVAL '30 days')
          )`
        ))

      // Then: Appropriate keys should be identified for cleanup
      expect(cleanupCandidates).toHaveLength(3) // anthropic, google, mistral
      
      const providers = cleanupCandidates.map(k => k.provider).sort()
      expect(providers).toEqual(['anthropic', 'google', 'mistral'])
    })
  })

  describe('API Key Audit Integration', () => {
    test('should create audit log entry for key operations', async () => {
      // Given: User with API key
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const keyData = DatabaseFactories.createUserKey(user.id, {
        overrides: { provider: 'openai' }
      })
      const [createdKey] = await db.insert(userKeys).values(keyData).returning()

      // When: Audit log entries are created for key operations
      const auditEntries = [
        {
          id: DatabaseFactories.createUser().id!, // Generate random ID
          userId: user.id,
          provider: 'openai' as Provider,
          action: 'created',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          success: true,
          errorMessage: null,
          createdAt: new Date()
        },
        {
          id: DatabaseFactories.createUser().id!, // Generate random ID  
          userId: user.id,
          provider: 'openai' as Provider,
          action: 'used',
          ipAddress: '192.168.1.100', 
          userAgent: 'Mozilla/5.0 (Test Browser)',
          success: true,
          errorMessage: null,
          createdAt: new Date()
        }
      ]

      await db.insert(apiKeyAuditLog).values(auditEntries)

      // Then: Audit entries should be queryable with user key
      const keyWithAudit = await db
        .select({
          keyId: userKeys.id,
          keyProvider: userKeys.provider,
          auditId: apiKeyAuditLog.id,
          auditAction: apiKeyAuditLog.action,
          auditSuccess: apiKeyAuditLog.success,
          auditCreatedAt: apiKeyAuditLog.createdAt
        })
        .from(userKeys)
        .leftJoin(apiKeyAuditLog, and(
          eq(userKeys.userId, apiKeyAuditLog.userId),
          eq(userKeys.provider, apiKeyAuditLog.provider)
        ))
        .where(eq(userKeys.id, createdKey.id))
        .orderBy(desc(apiKeyAuditLog.createdAt))

      expect(keyWithAudit).toHaveLength(2)
      expect(keyWithAudit[0].auditAction).toBe('used')
      expect(keyWithAudit[1].auditAction).toBe('created')
    })

    test('should track failed key operations', async () => {
      // Given: User attempting key operations
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      // When: Failed operations are logged
      const failedAuditEntries = [
        {
          id: DatabaseFactories.createUser().id!,
          userId: user.id,
          provider: 'openai' as Provider,
          action: 'created',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          success: false,
          errorMessage: 'Invalid API key format',
          createdAt: new Date()
        },
        {
          id: DatabaseFactories.createUser().id!,
          userId: user.id,
          provider: 'anthropic' as Provider,
          action: 'used',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          success: false,
          errorMessage: 'API key expired',
          createdAt: new Date()
        }
      ]

      await db.insert(apiKeyAuditLog).values(failedAuditEntries)

      // Then: Failed operations should be trackable
      const failedOperations = await db
        .select()
        .from(apiKeyAuditLog)
        .where(and(
          eq(apiKeyAuditLog.userId, user.id),
          eq(apiKeyAuditLog.success, false)
        ))

      expect(failedOperations).toHaveLength(2)
      failedOperations.forEach(operation => {
        expect(operation.success).toBe(false)
        expect(operation.errorMessage).toBeDefined()
      })
    })
  })
})