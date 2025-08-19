import { eq, and, gte, lt, sql } from 'drizzle-orm'
import { db } from './drizzle'
import { users, chats, messages, messageFeedback, apiKeys } from './schema'
import type { User, NewUser, Chat, Message } from './schema'

/**
 * Guest User Operations
 */
export async function validateGuestUser(userId: string): Promise<boolean> {
  // Validate UUID format first
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  if (!isValidUuid) return false

  try {
    // Check if guest user exists in database
    const guestUser = await db.select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.anonymous, true)
      ))
      .limit(1)
    
    return guestUser.length > 0
  } catch (error) {
    // Handle gracefully - could be table doesn't exist yet
    console.warn('Guest user validation failed:', error)
    return isValidUuid // Fall back to format validation
  }
}

export async function createGuestUser(): Promise<User> {
  const [newUser] = await db.insert(users)
    .values({
      anonymous: true,
      dailyMessageCount: 0,
      dailyProMessageCount: 0,
      favoriteModels: [],
    })
    .returning()
  
  return newUser
}

/**
 * User Operations
 */
export async function getUserById(userId: string): Promise<User | null> {
  const [user] = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  
  return user || null
}

export async function updateUserActivity(userId: string) {
  await db.update(users)
    .set({
      lastActiveAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(users.id, userId))
}

export async function getUserMessageCounts(userId: string) {
  const [user] = await db.select({
    dailyMessageCount: users.dailyMessageCount,
    dailyProMessageCount: users.dailyProMessageCount,
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1)
  
  return user || { dailyMessageCount: 0, dailyProMessageCount: 0 }
}

export async function incrementMessageCount(userId: string, isPro: boolean = false) {
  if (isPro) {
    await db.update(users)
      .set({
        dailyProMessageCount: sql`${users.dailyProMessageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
  } else {
    await db.update(users)
      .set({
        dailyMessageCount: sql`${users.dailyMessageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
  }
}

/**
 * Chat Operations
 */
export async function createChat(userId: string, title?: string, model?: string): Promise<Chat> {
  const [newChat] = await db.insert(chats)
    .values({
      userId,
      title: title || 'New Chat',
      model,
    })
    .returning()
  
  return newChat
}

export async function getChatById(chatId: string): Promise<Chat | null> {
  const [chat] = await db.select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)
  
  return chat || null
}

export async function getUserChats(userId: string, limit: number = 50) {
  return await db.select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(chats.updatedAt)
    .limit(limit)
}

export async function updateChatActivity(chatId: string) {
  await db.update(chats)
    .set({
      updatedAt: new Date()
    })
    .where(eq(chats.id, chatId))
}

/**
 * Message Operations
 */
export async function createMessage(
  chatId: string,
  userId: string,
  role: string,
  content: string,
  model?: string,
  reasoning?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
  metadata?: Record<string, any>
): Promise<Message> {
  const [newMessage] = await db.insert(messages)
    .values({
      chatId,
      userId,
      role,
      content,
      model,
      reasoning,
      reasoningEffort,
      metadata,
    })
    .returning()
  
  return newMessage
}

export async function getChatMessages(chatId: string, limit: number = 100) {
  return await db.select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt)
    .limit(limit)
}

/**
 * API Key Operations
 */
export async function getUserApiKeys(userId: string) {
  return await db.select({
    id: apiKeys.id,
    provider: apiKeys.provider,
    isActive: apiKeys.isActive,
    lastUsedAt: apiKeys.lastUsedAt,
    createdAt: apiKeys.createdAt,
  })
  .from(apiKeys)
  .where(eq(apiKeys.userId, userId))
}

export async function upsertApiKey(
  userId: string,
  provider: string,
  encryptedKey: string
) {
  // Check if key exists
  const existing = await db.select()
    .from(apiKeys)
    .where(and(
      eq(apiKeys.userId, userId),
      eq(apiKeys.provider, provider)
    ))
    .limit(1)
  
  if (existing.length > 0) {
    // Update existing
    await db.update(apiKeys)
      .set({
        encryptedKey,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, existing[0].id))
  } else {
    // Insert new
    await db.insert(apiKeys)
      .values({
        userId,
        provider,
        encryptedKey,
      })
  }
}

export async function getApiKey(userId: string, provider: string) {
  const [key] = await db.select()
    .from(apiKeys)
    .where(and(
      eq(apiKeys.userId, userId),
      eq(apiKeys.provider, provider),
      eq(apiKeys.isActive, true)
    ))
    .limit(1)
  
  if (key) {
    // Update last used timestamp
    await db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, key.id))
  }
  
  return key
}

/**
 * Message Feedback Operations
 */
export async function addMessageFeedback(
  messageId: string,
  userId: string,
  feedbackType: 'positive' | 'negative',
  comment?: string,
  rating?: number
) {
  await db.insert(messageFeedback)
    .values({
      messageId,
      userId,
      feedbackType,
      comment,
      rating,
    })
}

/**
 * Cleanup Operations
 */
export async function resetDailyLimits() {
  // Reset daily message counts for all users
  await db.update(users)
    .set({
      dailyMessageCount: 0,
      dailyProMessageCount: 0,
      updatedAt: new Date()
    })
}

export async function cleanupInactiveGuestUsers(daysInactive: number = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive)
  
  await db.delete(users)
    .where(and(
      eq(users.anonymous, true),
      lt(users.lastActiveAt, cutoffDate)
    ))
}