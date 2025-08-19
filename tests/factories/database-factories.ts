import { randomUUID } from 'crypto'
import { faker } from '@faker-js/faker'
import type { 
  NewUser, 
  NewChat, 
  NewMessage, 
  NewUserKey, 
  NewProject,
  NewMessageFeedback,
  NewUserPreferences,
  NewUserRetrievalSettings
} from '../../lib/db/schema'

/**
 * Test Data Factories for RoboRail Database Entities
 * Following TDD London (outside-in) approach
 */

export interface DatabaseFactoryOptions {
  overrides?: Partial<any>
  relations?: Record<string, string | null | undefined>
}

export class DatabaseFactories {
  /**
   * User Factory
   */
  static createUser(options: DatabaseFactoryOptions = {}): NewUser {
    const baseUser: NewUser = {
      id: randomUUID(),
      email: faker.internet.email(),
      displayName: faker.person.fullName(),
      profileImage: faker.image.avatar(),
      systemPrompt: faker.lorem.paragraph(),
      themeMode: faker.helpers.arrayElement(['light', 'dark', 'system']),
      dailyMessageCount: faker.number.int({ min: 0, max: 100 }),
      dailyProMessageCount: faker.number.int({ min: 0, max: 50 }),
      favoriteModels: faker.helpers.arrayElements([
        'gpt-4o', 'claude-3-sonnet', 'gemini-pro', 'grok-beta'
      ], { min: 1, max: 3 }),
      anonymous: faker.datatype.boolean({ probability: 0.2 }),
      ...options.overrides
    }
    return baseUser
  }

  /**
   * Anonymous Guest User Factory
   */
  static createGuestUser(options: DatabaseFactoryOptions = {}): NewUser {
    return this.createUser({
      overrides: {
        email: undefined,
        displayName: undefined,
        profileImage: undefined,
        anonymous: true,
        ...options.overrides
      }
    })
  }

  /**
   * Project Factory
   */
  static createProject(userId: string, options: DatabaseFactoryOptions = {}): NewProject {
    const baseProject: NewProject = {
      id: randomUUID(),
      userId,
      name: faker.company.name(),
      description: faker.lorem.paragraph(),
      ...options.overrides
    }
    return baseProject
  }

  /**
   * Chat Factory
   */
  static createChat(userId: string, options: DatabaseFactoryOptions = {}): NewChat {
    const baseChat: NewChat = {
      id: randomUUID(),
      userId,
      projectId: options.relations?.projectId || null,
      title: faker.lorem.sentence({ min: 2, max: 6 }),
      systemPrompt: faker.lorem.paragraph(),
      model: faker.helpers.arrayElement([
        'gpt-4o', 'claude-3-5-sonnet', 'gemini-pro', 'grok-beta'
      ]),
      public: faker.datatype.boolean({ probability: 0.1 }),
      ...options.overrides
    }
    return baseChat
  }

  /**
   * Message Factory
   */
  static createMessage(
    chatId: string, 
    userId: string, 
    role: 'user' | 'assistant' | 'system' = 'user',
    options: DatabaseFactoryOptions = {}
  ): NewMessage {
    const baseMessage: NewMessage = {
      id: randomUUID(),
      chatId,
      userId,
      role,
      content: role === 'user' 
        ? faker.lorem.sentence() 
        : faker.lorem.paragraphs({ min: 1, max: 3 }),
      parts: role === 'assistant' ? [
        { type: 'text', content: faker.lorem.paragraph() }
      ] : undefined,
      model: role === 'assistant' ? faker.helpers.arrayElement([
        'gpt-4o', 'claude-3-5-sonnet', 'gemini-pro'
      ]) : undefined,
      reasoningEffort: faker.helpers.arrayElement(['low', 'medium', 'high']),
      reasoning: role === 'assistant' && faker.datatype.boolean({ probability: 0.3 })
        ? faker.lorem.paragraph()
        : undefined,
      langsmithRunId: faker.datatype.boolean({ probability: 0.5 })
        ? faker.string.uuid()
        : undefined,
      metadata: faker.datatype.boolean({ probability: 0.3 }) ? {
        temperature: faker.number.float({ min: 0, max: 1, fractionDigits: 2 }),
        tokens: faker.number.int({ min: 10, max: 4000 })
      } : undefined,
      ...options.overrides
    }
    return baseMessage
  }

  /**
   * User API Key Factory
   */
  static createUserKey(userId: string, options: DatabaseFactoryOptions = {}): NewUserKey {
    const provider = options.overrides?.provider || faker.helpers.arrayElement([
      'openai', 'anthropic', 'google', 'xai', 'groq', 'deepseek', 'mistral'
    ])
    
    const baseUserKey: NewUserKey = {
      id: randomUUID(),
      userId,
      provider,
      encryptedKey: faker.string.alphanumeric(64),
      isActive: faker.datatype.boolean({ probability: 0.9 }),
      lastUsedAt: faker.datatype.boolean({ probability: 0.7 })
        ? faker.date.recent({ days: 30 })
        : undefined,
      ...options.overrides
    }
    return baseUserKey
  }

  /**
   * Message Feedback Factory
   */
  static createMessageFeedback(
    messageId: string, 
    userId: string, 
    options: DatabaseFactoryOptions = {}
  ): NewMessageFeedback {
    const baseFeedback: NewMessageFeedback = {
      id: randomUUID(),
      messageId,
      userId,
      feedbackType: faker.helpers.arrayElement(['positive', 'negative']),
      comment: faker.datatype.boolean({ probability: 0.6 }) 
        ? faker.lorem.sentence() 
        : undefined,
      rating: faker.datatype.boolean({ probability: 0.4 })
        ? faker.number.int({ min: 1, max: 5 })
        : undefined,
      ...options.overrides
    }
    return baseFeedback
  }

  /**
   * User Preferences Factory
   */
  static createUserPreferences(userId: string, options: DatabaseFactoryOptions = {}): NewUserPreferences {
    const basePreferences: NewUserPreferences = {
      userId,
      layout: faker.helpers.arrayElement(['default', 'compact', 'expanded']),
      promptSuggestions: faker.datatype.boolean({ probability: 0.8 }),
      showToolInvocations: faker.datatype.boolean({ probability: 0.7 }),
      showConversationPreviews: faker.datatype.boolean({ probability: 0.9 }),
      multiModelEnabled: faker.datatype.boolean({ probability: 0.3 }),
      hiddenModels: faker.helpers.arrayElements([
        'gpt-3.5-turbo', 'claude-instant', 'gemini-flash'
      ], { min: 0, max: 2 }),
      ...options.overrides
    }
    return basePreferences
  }

  /**
   * User Retrieval Settings Factory
   */
  static createUserRetrievalSettings(userId: string, options: DatabaseFactoryOptions = {}): NewUserRetrievalSettings {
    const baseSettings: NewUserRetrievalSettings = {
      id: randomUUID(),
      userId,
      enableRetrieval: faker.datatype.boolean({ probability: 0.9 }),
      maxResults: faker.number.int({ min: 3, max: 10 }),
      similarityThreshold: faker.number.int({ min: 60, max: 90 }),
      preferredSources: faker.helpers.arrayElements([
        'operator-manual', 'faq-calibration', 'faq-measurement'
      ], { min: 0, max: 3 }),
      excludedSources: faker.helpers.arrayElements([
        'deprecated-docs', 'beta-features'
      ], { min: 0, max: 1 }),
      ...options.overrides
    }
    return baseSettings
  }

  /**
   * Create a complete user with all related entities
   */
  static createCompleteUser(options: {
    user?: Partial<NewUser>
    includeProject?: boolean
    includeChat?: boolean
    includeMessages?: number
    includeApiKeys?: boolean
    includePreferences?: boolean
  } = {}) {
    const user = this.createUser({ overrides: options.user })
    
    const entities: {
      user: NewUser
      project?: ReturnType<typeof DatabaseFactories.createProject>
      chat?: ReturnType<typeof DatabaseFactories.createChat>
      messages?: ReturnType<typeof DatabaseFactories.createMessage>[]
      apiKeys?: ReturnType<typeof DatabaseFactories.createUserKey>[]
      preferences?: ReturnType<typeof DatabaseFactories.createUserPreferences>
      retrievalSettings?: ReturnType<typeof DatabaseFactories.createUserRetrievalSettings>
    } = { user }

    if (options.includeProject) {
      entities.project = this.createProject(user.id!)
    }

    if (options.includeChat) {
      entities.chat = this.createChat(user.id!, {
        relations: { projectId: entities.project?.id || undefined }
      })
    }

    if (options.includeMessages && entities.chat) {
      entities.messages = []
      for (let i = 0; i < options.includeMessages; i++) {
        const role = i % 2 === 0 ? 'user' : 'assistant'
        entities.messages.push(
          this.createMessage(entities.chat.id!, user.id!, role)
        )
      }
    }

    if (options.includeApiKeys) {
      entities.apiKeys = [
        this.createUserKey(user.id!, { overrides: { provider: 'openai' } }),
        this.createUserKey(user.id!, { overrides: { provider: 'anthropic' } })
      ]
    }

    if (options.includePreferences) {
      entities.preferences = this.createUserPreferences(user.id!)
      entities.retrievalSettings = this.createUserRetrievalSettings(user.id!)
    }

    return entities
  }

  /**
   * Create batch data for performance testing
   */
  static createBatchUsers(count: number): NewUser[] {
    return Array.from({ length: count }, () => this.createUser())
  }

  static createBatchChats(userId: string, count: number): NewChat[] {
    return Array.from({ length: count }, () => this.createChat(userId))
  }

  static createBatchMessages(chatId: string, userId: string, count: number): NewMessage[] {
    return Array.from({ length: count }, (_, i) => {
      const role = i % 2 === 0 ? 'user' : 'assistant'
      return this.createMessage(chatId, userId, role)
    })
  }

  /**
   * Create realistic conversation flow
   */
  static createConversationFlow(chatId: string, userId: string, turns: number = 5): NewMessage[] {
    const messages: NewMessage[] = []
    
    for (let i = 0; i < turns; i++) {
      // User message
      messages.push(this.createMessage(chatId, userId, 'user', {
        overrides: {
          content: faker.helpers.arrayElement([
            "What is RoboRail?",
            "How do I calibrate the machine?",
            "What are the troubleshooting steps?",
            "Can you explain the measurement process?",
            "What maintenance is required?"
          ])
        }
      }))

      // Assistant response
      messages.push(this.createMessage(chatId, userId, 'assistant', {
        overrides: {
          content: faker.lorem.paragraphs({ min: 2, max: 4 }),
          model: 'claude-3-5-sonnet',
          reasoningEffort: 'medium'
        }
      }))
    }

    return messages
  }
}

export default DatabaseFactories