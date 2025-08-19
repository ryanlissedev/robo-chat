import { 
  pgTable, 
  text, 
  timestamp, 
  boolean, 
  jsonb, 
  integer,
  uuid,
  varchar,
  pgEnum
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const reasoningEffortEnum = pgEnum('reasoning_effort', ['low', 'medium', 'high'])
export const feedbackTypeEnum = pgEnum('feedback_type', ['positive', 'negative'])

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  systemPrompt: text('system_prompt'),
  themeMode: text('theme_mode').default('system'),
  dailyMessageCount: integer('daily_message_count').default(0).notNull(),
  dailyProMessageCount: integer('daily_pro_message_count').default(0).notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  favoriteModels: jsonb('favorite_models').default([]).$type<string[]>(),
  anonymous: boolean('anonymous').default(false).notNull()
})

// Chats table
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  systemPrompt: text('system_prompt'),
  model: varchar('model', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  public: boolean('public').default(false).notNull()
})

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  model: text('model'),
  reasoningEffort: reasoningEffortEnum('reasoning_effort').default('medium'),
  reasoning: text('reasoning'),
  metadata: jsonb('metadata').$type<Record<string, any>>()
})

// Message Feedback table
export const messageFeedback = pgTable('message_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  feedbackType: feedbackTypeEnum('feedback_type').notNull(),
  comment: text('comment'),
  rating: integer('rating'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// API Keys table (for user's encrypted API keys)
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chats: many(chats),
  messages: many(messages),
  messageFeedback: many(messageFeedback),
  apiKeys: many(apiKeys)
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id]
  }),
  messages: many(messages)
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id]
  }),
  feedback: many(messageFeedback)
}))

export const messageFeedbackRelations = relations(messageFeedback, ({ one }) => ({
  message: one(messages, {
    fields: [messageFeedback.messageId],
    references: [messages.id]
  }),
  user: one(users, {
    fields: [messageFeedback.userId],
    references: [users.id]
  })
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id]
  })
}))

// Type exports for TypeScript
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>
export type Chat = InferSelectModel<typeof chats>
export type NewChat = InferInsertModel<typeof chats>
export type Message = InferSelectModel<typeof messages>
export type NewMessage = InferInsertModel<typeof messages>
export type MessageFeedback = InferSelectModel<typeof messageFeedback>
export type NewMessageFeedback = InferInsertModel<typeof messageFeedback>
export type ApiKey = InferSelectModel<typeof apiKeys>
export type NewApiKey = InferInsertModel<typeof apiKeys>