import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabase, TestDatabaseManager } from '../utils/test-database'
import DatabaseFactories from '../factories/database-factories'
import { eq, and, desc, asc, sql, count, avg, sum, gte, lte } from 'drizzle-orm'
import { users, chats, messages, messageFeedback } from '../../lib/db/schema'
import type { NewMessage, MessagePart } from '../../lib/db/schema'

/**
 * Message Repository Integration Tests
 * Tests message-related database operations with Drizzle ORM
 */

describe('Message Repository Integration Tests', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof testDb.getDb>

  beforeAll(async () => {
    testDb = await TestDatabaseManager.createInstance('message-repository-tests')
    db = testDb.getDb()
  })

  afterAll(async () => {
    await TestDatabaseManager.destroyInstance('message-repository-tests')
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  describe('Message CRUD Operations', () => {
    test('should create message with all fields', async () => {
      // Given: User and chat exist
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messageParts: MessagePart[] = [
        { type: 'text', content: 'Here is the troubleshooting guide:' },
        { type: 'code', content: 'ERROR_CODE_001', language: 'text' },
        { type: 'text', content: 'This indicates a calibration issue.' }
      ]

      const messageData = DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
        overrides: {
          content: 'Complete RoboRail troubleshooting response',
          parts: messageParts,
          model: 'claude-3-5-sonnet',
          reasoning: 'The user is experiencing calibration issues based on the error code.',
          reasoningEffort: 'high',
          langsmithRunId: 'run_12345',
          metadata: {
            temperature: 0.7,
            tokens: 1250,
            processingTime: 2300,
            sourceDocuments: ['operator-manual', 'faq-calibration']
          }
        }
      })

      // When: Message is created
      const [createdMessage] = await db.insert(messages).values(messageData).returning()

      // Then: Message should be created with all properties
      expect(createdMessage).toBeDefined()
      expect(createdMessage.id).toBeDefined()
      expect(createdMessage.content).toBe('Complete RoboRail troubleshooting response')
      expect(createdMessage.role).toBe('assistant')
      expect(createdMessage.model).toBe('claude-3-5-sonnet')
      expect(createdMessage.reasoning).toContain('calibration issues')
      expect(createdMessage.reasoningEffort).toBe('high')
      expect(createdMessage.langsmithRunId).toBe('run_12345')
      
      // Verify parts structure
      expect(createdMessage.parts).toHaveLength(3)
      expect(createdMessage.parts?.[0]).toEqual({ type: 'text', content: 'Here is the troubleshooting guide:' })
      expect(createdMessage.parts?.[1]).toEqual({ type: 'code', content: 'ERROR_CODE_001', language: 'text' })

      // Verify metadata
      expect(createdMessage.metadata).toEqual({
        temperature: 0.7,
        tokens: 1250,
        processingTime: 2300,
        sourceDocuments: ['operator-manual', 'faq-calibration']
      })
    })

    test('should create user message with minimal fields', async () => {
      // Given: User and chat setup
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messageData = DatabaseFactories.createMessage(chat.id, user.id, 'user', {
        overrides: {
          content: 'How do I calibrate the RoboRail machine?',
          model: undefined,
          reasoning: undefined,
          reasoningEffort: undefined,
          langsmithRunId: undefined,
          metadata: undefined
        }
      })

      // When: User message is created
      const [createdMessage] = await db.insert(messages).values(messageData).returning()

      // Then: Message should be created with minimal fields
      expect(createdMessage.role).toBe('user')
      expect(createdMessage.content).toBe('How do I calibrate the RoboRail machine?')
      expect(createdMessage.model).toBeNull()
      expect(createdMessage.reasoning).toBeNull()
      expect(createdMessage.reasoningEffort).toBe('medium') // default value
      expect(createdMessage.langsmithRunId).toBeNull()
      expect(createdMessage.metadata).toBeNull()
    })

    test('should read messages by chat ID in chronological order', async () => {
      // Given: Chat with multiple messages
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const conversationMessages = DatabaseFactories.createConversationFlow(chat.id, user.id, 3)
      await db.insert(messages).values(conversationMessages)

      // When: Messages are retrieved by chat
      const chatMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(asc(messages.createdAt))

      // Then: Messages should be in chronological order
      expect(chatMessages).toHaveLength(6) // 3 turns × 2 messages (user + assistant)
      
      // Verify alternating pattern
      for (let i = 0; i < chatMessages.length; i += 2) {
        expect(chatMessages[i].role).toBe('user')
        expect(chatMessages[i + 1]?.role).toBe('assistant')
      }

      // Verify chronological order
      for (let i = 1; i < chatMessages.length; i++) {
        expect(chatMessages[i].createdAt.getTime())
          .toBeGreaterThanOrEqual(chatMessages[i - 1].createdAt.getTime())
      }
    })

    test('should update message content and metadata', async () => {
      // Given: Existing message
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messageData = DatabaseFactories.createMessage(chat.id, user.id, 'assistant')
      const [createdMessage] = await db.insert(messages).values(messageData).returning()

      // When: Message is updated
      const updateData = {
        content: 'Updated response with more detailed information',
        reasoning: 'Added more context based on user feedback',
        metadata: {
          updated: true,
          version: 2,
          originalTokens: 500,
          updatedTokens: 750
        }
      }

      const [updatedMessage] = await db
        .update(messages)
        .set(updateData)
        .where(eq(messages.id, createdMessage.id))
        .returning()

      // Then: Message should be updated correctly
      expect(updatedMessage.content).toBe('Updated response with more detailed information')
      expect(updatedMessage.reasoning).toBe('Added more context based on user feedback')
      expect(updatedMessage.metadata).toEqual({
        updated: true,
        version: 2,
        originalTokens: 500,
        updatedTokens: 750
      })
    })

    test('should delete message and cascade feedback', async () => {
      // Given: Message with feedback
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messageData = DatabaseFactories.createMessage(chat.id, user.id, 'assistant')
      const [createdMessage] = await db.insert(messages).values(messageData).returning()

      const feedbackData = DatabaseFactories.createMessageFeedback(createdMessage.id, user.id)
      await db.insert(messageFeedback).values(feedbackData)

      // When: Message is deleted
      await db.delete(messages).where(eq(messages.id, createdMessage.id))

      // Then: Message and feedback should be deleted
      const [foundMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, createdMessage.id))
      expect(foundMessage).toBeUndefined()

      const [foundFeedback] = await db
        .select()
        .from(messageFeedback)
        .where(eq(messageFeedback.messageId, createdMessage.id))
      expect(foundFeedback).toBeUndefined()
    })
  })

  describe('Message Queries and Filtering', () => {
    test('should filter messages by role', async () => {
      // Given: Chat with mixed message roles
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { overrides: { content: 'User message 1' } }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { overrides: { content: 'Assistant response 1' } }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { overrides: { content: 'User message 2' } }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { overrides: { content: 'Assistant response 2' } }),
        DatabaseFactories.createMessage(chat.id, user.id, 'system', { overrides: { content: 'System message' } })
      ]
      await db.insert(messages).values(messagesData)

      // When: Filtering by role
      const userMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chat.id), eq(messages.role, 'user')))

      const assistantMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chat.id), eq(messages.role, 'assistant')))

      const systemMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chat.id), eq(messages.role, 'system')))

      // Then: Correct messages should be returned
      expect(userMessages).toHaveLength(2)
      expect(assistantMessages).toHaveLength(2)
      expect(systemMessages).toHaveLength(1)

      userMessages.forEach(msg => expect(msg.role).toBe('user'))
      assistantMessages.forEach(msg => expect(msg.role).toBe('assistant'))
      expect(systemMessages[0].role).toBe('system')
    })

    test('should filter messages by model', async () => {
      // Given: Messages from different AI models
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { model: 'gpt-4o', content: 'GPT-4o response' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { model: 'claude-3-5-sonnet', content: 'Claude response 1' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { model: 'claude-3-5-sonnet', content: 'Claude response 2' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { model: 'gemini-pro', content: 'Gemini response' } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Filtering by model
      const claudeMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chat.id), eq(messages.model, 'claude-3-5-sonnet')))

      const gptMessages = await db
        .select()
        .from(messages)
        .where(and(eq(messages.chatId, chat.id), eq(messages.model, 'gpt-4o')))

      // Then: Correct model messages should be returned
      expect(claudeMessages).toHaveLength(2)
      expect(gptMessages).toHaveLength(1)
      
      claudeMessages.forEach(msg => expect(msg.model).toBe('claude-3-5-sonnet'))
      expect(gptMessages[0].model).toBe('gpt-4o')
    })

    test('should filter messages by reasoning effort', async () => {
      // Given: Messages with different reasoning efforts
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { reasoningEffort: 'low' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { reasoningEffort: 'medium' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { reasoningEffort: 'high' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { reasoningEffort: 'high' } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Filtering by reasoning effort
      const highEffortMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id), 
          eq(messages.reasoningEffort, 'high')
        ))

      const mediumEffortMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id), 
          eq(messages.reasoningEffort, 'medium')
        ))

      // Then: Correct effort messages should be returned
      expect(highEffortMessages).toHaveLength(2)
      expect(mediumEffortMessages).toHaveLength(1)
      
      highEffortMessages.forEach(msg => expect(msg.reasoningEffort).toBe('high'))
    })

    test('should search messages by content', async () => {
      // Given: Messages with various content
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'How to calibrate RoboRail machine?' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { content: 'RoboRail calibration requires following specific steps...' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'What about plasma cutting issues?' } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
          overrides: { content: 'Plasma cutting problems usually involve temperature settings...' } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Searching for calibration-related messages
      const calibrationMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`${messages.content} ILIKE '%calibrat%'`
        ))

      const plasmaMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`${messages.content} ILIKE '%plasma%'`
        ))

      // Then: Relevant messages should be found
      expect(calibrationMessages).toHaveLength(2)
      expect(plasmaMessages).toHaveLength(2)
      
      calibrationMessages.forEach(msg => {
        expect(msg.content.toLowerCase()).toContain('calibrat')
      })
    })
  })

  describe('Message Date and Time Queries', () => {
    test('should filter messages by date range', async () => {
      // Given: Messages created at different times
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'Recent message', createdAt: now } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'Yesterday message', createdAt: yesterday } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'Old message', createdAt: lastWeek } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Filtering by date range
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      const recentMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          gte(messages.createdAt, twoDaysAgo)
        ))

      const oldMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          lte(messages.createdAt, twoDaysAgo)
        ))

      // Then: Messages should be filtered by date
      expect(recentMessages).toHaveLength(2)
      expect(oldMessages).toHaveLength(1)
      expect(oldMessages[0].content).toBe('Old message')
    })

    test('should get messages from specific time periods', async () => {
      // Given: Messages spread across different months
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const thisMonth = new Date()
      const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 15)
      const twoMonthsAgo = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 2, 15)

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'This month', createdAt: thisMonth } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'Last month', createdAt: lastMonth } 
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'user', { 
          overrides: { content: 'Two months ago', createdAt: twoMonthsAgo } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Getting messages from last 30 days
      const thirtyDaysAgo = new Date(thisMonth.getTime() - 30 * 24 * 60 * 60 * 1000)
      const recentMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          gte(messages.createdAt, thirtyDaysAgo)
        ))
        .orderBy(desc(messages.createdAt))

      // Then: Only recent messages should be returned
      expect(recentMessages.length).toBeGreaterThanOrEqual(1)
      recentMessages.forEach(msg => {
        expect(msg.createdAt.getTime()).toBeGreaterThanOrEqual(thirtyDaysAgo.getTime())
      })
    })
  })

  describe('Message Statistics and Aggregations', () => {
    test('should count messages by role and model', async () => {
      // Given: Chat with various messages
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        ...DatabaseFactories.createBatchMessages(chat.id, user.id, 10), // 5 user + 5 assistant
        DatabaseFactories.createMessage(chat.id, user.id, 'system', { 
          overrides: { content: 'System message' } 
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Counting by role
      const roleStats = await db
        .select({
          role: messages.role,
          messageCount: count(messages.id)
        })
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .groupBy(messages.role)
        .orderBy(desc(count(messages.id)))

      // Then: Role statistics should be correct
      expect(roleStats).toHaveLength(3)
      
      const userStat = roleStats.find(s => s.role === 'user')
      const assistantStat = roleStats.find(s => s.role === 'assistant')
      const systemStat = roleStats.find(s => s.role === 'system')

      expect(userStat?.messageCount).toBe(5)
      expect(assistantStat?.messageCount).toBe(5)
      expect(systemStat?.messageCount).toBe(1)
    })

    test('should calculate token usage statistics', async () => {
      // Given: Messages with token metadata
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: { 
            model: 'gpt-4o',
            metadata: { tokens: 500, inputTokens: 100, outputTokens: 400 }
          }
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: { 
            model: 'gpt-4o',
            metadata: { tokens: 750, inputTokens: 150, outputTokens: 600 }
          }
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: { 
            model: 'claude-3-5-sonnet',
            metadata: { tokens: 1200, inputTokens: 200, outputTokens: 1000 }
          }
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Calculating token statistics
      const tokenStats = await db
        .select({
          model: messages.model,
          messageCount: count(messages.id),
          avgTokens: sql`AVG((metadata->>'tokens')::integer)`.mapWith(Number),
          totalTokens: sql`SUM((metadata->>'tokens')::integer)`.mapWith(Number),
          maxTokens: sql`MAX((metadata->>'tokens')::integer)`.mapWith(Number)
        })
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`metadata->>'tokens' IS NOT NULL`
        ))
        .groupBy(messages.model)

      // Then: Token statistics should be calculated correctly
      expect(tokenStats).toHaveLength(2)
      
      const gptStats = tokenStats.find(s => s.model === 'gpt-4o')
      const claudeStats = tokenStats.find(s => s.model === 'claude-3-5-sonnet')

      expect(gptStats?.messageCount).toBe(2)
      expect(gptStats?.totalTokens).toBe(1250) // 500 + 750
      expect(gptStats?.avgTokens).toBe(625) // 1250 / 2
      expect(gptStats?.maxTokens).toBe(750)

      expect(claudeStats?.messageCount).toBe(1)
      expect(claudeStats?.totalTokens).toBe(1200)
    })

    test('should aggregate reasoning effort distribution', async () => {
      // Given: Messages with different reasoning efforts
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        ...Array(3).fill(null).map(() => 
          DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
            overrides: { reasoningEffort: 'low' } 
          })
        ),
        ...Array(5).fill(null).map(() => 
          DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
            overrides: { reasoningEffort: 'medium' } 
          })
        ),
        ...Array(2).fill(null).map(() => 
          DatabaseFactories.createMessage(chat.id, user.id, 'assistant', { 
            overrides: { reasoningEffort: 'high' } 
          })
        )
      ]
      await db.insert(messages).values(messagesData)

      // When: Aggregating reasoning effort
      const effortStats = await db
        .select({
          reasoningEffort: messages.reasoningEffort,
          count: count(messages.id),
          percentage: sql`ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2)`.mapWith(Number)
        })
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          eq(messages.role, 'assistant')
        ))
        .groupBy(messages.reasoningEffort)
        .orderBy(desc(count(messages.id)))

      // Then: Effort distribution should be calculated
      expect(effortStats).toHaveLength(3)
      
      const mediumEffort = effortStats.find(s => s.reasoningEffort === 'medium')
      const lowEffort = effortStats.find(s => s.reasoningEffort === 'low')
      const highEffort = effortStats.find(s => s.reasoningEffort === 'high')

      expect(mediumEffort?.count).toBe(5)
      expect(lowEffort?.count).toBe(3)
      expect(highEffort?.count).toBe(2)

      // Verify percentages add up to 100
      const totalPercentage = effortStats.reduce((sum, stat) => sum + stat.percentage, 0)
      expect(totalPercentage).toBeCloseTo(100, 1)
    })
  })

  describe('Message Complex Queries', () => {
    test('should find messages with specific metadata patterns', async () => {
      // Given: Messages with various metadata
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: {
            metadata: { 
              sourceDocuments: ['operator-manual', 'faq-calibration'],
              confidence: 0.95,
              category: 'technical-support'
            }
          }
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: {
            metadata: { 
              sourceDocuments: ['faq-measurement'],
              confidence: 0.87,
              category: 'general-inquiry'
            }
          }
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: {
            metadata: { 
              sourceDocuments: ['operator-manual'],
              confidence: 0.92,
              category: 'technical-support'
            }
          }
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Finding messages with high confidence technical support
      const highConfidenceTech = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`(metadata->>'confidence')::float > 0.9`,
          sql`metadata->>'category' = 'technical-support'`
        ))

      // When: Finding messages that reference operator manual
      const operatorManualMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`metadata->'sourceDocuments' @> '["operator-manual"]'::jsonb`
        ))

      // Then: Correct messages should be found
      expect(highConfidenceTech).toHaveLength(2)
      expect(operatorManualMessages).toHaveLength(2)

      highConfidenceTech.forEach(msg => {
        expect(msg.metadata?.confidence).toBeGreaterThan(0.9)
        expect(msg.metadata?.category).toBe('technical-support')
      })
    })

    test('should perform full-text search on message parts', async () => {
      // Given: Messages with complex parts structure
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const messagesData = [
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: {
            content: 'RoboRail troubleshooting guide',
            parts: [
              { type: 'text', content: 'For RoboRail calibration issues' },
              { type: 'code', content: 'ERROR_CALIBRATION_FAILED', language: 'text' },
              { type: 'text', content: 'Check sensor alignment' }
            ]
          }
        }),
        DatabaseFactories.createMessage(chat.id, user.id, 'assistant', {
          overrides: {
            content: 'Plasma cutting parameters',
            parts: [
              { type: 'text', content: 'Plasma cutting temperature settings' },
              { type: 'table', content: 'Material | Temperature | Speed', format: 'csv' }
            ]
          }
        })
      ]
      await db.insert(messages).values(messagesData)

      // When: Searching within parts content
      const calibrationMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`parts::text ILIKE '%calibration%'`
        ))

      const plasmaMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.chatId, chat.id),
          sql`parts::text ILIKE '%plasma%'`
        ))

      // Then: Messages should be found based on parts content
      expect(calibrationMessages).toHaveLength(1)
      expect(plasmaMessages).toHaveLength(1)
      
      expect(calibrationMessages[0].content).toContain('troubleshooting')
      expect(plasmaMessages[0].content).toContain('parameters')
    })
  })

  describe('Message Pagination and Performance', () => {
    test('should handle large message sets with pagination', async () => {
      // Given: Large number of messages
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [chat] = await db.insert(chats).values(chatData).returning()

      const largeMessageSet = DatabaseFactories.createBatchMessages(chat.id, user.id, 100)
      await db.insert(messages).values(largeMessageSet)

      // When: Paginating through messages
      const pageSize = 10
      const page1 = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(desc(messages.createdAt))
        .limit(pageSize)
        .offset(0)

      const page2 = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chat.id))
        .orderBy(desc(messages.createdAt))
        .limit(pageSize)
        .offset(pageSize)

      // Then: Pagination should work correctly
      expect(page1).toHaveLength(pageSize)
      expect(page2).toHaveLength(pageSize)

      // Check no duplicates between pages
      const page1Ids = page1.map(m => m.id)
      const page2Ids = page2.map(m => m.id)
      const overlap = page1Ids.filter(id => page2Ids.includes(id))
      expect(overlap).toHaveLength(0)

      // Verify chronological order within pages
      for (let i = 1; i < page1.length; i++) {
        expect(page1[i].createdAt.getTime())
          .toBeLessThanOrEqual(page1[i - 1].createdAt.getTime())
      }
    })

    test('should efficiently count total messages', async () => {
      // Given: Multiple chats with different message counts
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = DatabaseFactories.createBatchChats(user.id, 3)
      const createdChats = await Promise.all(
        chatsData.map(chatData => 
          db.insert(chats).values(chatData).returning().then(result => result[0])
        )
      )

      // Create different numbers of messages per chat
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(createdChats[0].id, user.id, 15))
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(createdChats[1].id, user.id, 25))
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(createdChats[2].id, user.id, 35))

      // When: Counting messages efficiently
      const totalCount = await db
        .select({ count: count(messages.id) })
        .from(messages)
        .where(eq(messages.userId, user.id))

      const chatCounts = await db
        .select({
          chatId: messages.chatId,
          messageCount: count(messages.id)
        })
        .from(messages)
        .where(eq(messages.userId, user.id))
        .groupBy(messages.chatId)

      // Then: Counts should be accurate
      expect(totalCount[0].count).toBe(75) // 15 + 25 + 35
      expect(chatCounts).toHaveLength(3)
      
      const counts = chatCounts.map(c => c.messageCount).sort((a, b) => a - b)
      expect(counts).toEqual([15, 25, 35])
    })
  })
})