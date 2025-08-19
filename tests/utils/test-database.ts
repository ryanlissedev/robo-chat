import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Client } from 'pg'
import * as schema from '../../lib/db/schema'
import { randomUUID } from 'crypto'

/**
 * Test Database Management Utilities
 * Provides isolated test database instances for TDD London approach
 */

export interface TestDatabaseConfig {
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  schema?: string
}

export class TestDatabase {
  private client: Client | null = null
  private db: ReturnType<typeof drizzle> | null = null
  private testSchemaName: string
  private isSetup = false

  constructor(private config: TestDatabaseConfig = {}) {
    this.testSchemaName = `test_${randomUUID().replace(/-/g, '_')}`
  }

  /**
   * Initialize test database connection
   */
  async setup(): Promise<void> {
    if (this.isSetup) return

    const dbConfig = {
      host: this.config.host || process.env.POSTGRES_HOST || 'localhost',
      port: this.config.port || parseInt(process.env.POSTGRES_PORT || '5432'),
      user: this.config.user || process.env.POSTGRES_USER || 'postgres',
      password: this.config.password || process.env.POSTGRES_PASSWORD || 'password',
      database: this.config.database || process.env.POSTGRES_DB || 'roborail_test'
    }

    this.client = new Client(dbConfig)
    await this.client.connect()

    // Create isolated test schema
    await this.client.query(`CREATE SCHEMA IF NOT EXISTS "${this.testSchemaName}"`)
    await this.client.query(`SET search_path TO "${this.testSchemaName}"`)

    this.db = drizzle(this.client, { schema })

    // Run migrations in test schema
    await this.runMigrations()

    this.isSetup = true
  }

  /**
   * Run database migrations for test schema
   */
  private async runMigrations(): Promise<void> {
    if (!this.db || !this.client) {
      throw new Error('Database not initialized')
    }

    try {
      // Create tables manually since we can't easily modify migration paths
      await this.createTestTables()
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  /**
   * Create test tables manually (simplified migration)
   */
  private async createTestTables(): Promise<void> {
    if (!this.client) throw new Error('Client not initialized')

    const createTablesSQL = `
      -- Create enums
      CREATE TYPE reasoning_effort AS ENUM ('low', 'medium', 'high');
      CREATE TYPE feedback_type AS ENUM ('positive', 'negative');
      CREATE TYPE provider AS ENUM ('openai', 'anthropic', 'google', 'xai', 'groq', 'deepseek', 'mistral', 'perplexity', 'ollama');

      -- Users table
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255),
        display_name VARCHAR(255),
        profile_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        system_prompt TEXT,
        theme_mode TEXT DEFAULT 'system',
        daily_message_count INTEGER DEFAULT 0 NOT NULL,
        daily_pro_message_count INTEGER DEFAULT 0 NOT NULL,
        favorite_models JSONB DEFAULT '[]',
        anonymous BOOLEAN DEFAULT FALSE NOT NULL
      );

      -- Projects table
      CREATE TABLE projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Chats table
      CREATE TABLE chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
        title TEXT,
        system_prompt TEXT,
        model VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        public BOOLEAN DEFAULT FALSE NOT NULL
      );

      -- Messages table
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        model TEXT,
        reasoning_effort reasoning_effort DEFAULT 'medium',
        reasoning TEXT,
        langsmith_run_id VARCHAR(255),
        metadata JSONB
      );

      -- User Keys table
      CREATE TABLE user_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider provider NOT NULL,
        encrypted_key TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(user_id, provider)
      );

      -- Message Feedback table
      CREATE TABLE message_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        feedback_type feedback_type NOT NULL,
        comment TEXT,
        rating INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- User Preferences table
      CREATE TABLE user_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        layout VARCHAR(50) DEFAULT 'default',
        prompt_suggestions BOOLEAN DEFAULT TRUE NOT NULL,
        show_tool_invocations BOOLEAN DEFAULT TRUE NOT NULL,
        show_conversation_previews BOOLEAN DEFAULT TRUE NOT NULL,
        multi_model_enabled BOOLEAN DEFAULT FALSE NOT NULL,
        hidden_models TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- User Retrieval Settings table
      CREATE TABLE user_retrieval_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enable_retrieval BOOLEAN DEFAULT TRUE NOT NULL,
        max_results INTEGER DEFAULT 5 NOT NULL,
        similarity_threshold INTEGER DEFAULT 70 NOT NULL,
        preferred_sources JSONB DEFAULT '[]',
        excluded_sources JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(user_id)
      );

      -- Feedback table
      CREATE TABLE feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Chat Attachments table
      CREATE TABLE chat_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- API Key Audit Log table
      CREATE TABLE api_key_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider provider NOT NULL,
        action TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        success BOOLEAN DEFAULT TRUE NOT NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Create indexes
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_anonymous ON users(anonymous);
      CREATE INDEX idx_projects_user_id ON projects(user_id);
      CREATE INDEX idx_chats_user_id ON chats(user_id);
      CREATE INDEX idx_chats_project_id ON chats(project_id);
      CREATE INDEX idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX idx_messages_user_id ON messages(user_id);
      CREATE INDEX idx_user_keys_user_id ON user_keys(user_id);
      CREATE INDEX idx_user_keys_provider ON user_keys(provider);
      CREATE INDEX idx_message_feedback_message_id ON message_feedback(message_id);
      CREATE INDEX idx_api_key_audit_log_user_id ON api_key_audit_log(user_id);
    `

    await this.client.query(createTablesSQL)
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized. Call setup() first.')
    }
    return this.db
  }

  /**
   * Get raw client for advanced operations
   */
  getClient() {
    if (!this.client) {
      throw new Error('Client not initialized. Call setup() first.')
    }
    return this.client
  }

  /**
   * Clear all data from test schema
   */
  async clearData(): Promise<void> {
    if (!this.client) return

    const tables = [
      'api_key_audit_log',
      'chat_attachments', 
      'message_feedback',
      'messages',
      'user_retrieval_settings',
      'user_preferences',
      'user_keys',
      'feedback',
      'chats',
      'projects',
      'users'
    ]

    for (const table of tables) {
      await this.client.query(`TRUNCATE TABLE "${this.testSchemaName}".${table} RESTART IDENTITY CASCADE`)
    }
  }

  /**
   * Reset sequences and clear data
   */
  async reset(): Promise<void> {
    await this.clearData()
  }

  /**
   * Cleanup and destroy test database
   */
  async destroy(): Promise<void> {
    if (!this.client) return

    try {
      // Drop test schema
      await this.client.query(`DROP SCHEMA IF EXISTS "${this.testSchemaName}" CASCADE`)
      
      // Close connection
      await this.client.end()
    } catch (error) {
      console.error('Error destroying test database:', error)
    } finally {
      this.client = null
      this.db = null
      this.isSetup = false
    }
  }

  /**
   * Execute raw SQL for complex test scenarios
   */
  async executeSQL(sql: string, params?: any[]): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized')
    }
    return await this.client.query(sql, params)
  }

  /**
   * Get schema name for advanced queries
   */
  getSchemaName(): string {
    return this.testSchemaName
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.isSetup && this.client !== null && this.db !== null
  }
}

/**
 * Global test database instance manager
 */
export class TestDatabaseManager {
  private static instances = new Map<string, TestDatabase>()

  static async createInstance(name: string = 'default'): Promise<TestDatabase> {
    const instance = new TestDatabase()
    await instance.setup()
    this.instances.set(name, instance)
    return instance
  }

  static getInstance(name: string = 'default'): TestDatabase | null {
    return this.instances.get(name) || null
  }

  static async destroyInstance(name: string = 'default'): Promise<void> {
    const instance = this.instances.get(name)
    if (instance) {
      await instance.destroy()
      this.instances.delete(name)
    }
  }

  static async destroyAll(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map(name => 
      this.destroyInstance(name)
    )
    await Promise.all(promises)
  }
}

export default TestDatabase