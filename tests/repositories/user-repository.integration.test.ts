import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { TestDatabase, TestDatabaseManager } from '../utils/test-database'
import DatabaseFactories from '../factories/database-factories'
import { eq, and, gte, lt, desc, asc, sql } from 'drizzle-orm'
import { users, userPreferences, userRetrievalSettings } from '../../lib/db/schema'
import type { NewUser, User } from '../../lib/db/schema'

/**
 * User Repository Integration Tests
 * Tests direct database operations with Drizzle ORM
 */

describe('User Repository Integration Tests', () => {
  let testDb: TestDatabase
  let db: ReturnType<typeof testDb.getDb>

  beforeAll(async () => {
    testDb = await TestDatabaseManager.createInstance('user-repository-tests')
    db = testDb.getDb()
  })

  afterAll(async () => {
    await TestDatabaseManager.destroyInstance('user-repository-tests')
  })

  beforeEach(async () => {
    await testDb.reset()
  })

  describe('User CRUD Operations', () => {
    test('should create user with all fields', async () => {
      // Given: Complete user data
      const userData = DatabaseFactories.createUser({
        overrides: {
          email: 'integration@roborail.com',
          displayName: 'Integration Test User',
          systemPrompt: 'Custom system prompt for testing',
          themeMode: 'dark',
          favoriteModels: ['gpt-4o', 'claude-3-5-sonnet']
        }
      })

      // When: User is inserted
      const [createdUser] = await db.insert(users).values(userData).returning()

      // Then: User should be created with all properties
      expect(createdUser).toBeDefined()
      expect(createdUser.id).toBeDefined()
      expect(createdUser.email).toBe('integration@roborail.com')
      expect(createdUser.displayName).toBe('Integration Test User')
      expect(createdUser.systemPrompt).toBe('Custom system prompt for testing')
      expect(createdUser.themeMode).toBe('dark')
      expect(createdUser.favoriteModels).toEqual(['gpt-4o', 'claude-3-5-sonnet'])
      expect(createdUser.anonymous).toBe(false)
      expect(createdUser.createdAt).toBeDefined()
      expect(createdUser.updatedAt).toBeDefined()
    })

    test('should create anonymous guest user', async () => {
      // Given: Guest user data
      const guestData = DatabaseFactories.createGuestUser()

      // When: Guest user is inserted
      const [createdGuest] = await db.insert(users).values(guestData).returning()

      // Then: Guest should be created properly
      expect(createdGuest.anonymous).toBe(true)
      expect(createdGuest.email).toBeUndefined()
      expect(createdGuest.displayName).toBeUndefined()
      expect(createdGuest.dailyMessageCount).toBe(0)
      expect(createdGuest.dailyProMessageCount).toBe(0)
    })

    test('should read user by ID', async () => {
      // Given: User exists in database
      const userData = DatabaseFactories.createUser()
      const [createdUser] = await db.insert(users).values(userData).returning()

      // When: User is queried by ID
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, createdUser.id))
        .limit(1)

      // Then: Correct user should be returned
      expect(foundUser).toBeDefined()
      expect(foundUser.id).toBe(createdUser.id)
      expect(foundUser.email).toBe(createdUser.email)
    })

    test('should update user fields', async () => {
      // Given: User exists
      const userData = DatabaseFactories.createUser()
      const [createdUser] = await db.insert(users).values(userData).returning()

      // When: User is updated
      const updateData = {
        displayName: 'Updated Name',
        systemPrompt: 'Updated system prompt',
        themeMode: 'light',
        updatedAt: new Date()
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, createdUser.id))
        .returning()

      // Then: User should be updated correctly
      expect(updatedUser.displayName).toBe('Updated Name')
      expect(updatedUser.systemPrompt).toBe('Updated system prompt')
      expect(updatedUser.themeMode).toBe('light')
      expect(updatedUser.updatedAt).not.toEqual(createdUser.updatedAt)
    })

    test('should delete user and cascade properly', async () => {
      // Given: User with preferences
      const userData = DatabaseFactories.createUser()
      const [createdUser] = await db.insert(users).values(userData).returning()

      const preferencesData = DatabaseFactories.createUserPreferences(createdUser.id)
      await db.insert(userPreferences).values(preferencesData)

      // When: User is deleted
      await db.delete(users).where(eq(users.id, createdUser.id))

      // Then: User and cascaded data should be deleted
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, createdUser.id))
        .limit(1)
      expect(foundUser).toBeUndefined()

      const [foundPreferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, createdUser.id))
        .limit(1)
      expect(foundPreferences).toBeUndefined()
    })
  })

  describe('User Queries and Filtering', () => {
    test('should query users by email', async () => {
      // Given: Multiple users with different emails
      const users1 = DatabaseFactories.createUser({ overrides: { email: 'user1@test.com' } })
      const users2 = DatabaseFactories.createUser({ overrides: { email: 'user2@test.com' } })
      const users3 = DatabaseFactories.createGuestUser() // No email

      await db.insert(users).values([users1, users2, users3])

      // When: Querying by email
      const foundUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, 'user1@test.com'))

      // Then: Only matching user should be returned
      expect(foundUsers).toHaveLength(1)
      expect(foundUsers[0].email).toBe('user1@test.com')
    })

    test('should filter anonymous vs registered users', async () => {
      // Given: Mix of anonymous and registered users
      const registeredUsers = [
        DatabaseFactories.createUser({ overrides: { anonymous: false } }),
        DatabaseFactories.createUser({ overrides: { anonymous: false } })
      ]
      const guestUsers = [
        DatabaseFactories.createGuestUser(),
        DatabaseFactories.createGuestUser()
      ]

      await db.insert(users).values([...registeredUsers, ...guestUsers])

      // When: Filtering by user type
      const registered = await db
        .select()
        .from(users)
        .where(eq(users.anonymous, false))

      const guests = await db
        .select()
        .from(users)
        .where(eq(users.anonymous, true))

      // Then: Correct counts should be returned
      expect(registered).toHaveLength(2)
      expect(guests).toHaveLength(2)
      
      registered.forEach(user => expect(user.anonymous).toBe(false))
      guests.forEach(user => expect(user.anonymous).toBe(true))
    })

    test('should query users by activity date range', async () => {
      // Given: Users with different last active dates
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const activeUser = DatabaseFactories.createUser({ overrides: { lastActiveAt: now } })
      const recentUser = DatabaseFactories.createUser({ overrides: { lastActiveAt: yesterday } })
      const oldUser = DatabaseFactories.createUser({ overrides: { lastActiveAt: lastWeek } })

      await db.insert(users).values([activeUser, recentUser, oldUser])

      // When: Querying active users from last 3 days
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      const activeUsers = await db
        .select()
        .from(users)
        .where(gte(users.lastActiveAt, threeDaysAgo))

      // Then: Only recent users should be returned
      expect(activeUsers).toHaveLength(2)
      activeUsers.forEach(user => {
        expect(user.lastActiveAt!.getTime()).toBeGreaterThanOrEqual(threeDaysAgo.getTime())
      })
    })

    test('should handle sorting and pagination', async () => {
      // Given: Multiple users with different creation dates
      const userCount = 10
      const usersData: NewUser[] = []
      
      for (let i = 0; i < userCount; i++) {
        const user = DatabaseFactories.createUser({
          overrides: {
            displayName: `User ${i.toString().padStart(2, '0')}`,
            createdAt: new Date(Date.now() + i * 1000) // Stagger creation times
          }
        })
        usersData.push(user)
      }

      await db.insert(users).values(usersData)

      // When: Querying with sorting and pagination
      const page1 = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(3)
        .offset(0)

      const page2 = await db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(3)
        .offset(3)

      // Then: Results should be properly sorted and paginated
      expect(page1).toHaveLength(3)
      expect(page2).toHaveLength(3)
      
      // Check descending order
      for (let i = 1; i < page1.length; i++) {
        expect(page1[i].createdAt.getTime()).toBeLessThanOrEqual(page1[i-1].createdAt.getTime())
      }
      
      // Check no overlap between pages
      const page1Names = page1.map(u => u.displayName)
      const page2Names = page2.map(u => u.displayName)
      const overlap = page1Names.filter(name => page2Names.includes(name))
      expect(overlap).toHaveLength(0)
    })
  })

  describe('User Message Count Operations', () => {
    test('should update daily message counts atomically', async () => {
      // Given: User with initial counts
      const userData = DatabaseFactories.createUser({
        overrides: {
          dailyMessageCount: 5,
          dailyProMessageCount: 2
        }
      })
      const [createdUser] = await db.insert(users).values(userData).returning()

      // When: Counts are incremented
      await db
        .update(users)
        .set({
          dailyMessageCount: createdUser.dailyMessageCount + 1,
          dailyProMessageCount: createdUser.dailyProMessageCount + 1
        })
        .where(eq(users.id, createdUser.id))

      // Then: Counts should be updated correctly
      const [updatedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, createdUser.id))

      expect(updatedUser.dailyMessageCount).toBe(6)
      expect(updatedUser.dailyProMessageCount).toBe(3)
    })

    test('should batch reset daily limits', async () => {
      // Given: Multiple users with various counts
      const usersData = [
        DatabaseFactories.createUser({ overrides: { dailyMessageCount: 50, dailyProMessageCount: 10 } }),
        DatabaseFactories.createUser({ overrides: { dailyMessageCount: 25, dailyProMessageCount: 5 } }),
        DatabaseFactories.createUser({ overrides: { dailyMessageCount: 100, dailyProMessageCount: 20 } })
      ]

      const createdUsers = await Promise.all(
        usersData.map(userData => 
          db.insert(users).values(userData).returning().then(result => result[0])
        )
      )

      // When: Daily limits are batch reset
      await db
        .update(users)
        .set({
          dailyMessageCount: 0,
          dailyProMessageCount: 0,
          updatedAt: new Date()
        })

      // Then: All users should have reset counts
      const allUsers = await db.select().from(users)
      
      allUsers.forEach(user => {
        expect(user.dailyMessageCount).toBe(0)
        expect(user.dailyProMessageCount).toBe(0)
      })
    })
  })

  describe('User Preferences Integration', () => {
    test('should create user with preferences in transaction', async () => {
      // Given: User and preferences data
      const userData = DatabaseFactories.createUser()
      const preferencesData = DatabaseFactories.createUserPreferences(userData.id!, {
        overrides: {
          layout: 'compact',
          promptSuggestions: false,
          multiModelEnabled: true
        }
      })

      // When: Creating user and preferences in transaction
      await db.transaction(async (tx) => {
        await tx.insert(users).values(userData)
        await tx.insert(userPreferences).values(preferencesData)
      })

      // Then: Both should be created successfully
      const [foundUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userData.id!))

      const [foundPreferences] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userData.id!))

      expect(foundUser).toBeDefined()
      expect(foundPreferences).toBeDefined()
      expect(foundPreferences.layout).toBe('compact')
      expect(foundPreferences.promptSuggestions).toBe(false)
      expect(foundPreferences.multiModelEnabled).toBe(true)
    })

    test('should handle user preferences join queries', async () => {
      // Given: User with preferences
      const userData = DatabaseFactories.createUser()
      const [createdUser] = await db.insert(users).values(userData).returning()

      const preferencesData = DatabaseFactories.createUserPreferences(createdUser.id)
      await db.insert(userPreferences).values(preferencesData)

      // When: Joining user with preferences
      const userWithPreferences = await db
        .select({
          userId: users.id,
          userName: users.displayName,
          userEmail: users.email,
          layout: userPreferences.layout,
          promptSuggestions: userPreferences.promptSuggestions,
          multiModelEnabled: userPreferences.multiModelEnabled
        })
        .from(users)
        .leftJoin(userPreferences, eq(users.id, userPreferences.userId))
        .where(eq(users.id, createdUser.id))

      // Then: Join should return combined data
      expect(userWithPreferences).toHaveLength(1)
      const result = userWithPreferences[0]
      expect(result.userId).toBe(createdUser.id)
      expect(result.userName).toBe(createdUser.displayName)
      expect(result.layout).toBeDefined()
      expect(result.promptSuggestions).toBeDefined()
      expect(result.multiModelEnabled).toBeDefined()
    })
  })

  describe('Complex User Queries', () => {
    test('should find users with specific favorite models', async () => {
      // Given: Users with different favorite models
      const users1 = DatabaseFactories.createUser({ 
        overrides: { favoriteModels: ['gpt-4o', 'claude-3-5-sonnet'] }
      })
      const users2 = DatabaseFactories.createUser({ 
        overrides: { favoriteModels: ['gpt-4o', 'gemini-pro'] }
      })
      const users3 = DatabaseFactories.createUser({ 
        overrides: { favoriteModels: ['claude-3-5-sonnet'] }
      })

      await db.insert(users).values([users1, users2, users3])

      // When: Querying users who have gpt-4o as favorite
      const gpt4Users = await db
        .select()
        .from(users)
        .where(
          // Using JSONB contains operator
          sql`favorite_models @> '["gpt-4o"]'::jsonb`
        )

      // Then: Only users with gpt-4o should be returned
      expect(gpt4Users).toHaveLength(2)
      gpt4Users.forEach(user => {
        expect(user.favoriteModels).toContain('gpt-4o')
      })
    })

    test('should aggregate user statistics', async () => {
      // Given: Multiple users with various properties
      const usersData = [
        DatabaseFactories.createUser({ overrides: { anonymous: false, dailyMessageCount: 10 } }),
        DatabaseFactories.createUser({ overrides: { anonymous: false, dailyMessageCount: 20 } }),
        DatabaseFactories.createGuestUser({ overrides: { dailyMessageCount: 5 } }),
        DatabaseFactories.createGuestUser({ overrides: { dailyMessageCount: 15 } })
      ]

      await db.insert(users).values(usersData)

      // When: Aggregating user statistics
      const stats = await db
        .select({
          totalUsers: sql<number>`COUNT(*)::int`,
          registeredUsers: sql<number>`COUNT(*) FILTER (WHERE anonymous = false)::int`,
          guestUsers: sql<number>`COUNT(*) FILTER (WHERE anonymous = true)::int`,
          avgDailyMessages: sql<number>`AVG(daily_message_count)::float`,
          totalDailyMessages: sql<number>`SUM(daily_message_count)::int`
        })
        .from(users)

      // Then: Statistics should be calculated correctly
      const result = stats[0]
      expect(result.totalUsers).toBe(4)
      expect(result.registeredUsers).toBe(2)
      expect(result.guestUsers).toBe(2)
      expect(result.avgDailyMessages).toBe(12.5) // (10+20+5+15)/4
      expect(result.totalDailyMessages).toBe(50)
    })
  })
})