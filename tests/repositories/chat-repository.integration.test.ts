import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabase, TestDatabaseManager } from '../utils/test-database'
import DatabaseFactories from '../factories/database-factories'
import { eq, and, desc, asc, sql, count } from 'drizzle-orm'
import { users, projects, chats, messages } from '../../lib/db/schema'
import type { NewUser, NewChat, NewProject } from '../../lib/db/schema'

/**
 * Chat Repository Integration Tests
 * Tests chat-related database operations with Drizzle ORM
 */

describe('Chat Repository Integration Tests', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof testDb.getDb>

  beforeAll(async () => {
    testDb = await TestDatabaseManager.createInstance('chat-repository-tests')
    db = testDb.getDb()
  })

  afterAll(async () => {
    await TestDatabaseManager.destroyInstance('chat-repository-tests')
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  describe('Chat CRUD Operations', () => {
    test('should create chat with all fields', async () => {
      // Given: User exists
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id, {
        overrides: {
          title: 'RoboRail Plasma Cutting Troubleshooting',
          systemPrompt: 'You are an expert in plasma cutting systems.',
          model: 'claude-3-5-sonnet',
          public: false
        }
      })

      // When: Chat is created
      const [createdChat] = await db.insert(chats).values(chatData).returning()

      // Then: Chat should be created with all properties
      expect(createdChat).toBeDefined()
      expect(createdChat.id).toBeDefined()
      expect(createdChat.title).toBe('RoboRail Plasma Cutting Troubleshooting')
      expect(createdChat.systemPrompt).toBe('You are an expert in plasma cutting systems.')
      expect(createdChat.model).toBe('claude-3-5-sonnet')
      expect(createdChat.public).toBe(false)
      expect(createdChat.userId).toBe(user.id)
      expect(createdChat.createdAt).toBeDefined()
      expect(createdChat.updatedAt).toBeDefined()
    })

    test('should create chat with project association', async () => {
      // Given: User and project exist
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const projectData = DatabaseFactories.createProject(user.id, {
        overrides: {
          name: 'RoboRail Maintenance Project',
          description: 'Ongoing maintenance and troubleshooting'
        }
      })
      const [project] = await db.insert(projects).values(projectData).returning()

      const chatData = DatabaseFactories.createChat(user.id, {
        overrides: {
          projectId: project.id,
          title: 'Weekly Maintenance Chat'
        }
      })

      // When: Chat is created with project
      const [createdChat] = await db.insert(chats).values(chatData).returning()

      // Then: Chat should be associated with project
      expect(createdChat.projectId).toBe(project.id)
      expect(createdChat.userId).toBe(user.id)
      expect(createdChat.title).toBe('Weekly Maintenance Chat')
    })

    test('should read chat by ID with relations', async () => {
      // Given: Chat exists with project
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const projectData = DatabaseFactories.createProject(user.id)
      const [project] = await db.insert(projects).values(projectData).returning()

      const chatData = DatabaseFactories.createChat(user.id, {
        relations: { projectId: project.id }
      })
      const [createdChat] = await db.insert(chats).values(chatData).returning()

      // When: Chat is queried with relations
      const chatWithRelations = await db
        .select({
          chatId: chats.id,
          chatTitle: chats.title,
          chatModel: chats.model,
          userName: users.displayName,
          userEmail: users.email,
          projectName: projects.name,
          projectDescription: projects.description
        })
        .from(chats)
        .leftJoin(users, eq(chats.userId, users.id))
        .leftJoin(projects, eq(chats.projectId, projects.id))
        .where(eq(chats.id, createdChat.id))

      // Then: Chat with relations should be returned
      expect(chatWithRelations).toHaveLength(1)
      const result = chatWithRelations[0]
      expect(result.chatId).toBe(createdChat.id)
      expect(result.userName).toBe(user.displayName)
      expect(result.projectName).toBe(project.name)
    })

    test('should update chat properties', async () => {
      // Given: Chat exists
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [createdChat] = await db.insert(chats).values(chatData).returning()

      // When: Chat is updated
      const updateData = {
        title: 'Updated Chat Title',
        systemPrompt: 'Updated system prompt for better responses',
        model: 'gpt-4o',
        public: true,
        updatedAt: new Date()
      }

      const [updatedChat] = await db
        .update(chats)
        .set(updateData)
        .where(eq(chats.id, createdChat.id))
        .returning()

      // Then: Chat should be updated correctly
      expect(updatedChat.title).toBe('Updated Chat Title')
      expect(updatedChat.systemPrompt).toBe('Updated system prompt for better responses')
      expect(updatedChat.model).toBe('gpt-4o')
      expect(updatedChat.public).toBe(true)
      expect(updatedChat.updatedAt).not.toEqual(createdChat.updatedAt)
    })

    test('should delete chat and cascade messages', async () => {
      // Given: Chat with messages
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatData = DatabaseFactories.createChat(user.id)
      const [createdChat] = await db.insert(chats).values(chatData).returning()

      const messagesData = DatabaseFactories.createBatchMessages(createdChat.id, user.id, 3)
      await db.insert(messages).values(messagesData)

      // When: Chat is deleted
      await db.delete(chats).where(eq(chats.id, createdChat.id))

      // Then: Chat and messages should be deleted
      const [foundChat] = await db
        .select()
        .from(chats)
        .where(eq(chats.id, createdChat.id))
      expect(foundChat).toBeUndefined()

      const foundMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, createdChat.id))
      expect(foundMessages).toHaveLength(0)
    })
  })

  describe('Chat Queries and Filtering', () => {
    test('should query chats by user', async () => {
      // Given: Multiple users with chats
      const user1Data = DatabaseFactories.createUser()
      const user2Data = DatabaseFactories.createUser()
      const [user1] = await db.insert(users).values(user1Data).returning()
      const [user2] = await db.insert(users).values(user2Data).returning()

      const user1Chats = [
        DatabaseFactories.createChat(user1.id, { overrides: { title: 'User1 Chat 1' } }),
        DatabaseFactories.createChat(user1.id, { overrides: { title: 'User1 Chat 2' } })
      ]
      const user2Chats = [
        DatabaseFactories.createChat(user2.id, { overrides: { title: 'User2 Chat 1' } })
      ]

      await db.insert(chats).values([...user1Chats, ...user2Chats])

      // When: Querying chats by user
      const user1ChatResults = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user1.id))
        .orderBy(asc(chats.title))

      const user2ChatResults = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user2.id))

      // Then: Correct chats should be returned
      expect(user1ChatResults).toHaveLength(2)
      expect(user2ChatResults).toHaveLength(1)
      
      expect(user1ChatResults[0].title).toBe('User1 Chat 1')
      expect(user1ChatResults[1].title).toBe('User1 Chat 2')
      expect(user2ChatResults[0].title).toBe('User2 Chat 1')
    })

    test('should filter public vs private chats', async () => {
      // Given: Mix of public and private chats
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = [
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Public Chat 1', public: true } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Public Chat 2', public: true } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Private Chat 1', public: false } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Private Chat 2', public: false } })
      ]

      await db.insert(chats).values(chatsData)

      // When: Filtering by visibility
      const publicChats = await db
        .select()
        .from(chats)
        .where(eq(chats.public, true))
        .orderBy(asc(chats.title))

      const privateChats = await db
        .select()
        .from(chats)
        .where(eq(chats.public, false))
        .orderBy(asc(chats.title))

      // Then: Correct counts should be returned
      expect(publicChats).toHaveLength(2)
      expect(privateChats).toHaveLength(2)
      
      publicChats.forEach(chat => expect(chat.public).toBe(true))
      privateChats.forEach(chat => expect(chat.public).toBe(false))
    })

    test('should query chats by project', async () => {
      // Given: Project with multiple chats
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const projectData = DatabaseFactories.createProject(user.id, {
        overrides: { name: 'Maintenance Project' }
      })
      const [project] = await db.insert(projects).values(projectData).returning()

      const projectChats = [
        DatabaseFactories.createChat(user.id, { 
          overrides: { title: 'Daily Maintenance', projectId: project.id }
        }),
        DatabaseFactories.createChat(user.id, { 
          overrides: { title: 'Emergency Repairs', projectId: project.id }
        })
      ]
      const standaloneChat = DatabaseFactories.createChat(user.id, {
        overrides: { title: 'Standalone Chat', projectId: null }
      })

      await db.insert(chats).values([...projectChats, standaloneChat])

      // When: Querying chats by project
      const projectChatResults = await db
        .select()
        .from(chats)
        .where(eq(chats.projectId, project.id))

      const standaloneChatResults = await db
        .select()
        .from(chats)
        .where(sql`${chats.projectId} IS NULL`)

      // Then: Correct chats should be returned
      expect(projectChatResults).toHaveLength(2)
      expect(standaloneChatResults).toHaveLength(1)
      
      projectChatResults.forEach(chat => expect(chat.projectId).toBe(project.id))
      expect(standaloneChatResults[0].projectId).toBeNull()
    })

    test('should search chats by title', async () => {
      // Given: Chats with various titles
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = [
        DatabaseFactories.createChat(user.id, { overrides: { title: 'RoboRail Calibration Help' } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Plasma Cutting Issues' } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'General RoboRail Questions' } }),
        DatabaseFactories.createChat(user.id, { overrides: { title: 'Software Installation' } })
      ]

      await db.insert(chats).values(chatsData)

      // When: Searching for RoboRail chats
      const roborailChats = await db
        .select()
        .from(chats)
        .where(sql`${chats.title} ILIKE '%RoboRail%'`)

      // Then: Only RoboRail-related chats should be returned
      expect(roborailChats).toHaveLength(2)
      roborailChats.forEach(chat => {
        expect(chat.title?.toLowerCase()).toContain('roborail')
      })
    })
  })

  describe('Chat Sorting and Pagination', () => {
    test('should sort chats by update time', async () => {
      // Given: Chats with different update times
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const now = new Date()
      const chatsData = [
        DatabaseFactories.createChat(user.id, {
          overrides: { 
            title: 'Oldest Chat',
            createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
          }
        }),
        DatabaseFactories.createChat(user.id, {
          overrides: { 
            title: 'Newest Chat',
            createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
          }
        }),
        DatabaseFactories.createChat(user.id, {
          overrides: { 
            title: 'Middle Chat',
            createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
          }
        })
      ]

      await db.insert(chats).values(chatsData)

      // When: Querying with different sort orders
      const newestFirst = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user.id))
        .orderBy(desc(chats.updatedAt))

      const oldestFirst = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user.id))
        .orderBy(asc(chats.updatedAt))

      // Then: Sorting should be correct
      expect(newestFirst[0].title).toBe('Newest Chat')
      expect(newestFirst[1].title).toBe('Middle Chat')
      expect(newestFirst[2].title).toBe('Oldest Chat')

      expect(oldestFirst[0].title).toBe('Oldest Chat')
      expect(oldestFirst[1].title).toBe('Middle Chat')
      expect(oldestFirst[2].title).toBe('Newest Chat')
    })

    test('should handle pagination correctly', async () => {
      // Given: Multiple chats
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = DatabaseFactories.createBatchChats(user.id, 10)
      await db.insert(chats).values(chatsData)

      // When: Paginating through chats
      const page1 = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user.id))
        .orderBy(desc(chats.createdAt))
        .limit(3)
        .offset(0)

      const page2 = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user.id))
        .orderBy(desc(chats.createdAt))
        .limit(3)
        .offset(3)

      const page3 = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, user.id))
        .orderBy(desc(chats.createdAt))
        .limit(3)
        .offset(6)

      // Then: Pagination should work correctly
      expect(page1).toHaveLength(3)
      expect(page2).toHaveLength(3)
      expect(page3).toHaveLength(3)

      // Check no overlaps
      const allIds = [...page1, ...page2, ...page3].map(chat => chat.id)
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(9)
    })
  })

  describe('Chat Statistics and Aggregations', () => {
    test('should count messages per chat', async () => {
      // Given: Chats with different message counts
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = DatabaseFactories.createBatchChats(user.id, 3)
      const [chat1, chat2, chat3] = await Promise.all(
        chatsData.map(chatData => 
          db.insert(chats).values(chatData).returning().then(result => result[0])
        )
      )

      // Create different number of messages for each chat
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(chat1.id, user.id, 5))
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(chat2.id, user.id, 3))
      await db.insert(messages).values(DatabaseFactories.createBatchMessages(chat3.id, user.id, 7))

      // When: Counting messages per chat
      const chatMessageCounts = await db
        .select({
          chatId: chats.id,
          chatTitle: chats.title,
          messageCount: count(messages.id)
        })
        .from(chats)
        .leftJoin(messages, eq(chats.id, messages.chatId))
        .where(eq(chats.userId, user.id))
        .groupBy(chats.id, chats.title)
        .orderBy(desc(count(messages.id)))

      // Then: Message counts should be correct
      expect(chatMessageCounts).toHaveLength(3)
      expect(chatMessageCounts[0].messageCount).toBe(7) // chat3
      expect(chatMessageCounts[1].messageCount).toBe(5) // chat1
      expect(chatMessageCounts[2].messageCount).toBe(3) // chat2
    })

    test('should aggregate chat statistics by model', async () => {
      // Given: Chats using different models
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const chatsData = [
        DatabaseFactories.createChat(user.id, { overrides: { model: 'gpt-4o' } }),
        DatabaseFactories.createChat(user.id, { overrides: { model: 'gpt-4o' } }),
        DatabaseFactories.createChat(user.id, { overrides: { model: 'claude-3-5-sonnet' } }),
        DatabaseFactories.createChat(user.id, { overrides: { model: 'claude-3-5-sonnet' } }),
        DatabaseFactories.createChat(user.id, { overrides: { model: 'claude-3-5-sonnet' } }),
        DatabaseFactories.createChat(user.id, { overrides: { model: 'gemini-pro' } })
      ]

      await db.insert(chats).values(chatsData)

      // When: Aggregating by model
      const modelStats = await db
        .select({
          model: chats.model,
          chatCount: count(chats.id),
          publicChats: sql`COUNT(*) FILTER (WHERE ${chats.public} = true)`.mapWith(Number),
          privateChats: sql`COUNT(*) FILTER (WHERE ${chats.public} = false)`.mapWith(Number)
        })
        .from(chats)
        .where(eq(chats.userId, user.id))
        .groupBy(chats.model)
        .orderBy(desc(count(chats.id)))

      // Then: Model statistics should be correct
      expect(modelStats).toHaveLength(3)
      expect(modelStats[0].model).toBe('claude-3-5-sonnet')
      expect(modelStats[0].chatCount).toBe(3)
      expect(modelStats[1].model).toBe('gpt-4o')
      expect(modelStats[1].chatCount).toBe(2)
      expect(modelStats[2].model).toBe('gemini-pro')
      expect(modelStats[2].chatCount).toBe(1)
    })
  })

  describe('Chat with Project Relations', () => {
    test('should handle project deletion with chat cleanup', async () => {
      // Given: Project with associated chats
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const projectData = DatabaseFactories.createProject(user.id)
      const [project] = await db.insert(projects).values(projectData).returning()

      const chatsData = [
        DatabaseFactories.createChat(user.id, { overrides: { projectId: project.id } }),
        DatabaseFactories.createChat(user.id, { overrides: { projectId: project.id } })
      ]
      await db.insert(chats).values(chatsData)

      // When: Project is deleted
      await db.delete(projects).where(eq(projects.id, project.id))

      // Then: Chats should have projectId set to null (cascade behavior)
      const orphanedChats = await db
        .select()
        .from(chats)
        .where(sql`${chats.projectId} IS NULL`)

      expect(orphanedChats).toHaveLength(2)
      orphanedChats.forEach(chat => expect(chat.projectId).toBeNull())
    })

    test('should query chats with project information', async () => {
      // Given: Chats with and without projects
      const userData = DatabaseFactories.createUser()
      const [user] = await db.insert(users).values(userData).returning()

      const projectData = DatabaseFactories.createProject(user.id, {
        overrides: { name: 'Maintenance Project', description: 'Ongoing maintenance tasks' }
      })
      const [project] = await db.insert(projects).values(projectData).returning()

      const chatsData = [
        DatabaseFactories.createChat(user.id, { 
          overrides: { title: 'Project Chat', projectId: project.id }
        }),
        DatabaseFactories.createChat(user.id, { 
          overrides: { title: 'Standalone Chat', projectId: null }
        })
      ]
      await db.insert(chats).values(chatsData)

      // When: Querying chats with project info
      const chatsWithProjects = await db
        .select({
          chatId: chats.id,
          chatTitle: chats.title,
          projectId: projects.id,
          projectName: projects.name,
          projectDescription: projects.description
        })
        .from(chats)
        .leftJoin(projects, eq(chats.projectId, projects.id))
        .where(eq(chats.userId, user.id))
        .orderBy(asc(chats.title))

      // Then: Project information should be included
      expect(chatsWithProjects).toHaveLength(2)
      
      const projectChat = chatsWithProjects.find(c => c.chatTitle === 'Project Chat')
      const standaloneChat = chatsWithProjects.find(c => c.chatTitle === 'Standalone Chat')

      expect(projectChat?.projectName).toBe('Maintenance Project')
      expect(projectChat?.projectDescription).toBe('Ongoing maintenance tasks')
      
      expect(standaloneChat?.projectId).toBeNull()
      expect(standaloneChat?.projectName).toBeNull()
    })
  })
})