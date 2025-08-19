import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabase, TestDatabaseManager } from '../utils/test-database'
import DatabaseFactories from '../factories/database-factories'
import * as dbOperations from '../../lib/db/operations'
import { encryptApiKey, decryptApiKey } from '../../lib/security/encryption'
import { eq } from 'drizzle-orm'
import { users, chats, messages, userKeys } from '../../lib/db/schema'

/**
 * Database Operations Acceptance Tests
 * TDD London (outside-in) approach - testing complete user flows
 */

describe('Database Operations - Acceptance Tests', () => {
  let testDb: TestDatabase

  beforeAll(async () => {
    testDb = await TestDatabaseManager.createInstance('acceptance-tests')
  })

  afterAll(async () => {
    await TestDatabaseManager.destroyAll()
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  describe('User Authentication Flow', () => {
    test('should create and validate guest user successfully', async () => {
      // Given: A new guest user needs to be created
      const guestUser = await dbOperations.createGuestUser()
      
      // Then: Guest user should be created with correct properties
      expect(guestUser).toBeDefined()
      expect(guestUser.id).toBeDefined()
      expect(guestUser.anonymous).toBe(true)
      expect(guestUser.email).toBeUndefined()
      expect(guestUser.displayName).toBeUndefined()

      // And: Guest user should be validatable
      const isValid = await dbOperations.validateGuestUser(guestUser.id)
      expect(isValid).toBe(true)
    })

    test('should reject invalid guest user IDs', async () => {
      // Given: Invalid user IDs
      const invalidIds = [
        'invalid-uuid',
        '123',
        '',
        'not-a-uuid-at-all'
      ]

      // When/Then: All invalid IDs should be rejected
      for (const invalidId of invalidIds) {
        const isValid = await dbOperations.validateGuestUser(invalidId)
        expect(isValid).toBe(false)
      }
    })

    test('should handle authenticated user registration flow', async () => {
      // Given: User registration data
      const userData = DatabaseFactories.createUser({
        overrides: {
          email: 'test@roborail.com',
          displayName: 'Test User',
          anonymous: false
        }
      })

      // When: User is created and retrieved
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(userData).returning()
      const retrievedUser = await dbOperations.getUserById(createdUser.id)

      // Then: User should be properly stored and retrievable
      expect(retrievedUser).toBeDefined()
      expect(retrievedUser?.email).toBe('test@roborail.com')
      expect(retrievedUser?.anonymous).toBe(false)
      expect(retrievedUser?.dailyMessageCount).toBe(0)
      expect(retrievedUser?.dailyProMessageCount).toBe(0)
    })

    test('should track user activity correctly', async () => {
      // Given: An existing user
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      const originalLastActive = createdUser.lastActiveAt

      // When: User activity is updated
      await new Promise(resolve => setTimeout(resolve, 10)) // Ensure time difference
      await dbOperations.updateUserActivity(createdUser.id)

      // Then: Last active timestamp should be updated
      const updatedUser = await dbOperations.getUserById(createdUser.id)
      expect(updatedUser?.lastActiveAt).not.toEqual(originalLastActive)
      expect(updatedUser?.updatedAt).not.toEqual(createdUser.updatedAt)
    })
  })

  describe('Chat Creation and Management', () => {
    test('should create and manage chat lifecycle', async () => {
      // Given: A user exists
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      // When: A new chat is created
      const newChat = await dbOperations.createChat(
        createdUser.id, 
        'RoboRail Troubleshooting', 
        'claude-3-5-sonnet'
      )

      // Then: Chat should be created with correct properties
      expect(newChat).toBeDefined()
      expect(newChat.title).toBe('RoboRail Troubleshooting')
      expect(newChat.model).toBe('claude-3-5-sonnet')
      expect(newChat.userId).toBe(createdUser.id)

      // And: Chat should be retrievable
      const retrievedChat = await dbOperations.getChatById(newChat.id)
      expect(retrievedChat).toBeDefined()
      expect(retrievedChat?.title).toBe('RoboRail Troubleshooting')

      // And: User chats should include the new chat
      const userChats = await dbOperations.getUserChats(createdUser.id)
      expect(userChats).toHaveLength(1)
      expect(userChats[0].id).toBe(newChat.id)
    })

    test('should handle chat activity updates', async () => {
      // Given: An existing chat
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      const chat = await dbOperations.createChat(createdUser.id, 'Test Chat')

      const originalUpdatedAt = chat.updatedAt

      // When: Chat activity is updated
      await new Promise(resolve => setTimeout(resolve, 10))
      await dbOperations.updateChatActivity(chat.id)

      // Then: Chat's updated timestamp should change
      const updatedChat = await dbOperations.getChatById(chat.id)
      expect(updatedChat?.updatedAt).not.toEqual(originalUpdatedAt)
    })

    test('should manage multiple chats per user', async () => {
      // Given: A user with multiple chats
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      const chatTitles = [
        'Plasma Cutting Issues',
        'Calibration Questions', 
        'Maintenance Schedule',
        'Part Replacement Guide'
      ]

      // When: Multiple chats are created
      const createdChats = await Promise.all(
        chatTitles.map(title => 
          dbOperations.createChat(createdUser.id, title, 'gpt-4o')
        )
      )

      // Then: All chats should be retrievable
      const userChats = await dbOperations.getUserChats(createdUser.id)
      expect(userChats).toHaveLength(4)

      const retrievedTitles = userChats.map(chat => chat.title).sort()
      expect(retrievedTitles).toEqual(chatTitles.sort())
    })
  })

  describe('Message Storage and Retrieval', () => {
    test('should handle complete conversation flow', async () => {
      // Given: User and chat exist
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      const chat = await dbOperations.createChat(createdUser.id, 'Technical Support')

      // When: A conversation takes place
      const userMessage = await dbOperations.createMessage(
        chat.id,
        createdUser.id,
        'user',
        'How do I calibrate the RoboRail machine?'
      )

      const assistantMessage = await dbOperations.createMessage(
        chat.id,
        createdUser.id,
        'assistant',
        'To calibrate the RoboRail machine, follow these steps: 1. Power on the system...',
        'claude-3-5-sonnet',
        'The user is asking about calibration procedures...',
        'high',
        { temperature: 0.7, tokens: 1250 }
      )

      // Then: Messages should be stored correctly
      expect(userMessage.role).toBe('user')
      expect(userMessage.content).toContain('calibrate')
      expect(userMessage.model).toBeUndefined()

      expect(assistantMessage.role).toBe('assistant')
      expect(assistantMessage.model).toBe('claude-3-5-sonnet')
      expect(assistantMessage.reasoning).toContain('calibration')
      expect(assistantMessage.reasoningEffort).toBe('high')
      expect(assistantMessage.metadata).toEqual({ temperature: 0.7, tokens: 1250 })

      // And: Messages should be retrievable in order
      const chatMessages = await dbOperations.getChatMessages(chat.id)
      expect(chatMessages).toHaveLength(2)
      expect(chatMessages[0].id).toBe(userMessage.id)
      expect(chatMessages[1].id).toBe(assistantMessage.id)
    })

    test('should handle message storage with complex parts structure', async () => {
      // Given: User and chat setup
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      const chat = await dbOperations.createChat(createdUser.id, 'Complex Response Test')

      // When: Message with complex parts is created
      const messageParts = [
        { type: 'text', content: 'Here are the troubleshooting steps:' },
        { type: 'code', content: 'ERROR_CODE_001: Calibration failure', language: 'text' },
        { type: 'text', content: 'This indicates a sensor alignment issue.' }
      ]

      const messageData = DatabaseFactories.createMessage(chat.id, createdUser.id, 'assistant', {
        overrides: {
          content: 'Complete troubleshooting response',
          parts: messageParts,
          model: 'gpt-4o'
        }
      })

      const [createdMessage] = await db.insert(messages).values(messageData).returning()

      // Then: Parts should be stored and retrievable
      expect(createdMessage.parts).toHaveLength(3)
      expect(createdMessage.parts?.[0]).toEqual({
        type: 'text', 
        content: 'Here are the troubleshooting steps:'
      })
      expect(createdMessage.parts?.[1]).toEqual({
        type: 'code', 
        content: 'ERROR_CODE_001: Calibration failure',
        language: 'text'
      })
    })

    test('should track message counts and rate limiting', async () => {
      // Given: A user
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      // When: Message counts are incremented
      await dbOperations.incrementMessageCount(createdUser.id, false) // Regular message
      await dbOperations.incrementMessageCount(createdUser.id, false) // Regular message
      await dbOperations.incrementMessageCount(createdUser.id, true)  // Pro message

      // Then: Counts should be updated correctly
      const messageCounts = await dbOperations.getUserMessageCounts(createdUser.id)
      expect(messageCounts.dailyMessageCount).toBe(2)
      expect(messageCounts.dailyProMessageCount).toBe(1)
    })
  })

  describe('API Key Encryption and Management', () => {
    test('should handle complete API key lifecycle with encryption', async () => {
      // Given: A user and API key data
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      
      const plainApiKey = 'sk-test123456789abcdefghijklmnopqrstuvwxyz'
      const provider = 'openai'

      // When: API key is encrypted and stored
      const encryptedData = encryptApiKey(plainApiKey, createdUser.id)
      await dbOperations.upsertApiKey(createdUser.id, provider, encryptedData.encrypted)

      // Then: API key should be retrievable and decryptable
      const storedKey = await dbOperations.getApiKey(createdUser.id, provider)
      expect(storedKey).toBeDefined()
      expect(storedKey?.provider).toBe(provider)
      expect(storedKey?.isActive).toBe(true)

      // And: Encrypted key should decrypt to original value
      const decryptedKey = decryptApiKey(
        storedKey!.encryptedKey,
        encryptedData.iv,
        encryptedData.authTag,
        createdUser.id
      )
      expect(decryptedKey).toBe(plainApiKey)
    })

    test('should handle API key updates (upsert behavior)', async () => {
      // Given: User with existing API key
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      const originalKey = 'sk-original123456789'
      const updatedKey = 'sk-updated987654321'
      const provider = 'anthropic'

      // When: API key is created and then updated
      const originalEncrypted = encryptApiKey(originalKey, createdUser.id)
      await dbOperations.upsertApiKey(createdUser.id, provider, originalEncrypted.encrypted)

      const updatedEncrypted = encryptApiKey(updatedKey, createdUser.id)
      await dbOperations.upsertApiKey(createdUser.id, provider, updatedEncrypted.encrypted)

      // Then: Only one key should exist with updated value
      const userKeys = await dbOperations.getUserApiKeys(createdUser.id)
      expect(userKeys).toHaveLength(1)
      expect(userKeys[0].provider).toBe(provider)

      const storedKey = await dbOperations.getApiKey(createdUser.id, provider)
      const decryptedKey = decryptApiKey(
        storedKey!.encryptedKey,
        updatedEncrypted.iv,
        updatedEncrypted.authTag,
        createdUser.id
      )
      expect(decryptedKey).toBe(updatedKey)
    })

    test('should manage multiple API keys per user', async () => {
      // Given: User with multiple provider keys
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      const apiKeys = [
        { provider: 'openai', key: 'sk-openai123456789' },
        { provider: 'anthropic', key: 'sk-ant-anthropic123456' },
        { provider: 'google', key: 'google-api-key-123456789' }
      ]

      // When: Multiple keys are stored
      for (const { provider, key } of apiKeys) {
        const encrypted = encryptApiKey(key, createdUser.id)
        await dbOperations.upsertApiKey(createdUser.id, provider, encrypted.encrypted)
      }

      // Then: All keys should be retrievable
      const userKeys = await dbOperations.getUserApiKeys(createdUser.id)
      expect(userKeys).toHaveLength(3)

      const providers = userKeys.map(k => k.provider).sort()
      expect(providers).toEqual(['anthropic', 'google', 'openai'])
    })

    test('should update last used timestamp when key is accessed', async () => {
      // Given: User with API key
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()

      const apiKey = 'sk-test123456789'
      const provider = 'openai'
      const encrypted = encryptApiKey(apiKey, createdUser.id)
      await dbOperations.upsertApiKey(createdUser.id, provider, encrypted.encrypted)

      // When: Key is accessed
      const key1 = await dbOperations.getApiKey(createdUser.id, provider)
      expect(key1?.lastUsedAt).toBeNull()

      await new Promise(resolve => setTimeout(resolve, 10))
      const key2 = await dbOperations.getApiKey(createdUser.id, provider)

      // Then: Last used timestamp should be updated
      expect(key2?.lastUsedAt).toBeDefined()
      expect(key2?.lastUsedAt).not.toBeNull()
    })
  })

  describe('Rate Limiting Operations', () => {
    test('should handle daily limit reset functionality', async () => {
      // Given: Users with various message counts
      const users = [
        DatabaseFactories.createUser({ overrides: { dailyMessageCount: 50 } }),
        DatabaseFactories.createUser({ overrides: { dailyMessageCount: 25, dailyProMessageCount: 10 } }),
        DatabaseFactories.createUser({ overrides: { dailyProMessageCount: 5 } })
      ]

      const db = testDb.getDb()
      const createdUsers = await Promise.all(
        users.map(user => db.insert(users).values(user).returning().then(result => result[0]))
      )

      // When: Daily limits are reset
      await dbOperations.resetDailyLimits()

      // Then: All users should have reset counts
      for (const user of createdUsers) {
        const counts = await dbOperations.getUserMessageCounts(user.id)
        expect(counts.dailyMessageCount).toBe(0)
        expect(counts.dailyProMessageCount).toBe(0)
      }
    })

    test('should clean up inactive guest users', async () => {
      // Given: Mix of active and inactive users
      const now = new Date()
      const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000) // 35 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago

      const testUsers = [
        DatabaseFactories.createGuestUser({ overrides: { lastActiveAt: oldDate } }),     // Should be deleted
        DatabaseFactories.createGuestUser({ overrides: { lastActiveAt: recentDate } }),  // Should remain
        DatabaseFactories.createUser({ overrides: { lastActiveAt: oldDate, anonymous: false } }), // Should remain (not guest)
        DatabaseFactories.createGuestUser({ overrides: { lastActiveAt: recentDate } })   // Should remain
      ]

      const db = testDb.getDb()
      await Promise.all(testUsers.map(user => db.insert(users).values(user)))

      // When: Cleanup is performed (30 day threshold)
      await dbOperations.cleanupInactiveGuestUsers(30)

      // Then: Only appropriate users should remain
      const remainingUsers = await db.select().from(users)
      expect(remainingUsers).toHaveLength(3) // 1 deleted, 3 remaining
      
      const guestUsers = remainingUsers.filter(u => u.anonymous)
      expect(guestUsers).toHaveLength(2) // 2 active guests remaining
      
      const regularUsers = remainingUsers.filter(u => !u.anonymous)
      expect(regularUsers).toHaveLength(1) // 1 regular user remaining
    })
  })

  describe('Message Feedback System', () => {
    test('should handle message feedback lifecycle', async () => {
      // Given: User, chat, and message exist
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      const chat = await dbOperations.createChat(createdUser.id, 'Feedback Test')
      const message = await dbOperations.createMessage(
        chat.id,
        createdUser.id,
        'assistant',
        'This is a helpful response about RoboRail troubleshooting.',
        'claude-3-5-sonnet'
      )

      // When: Feedback is provided
      await dbOperations.addMessageFeedback(
        message.id,
        createdUser.id,
        'positive',
        'Very helpful explanation!',
        5
      )

      // Then: Feedback should be stored correctly
      const storedFeedback = await db.query.messageFeedback.findFirst({
        where: eq(db.query.messageFeedback.messageId, message.id)
      })

      expect(storedFeedback).toBeDefined()
      expect(storedFeedback?.feedbackType).toBe('positive')
      expect(storedFeedback?.comment).toBe('Very helpful explanation!')
      expect(storedFeedback?.rating).toBe(5)
      expect(storedFeedback?.messageId).toBe(message.id)
      expect(storedFeedback?.userId).toBe(createdUser.id)
    })

    test('should handle negative feedback without rating', async () => {
      // Given: Message setup
      const user = DatabaseFactories.createUser()
      const db = testDb.getDb()
      const [createdUser] = await db.insert(users).values(user).returning()
      const chat = await dbOperations.createChat(createdUser.id, 'Negative Feedback Test')
      const message = await dbOperations.createMessage(
        chat.id,
        createdUser.id,
        'assistant',
        'This response might not be accurate.'
      )

      // When: Negative feedback is provided without rating
      await dbOperations.addMessageFeedback(
        message.id,
        createdUser.id,
        'negative',
        'Information seems outdated'
      )

      // Then: Feedback should be stored correctly
      const storedFeedback = await db.query.messageFeedback.findFirst({
        where: eq(db.query.messageFeedback.messageId, message.id)
      })

      expect(storedFeedback?.feedbackType).toBe('negative')
      expect(storedFeedback?.comment).toBe('Information seems outdated')
      expect(storedFeedback?.rating).toBeNull()
    })
  })
})