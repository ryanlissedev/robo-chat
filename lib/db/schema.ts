import { 
  pgTable, 
  text, 
  timestamp, 
  boolean, 
  jsonb, 
  integer,
  uuid,
  varchar,
  pgEnum,
  index,
  unique
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const reasoningEffortEnum = pgEnum('reasoning_effort', ['low', 'medium', 'high'])
export const feedbackTypeEnum = pgEnum('feedback_type', ['positive', 'negative'])
export const providerEnum = pgEnum('provider', ['openai', 'anthropic', 'google', 'xai', 'groq', 'deepseek', 'mistral', 'perplexity', 'ollama'])

// Users table - Enhanced with all required columns
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  profileImage: varchar('profile_image', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
  systemPrompt: text('system_prompt'),
  themeMode: text('theme_mode').default('system'),
  dailyMessageCount: integer('daily_message_count').default(0).notNull(),
  dailyProMessageCount: integer('daily_pro_message_count').default(0).notNull(),
  favoriteModels: jsonb('favorite_models').default([]).$type<string[]>(),
  anonymous: boolean('anonymous').default(false).notNull()
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  displayNameIdx: index('idx_users_display_name').on(table.displayName),
  lastActiveAtIdx: index('idx_users_last_active_at').on(table.lastActiveAt),
  anonymousIdx: index('idx_users_anonymous').on(table.anonymous)
}))

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_projects_user_id').on(table.userId),
  nameIdx: index('idx_projects_name').on(table.name)
}))

// Chats table - Enhanced with project relationship
export const chats = pgTable('chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: text('title'),
  systemPrompt: text('system_prompt'),
  model: varchar('model', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  public: boolean('public').default(false).notNull()
}, (table) => ({
  userIdIdx: index('idx_chats_user_id').on(table.userId),
  projectIdIdx: index('idx_chats_project_id').on(table.projectId),
  modelIdx: index('idx_chats_model').on(table.model),
  createdAtIdx: index('idx_chats_created_at').on(table.createdAt)
}))

// Messages table - Enhanced with all required columns
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  parts: jsonb('parts').$type<Array<{ type: string; content: string; [key: string]: any }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  model: text('model'),
  reasoningEffort: reasoningEffortEnum('reasoning_effort').default('medium'),
  reasoning: text('reasoning'),
  langsmithRunId: varchar('langsmith_run_id', { length: 255 }),
  metadata: jsonb('metadata').$type<Record<string, any>>()
}, (table) => ({
  chatIdIdx: index('idx_messages_chat_id').on(table.chatId),
  userIdIdx: index('idx_messages_user_id').on(table.userId),
  roleIdx: index('idx_messages_role').on(table.role),
  createdAtIdx: index('idx_messages_created_at').on(table.createdAt),
  modelIdx: index('idx_messages_model').on(table.model),
  reasoningEffortIdx: index('idx_messages_reasoning_effort').on(table.reasoningEffort),
  langsmithRunIdIdx: index('idx_messages_langsmith_run_id').on(table.langsmithRunId)
}))

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
}, (table) => ({
  messageIdIdx: index('idx_message_feedback_message_id').on(table.messageId),
  userIdIdx: index('idx_message_feedback_user_id').on(table.userId),
  feedbackTypeIdx: index('idx_message_feedback_type').on(table.feedbackType)
}))

// General Feedback table (separate from message feedback)
export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_feedback_user_id').on(table.userId),
  createdAtIdx: index('idx_feedback_created_at').on(table.createdAt)
}))

// User Keys table (renamed from apiKeys for consistency with migrations)
export const userKeys = pgTable('user_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),
  encryptedKey: text('encrypted_key').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_user_keys_user_id').on(table.userId),
  providerIdx: index('idx_user_keys_provider').on(table.provider),
  providerUserIdx: unique('idx_user_keys_provider_user').on(table.userId, table.provider)
}))

// API Keys table (legacy name for backward compatibility)
export const apiKeys = userKeys

// User Preferences table
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  layout: varchar('layout', { length: 50 }).default('default'),
  promptSuggestions: boolean('prompt_suggestions').default(true).notNull(),
  showToolInvocations: boolean('show_tool_invocations').default(true).notNull(),
  showConversationPreviews: boolean('show_conversation_previews').default(true).notNull(),
  multiModelEnabled: boolean('multi_model_enabled').default(false).notNull(),
  hiddenModels: text('hidden_models').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_user_preferences_user_id').on(table.userId)
}))

// User Retrieval Settings table
export const userRetrievalSettings = pgTable('user_retrieval_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  enableRetrieval: boolean('enable_retrieval').default(true).notNull(),
  maxResults: integer('max_results').default(5).notNull(),
  similarityThreshold: integer('similarity_threshold').default(70).notNull(),
  preferredSources: jsonb('preferred_sources').$type<string[]>().default([]),
  excludedSources: jsonb('excluded_sources').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_user_retrieval_settings_user_id').on(table.userId),
  userIdUnique: unique('idx_user_retrieval_settings_user_unique').on(table.userId)
}))

// Chat Attachments table
export const chatAttachments = pgTable('chat_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size').notNull(),
  filePath: text('file_path').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull()
}, (table) => ({
  chatIdIdx: index('idx_chat_attachments_chat_id').on(table.chatId),
  fileTypeIdx: index('idx_chat_attachments_file_type').on(table.fileType)
}))

// API Key Audit Log table
export const apiKeyAuditLog = pgTable('api_key_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),
  action: text('action').notNull(), // 'created', 'updated', 'deleted', 'used'
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  success: boolean('success').default(true).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => ({
  userIdIdx: index('idx_api_key_audit_log_user_id').on(table.userId),
  providerIdx: index('idx_api_key_audit_log_provider').on(table.provider),
  actionIdx: index('idx_api_key_audit_log_action').on(table.action),
  createdAtIdx: index('idx_api_key_audit_log_created_at').on(table.createdAt)
}))

// Relations - Comprehensive relationship definitions
export const usersRelations = relations(users, ({ many, one }) => ({
  chats: many(chats),
  projects: many(projects),
  messages: many(messages),
  messageFeedback: many(messageFeedback),
  feedback: many(feedback),
  userKeys: many(userKeys),
  apiKeys: many(apiKeys), // Legacy alias
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId]
  }),
  retrievalSettings: one(userRetrievalSettings, {
    fields: [users.id],
    references: [userRetrievalSettings.userId]
  }),
  auditLogs: many(apiKeyAuditLog)
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id]
  }),
  chats: many(chats)
}))

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, {
    fields: [chats.userId],
    references: [users.id]
  }),
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id]
  }),
  messages: many(messages),
  attachments: many(chatAttachments)
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

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id]
  })
}))

export const userKeysRelations = relations(userKeys, ({ one }) => ({
  user: one(users, {
    fields: [userKeys.userId],
    references: [users.id]
  })
}))

// Legacy alias for backward compatibility
export const apiKeysRelations = userKeysRelations

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id]
  })
}))

export const userRetrievalSettingsRelations = relations(userRetrievalSettings, ({ one }) => ({
  user: one(users, {
    fields: [userRetrievalSettings.userId],
    references: [users.id]
  })
}))

export const chatAttachmentsRelations = relations(chatAttachments, ({ one }) => ({
  chat: one(chats, {
    fields: [chatAttachments.chatId],
    references: [chats.id]
  })
}))

export const apiKeyAuditLogRelations = relations(apiKeyAuditLog, ({ one }) => ({
  user: one(users, {
    fields: [apiKeyAuditLog.userId],
    references: [users.id]
  })
}))

// Type exports for TypeScript
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'

// Core entity types
export type User = InferSelectModel<typeof users>
export type NewUser = InferInsertModel<typeof users>

export type Project = InferSelectModel<typeof projects>
export type NewProject = InferInsertModel<typeof projects>

export type Chat = InferSelectModel<typeof chats>
export type NewChat = InferInsertModel<typeof chats>

export type Message = InferSelectModel<typeof messages>
export type NewMessage = InferInsertModel<typeof messages>

// Feedback types
export type MessageFeedback = InferSelectModel<typeof messageFeedback>
export type NewMessageFeedback = InferInsertModel<typeof messageFeedback>

export type Feedback = InferSelectModel<typeof feedback>
export type NewFeedback = InferInsertModel<typeof feedback>

// User key and API key types
export type UserKey = InferSelectModel<typeof userKeys>
export type NewUserKey = InferInsertModel<typeof userKeys>

// Legacy alias for backward compatibility
export type ApiKey = UserKey
export type NewApiKey = NewUserKey

// User settings types
export type UserPreferences = InferSelectModel<typeof userPreferences>
export type NewUserPreferences = InferInsertModel<typeof userPreferences>

export type UserRetrievalSettings = InferSelectModel<typeof userRetrievalSettings>
export type NewUserRetrievalSettings = InferInsertModel<typeof userRetrievalSettings>

// File and attachment types
export type ChatAttachment = InferSelectModel<typeof chatAttachments>
export type NewChatAttachment = InferInsertModel<typeof chatAttachments>

// Audit and security types
export type ApiKeyAuditLog = InferSelectModel<typeof apiKeyAuditLog>
export type NewApiKeyAuditLog = InferInsertModel<typeof apiKeyAuditLog>

// Enum types for type safety
export type ReasoningEffort = 'low' | 'medium' | 'high'
export type FeedbackType = 'positive' | 'negative'
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai' | 'groq' | 'deepseek' | 'mistral' | 'perplexity' | 'ollama'

// Complex types for message parts and metadata
export type MessagePart = {
  type: string
  content: string
  [key: string]: any
}

export type MessageMetadata = Record<string, any>

// Union types for database operations
export type DatabaseTable = 
  | typeof users
  | typeof projects
  | typeof chats
  | typeof messages
  | typeof messageFeedback
  | typeof feedback
  | typeof userKeys
  | typeof userPreferences
  | typeof userRetrievalSettings
  | typeof chatAttachments
  | typeof apiKeyAuditLog