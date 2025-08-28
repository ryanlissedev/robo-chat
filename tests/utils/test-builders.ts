/**
 * Test data builders for creating consistent, reusable test data
 * Uses the Builder pattern to create complex objects with sensible defaults
 */

import type { Session, User } from '@supabase/supabase-js';

// ============================================================================
// Base Builder Class
// ============================================================================

abstract class BaseBuilder<T> {
  protected data: Partial<T> = {};

  abstract build(): T;

  /**
   * Build multiple instances with slight variations
   */
  buildList(count: number, variations?: Array<Partial<T>>): T[] {
    return Array.from({ length: count }, (_, index) => {
      const variation = variations?.[index] || {};
      const builder = this.clone();
      Object.assign(builder.data, variation);
      return builder.build();
    });
  }

  protected abstract clone(): BaseBuilder<T>;

  /**
   * Reset the builder to initial state
   */
  reset(): this {
    this.data = {};
    return this;
  }
}

// ============================================================================
// User Builder
// ============================================================================

export class UserBuilder extends BaseBuilder<User> {
  constructor() {
    super();
    this.withDefaults();
  }

  private withDefaults(): this {
    this.data = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: 'test@example.com',
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      created_at: new Date().toISOString(),
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      updated_at: new Date().toISOString(),
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      email_confirmed_at: new Date().toISOString(),
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      last_sign_in_at: new Date().toISOString(),
      aud: 'authenticated',
      role: 'authenticated',
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      app_metadata: {},
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      user_metadata: {},
      phone: undefined,
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      confirmed_at: new Date().toISOString(),
      // biome-ignore lint/style/useNamingConvention: Supabase auth schema uses snake_case
      recovery_sent_at: undefined,
    };
    return this;
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.data.user_metadata = { ...this.data.user_metadata, ...metadata };
    return this;
  }

  withAppMetadata(metadata: Record<string, any>): this {
    this.data.app_metadata = { ...this.data.app_metadata, ...metadata };
    return this;
  }

  withPhone(phone: string): this {
    this.data.phone = phone;
    return this;
  }

  withRole(role: string): this {
    this.data.role = role;
    return this;
  }

  withoutEmailConfirmation(): this {
    this.data.email_confirmed_at = undefined;
    this.data.confirmed_at = undefined;
    return this;
  }

  withCreatedAt(date: Date | string): this {
    const dateStr = typeof date === 'string' ? date : date.toISOString();
    this.data.created_at = dateStr;
    return this;
  }

  build(): User {
    return this.data as User;
  }

  protected clone(): UserBuilder {
    const builder = new UserBuilder();
    builder.data = { ...this.data };
    return builder;
  }

  // Static factory methods
  static create(): UserBuilder {
    return new UserBuilder();
  }

  static admin(): UserBuilder {
    return new UserBuilder()
      .withEmail('admin@example.com')
      .withRole('admin')
      .withAppMetadata({
        role: 'admin',
        permissions: ['read', 'write', 'delete'],
      });
  }

  static guest(): UserBuilder {
    return new UserBuilder()
      .withEmail('guest@example.com')
      .withRole('guest')
      .withoutEmailConfirmation();
  }

  static withRandomEmail(): UserBuilder {
    const randomId = Math.random().toString(36).substr(2, 9);
    return new UserBuilder().withEmail(`user${randomId}@example.com`);
  }
}

// ============================================================================
// Session Builder
// ============================================================================

export class SessionBuilder extends BaseBuilder<Session> {
  constructor() {
    super();
    this.withDefaults();
  }

  private withDefaults(): this {
    const now = Math.floor(Date.now() / 1000);
    this.data = {
      // biome-ignore lint/style/useNamingConvention: JWT token standard uses snake_case
      access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({
          sub: 'user_123',
          aud: 'authenticated',
          exp: now + 3600,
          iat: now,
        })
      ).toString('base64')}.signature`,
      // biome-ignore lint/style/useNamingConvention: OAuth standard uses snake_case
      token_type: 'bearer',
      // biome-ignore lint/style/useNamingConvention: OAuth standard uses snake_case
      expires_in: 3600,
      // biome-ignore lint/style/useNamingConvention: OAuth standard uses snake_case
      expires_at: now + 3600,
      // biome-ignore lint/style/useNamingConvention: OAuth standard uses snake_case
      refresh_token: `refresh_${Math.random().toString(36).substr(2, 32)}`,
      user: UserBuilder.create().build(),
    };
    return this;
  }

  withUser(user: User): this {
    this.data.user = user;
    return this;
  }

  withAccessToken(token: string): this {
    this.data.access_token = token;
    return this;
  }

  withRefreshToken(token: string): this {
    this.data.refresh_token = token;
    return this;
  }

  withExpiresIn(seconds: number): this {
    this.data.expires_in = seconds;
    this.data.expires_at = Math.floor(Date.now() / 1000) + seconds;
    return this;
  }

  withExpiredToken(): this {
    const pastTime = Math.floor(Date.now() / 1000) - 3600;
    this.data.expires_at = pastTime;
    this.data.expires_in = -3600;
    return this;
  }

  build(): Session {
    return this.data as Session;
  }

  protected clone(): SessionBuilder {
    const builder = new SessionBuilder();
    builder.data = { ...this.data };
    return builder;
  }

  // Static factory methods
  static create(): SessionBuilder {
    return new SessionBuilder();
  }

  static expired(): SessionBuilder {
    return new SessionBuilder().withExpiredToken();
  }

  static withUser(user: User): SessionBuilder {
    return new SessionBuilder().withUser(user);
  }
}

// ============================================================================
// Chat Message Builder
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
  userId?: string;
  conversationId?: string;
  tokens?: number;
  model?: string;
  finishReason?: string;
}

export class ChatMessageBuilder extends BaseBuilder<ChatMessage> {
  constructor() {
    super();
    this.withDefaults();
  }

  private withDefaults(): this {
    this.data = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: 'Hello, this is a test message.',
      timestamp: new Date().toISOString(),
      metadata: {},
    };
    return this;
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withRole(role: 'user' | 'assistant' | 'system'): this {
    this.data.role = role;
    return this;
  }

  withContent(content: string): this {
    this.data.content = content;
    return this;
  }

  withTimestamp(timestamp: string | Date): this {
    this.data.timestamp =
      typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    return this;
  }

  withUserId(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withConversationId(conversationId: string): this {
    this.data.conversationId = conversationId;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  withTokens(tokens: number): this {
    this.data.tokens = tokens;
    return this;
  }

  withModel(model: string): this {
    this.data.model = model;
    return this;
  }

  withFinishReason(reason: string): this {
    this.data.finishReason = reason;
    return this;
  }

  asUser(): this {
    return this.withRole('user');
  }

  asAssistant(): this {
    return this.withRole('assistant').withContent(
      'Hello! How can I help you today?'
    );
  }

  asSystem(): this {
    return this.withRole('system').withContent('You are a helpful assistant.');
  }

  withLongContent(): this {
    const longContent = 'Lorem ipsum '.repeat(100);
    return this.withContent(longContent);
  }

  withCodeContent(): this {
    const codeContent = `
\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
    `.trim();
    return this.withContent(codeContent);
  }

  build(): ChatMessage {
    return this.data as ChatMessage;
  }

  protected clone(): ChatMessageBuilder {
    const builder = new ChatMessageBuilder();
    builder.data = { ...this.data };
    return builder;
  }

  // Static factory methods
  static create(): ChatMessageBuilder {
    return new ChatMessageBuilder();
  }

  static user(content?: string): ChatMessageBuilder {
    const builder = new ChatMessageBuilder().asUser();
    if (content) builder.withContent(content);
    return builder;
  }

  static assistant(content?: string): ChatMessageBuilder {
    const builder = new ChatMessageBuilder().asAssistant();
    if (content) builder.withContent(content);
    return builder;
  }

  static system(content?: string): ChatMessageBuilder {
    const builder = new ChatMessageBuilder().asSystem();
    if (content) builder.withContent(content);
    return builder;
  }
}

// ============================================================================
// Conversation Builder
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  model?: string;
  systemPrompt?: string;
}

export class ConversationBuilder extends BaseBuilder<Conversation> {
  constructor() {
    super();
    this.withDefaults();
  }

  private withDefaults(): this {
    this.data = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'Test Conversation',
      userId: 'user_123',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
      model: 'gpt-3.5-turbo',
    };
    return this;
  }

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  withUserId(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withMessages(messages: ChatMessage[]): this {
    this.data.messages = [...messages];
    return this;
  }

  addMessage(message: ChatMessage): this {
    this.data.messages = [...(this.data.messages || []), message];
    return this;
  }

  withModel(model: string): this {
    this.data.model = model;
    return this;
  }

  withSystemPrompt(prompt: string): this {
    this.data.systemPrompt = prompt;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  withSimpleConversation(): this {
    const messages = [
      ChatMessageBuilder.user('Hello!').build(),
      ChatMessageBuilder.assistant('Hi there! How can I help you?').build(),
      ChatMessageBuilder.user('What is TypeScript?').build(),
      ChatMessageBuilder.assistant(
        'TypeScript is a typed superset of JavaScript...'
      ).build(),
    ];
    return this.withMessages(messages);
  }

  withLongConversation(): this {
    const messages = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0
        ? ChatMessageBuilder.user(`User message ${i + 1}`).build()
        : ChatMessageBuilder.assistant(`Assistant response ${i + 1}`).build()
    );
    return this.withMessages(messages);
  }

  build(): Conversation {
    return this.data as Conversation;
  }

  protected clone(): ConversationBuilder {
    const builder = new ConversationBuilder();
    builder.data = { ...this.data };
    return builder;
  }

  // Static factory methods
  static create(): ConversationBuilder {
    return new ConversationBuilder();
  }

  static withUser(userId: string): ConversationBuilder {
    return new ConversationBuilder().withUserId(userId);
  }

  static simple(): ConversationBuilder {
    return new ConversationBuilder().withSimpleConversation();
  }

  static long(): ConversationBuilder {
    return new ConversationBuilder().withLongConversation();
  }
}

// ============================================================================
// File Upload Builder
// ============================================================================

export interface FileUpload {
  id: string;
  filename: string;
  mimetype: string;
  size: number;
  content: string | ArrayBuffer;
  uploadedAt: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class FileUploadBuilder extends BaseBuilder<FileUpload> {
  constructor() {
    super();
    this.withDefaults();
  }

  private withDefaults(): this {
    this.data = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename: 'test-file.txt',
      mimetype: 'text/plain',
      size: 100,
      content: 'This is test file content.',
      uploadedAt: new Date().toISOString(),
      metadata: {},
    };
    return this;
  }

  withFilename(filename: string): this {
    this.data.filename = filename;
    // Auto-detect mimetype based on extension
    if (filename.endsWith('.json')) {
      this.data.mimetype = 'application/json';
    } else if (filename.endsWith('.csv')) {
      this.data.mimetype = 'text/csv';
    } else if (filename.endsWith('.pdf')) {
      this.data.mimetype = 'application/pdf';
    } else if (filename.endsWith('.png')) {
      this.data.mimetype = 'image/png';
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      this.data.mimetype = 'image/jpeg';
    }
    return this;
  }

  withMimetype(mimetype: string): this {
    this.data.mimetype = mimetype;
    return this;
  }

  withContent(content: string | ArrayBuffer): this {
    this.data.content = content;
    this.data.size =
      typeof content === 'string' ? content.length : content.byteLength;
    return this;
  }

  withSize(size: number): this {
    this.data.size = size;
    return this;
  }

  withUserId(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withMetadata(metadata: Record<string, any>): this {
    this.data.metadata = { ...this.data.metadata, ...metadata };
    return this;
  }

  asImage(): this {
    return this.withFilename('image.png')
      .withMimetype('image/png')
      .withSize(1024);
  }

  asDocument(): this {
    return this.withFilename('document.pdf')
      .withMimetype('application/pdf')
      .withSize(2048);
  }

  asJSON(): this {
    const jsonContent = JSON.stringify({ test: 'data', array: [1, 2, 3] });
    return this.withFilename('data.json').withContent(jsonContent);
  }

  asCSV(): this {
    const csvContent = 'name,age,city\nJohn,30,NYC\nJane,25,LA';
    return this.withFilename('data.csv').withContent(csvContent);
  }

  build(): FileUpload {
    return this.data as FileUpload;
  }

  protected clone(): FileUploadBuilder {
    const builder = new FileUploadBuilder();
    builder.data = { ...this.data };
    return builder;
  }

  // Static factory methods
  static create(): FileUploadBuilder {
    return new FileUploadBuilder();
  }

  static image(): FileUploadBuilder {
    return new FileUploadBuilder().asImage();
  }

  static document(): FileUploadBuilder {
    return new FileUploadBuilder().asDocument();
  }

  static json(): FileUploadBuilder {
    return new FileUploadBuilder().asJSON();
  }

  static csv(): FileUploadBuilder {
    return new FileUploadBuilder().asCSV();
  }
}

// ============================================================================
// Export all builders
// ============================================================================

export const TestDataBuilders = {
  User: UserBuilder,
  Session: SessionBuilder,
  ChatMessage: ChatMessageBuilder,
  Conversation: ConversationBuilder,
  FileUpload: FileUploadBuilder,
};
