import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types';

// Test database configuration
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE || 'test-service-role-key';

// Create test client with service role for full access
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Test utilities
export const testUtils = {
  // Clean up test data
  async cleanup() {
    // Clean up test users
    await supabase.auth.admin.deleteUser('test-user-id');

    // Clean up test data
    await supabase.from('chats').delete().eq('user_id', 'test-user-id');
    await supabase.from('messages').delete().eq('user_id', 'test-user-id');
    await supabase.from('user_keys').delete().eq('user_id', 'test-user-id');
    await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', 'test-user-id');
  },

  // Create test user
  async createTestUser() {
    const { data: user, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test-password',
      email_confirm: true,
      user_metadata: {
        name: 'Test User',
      },
    });

    if (error) {
      throw error;
    }
    return user.user;
  },

  // Setup test data
  async setupTestData(userId: string) {
    // Create test chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .insert({
        id: 'test-chat-id',
        user_id: userId,
        title: 'Test Chat',
        model: 'gpt-5-mini',
        is_authenticated: true,
      })
      .select()
      .single();

    if (chatError) {
      throw chatError;
    }

    // Create test message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        chat_id: 'test-chat-id',
        user_id: userId,
        role: 'user',
        content: 'Test message',
        model: 'gpt-5-mini',
        is_authenticated: true,
      })
      .select()
      .single();

    if (messageError) {
      throw messageError;
    }

    return { chat, message };
  },
};

// Global test setup
export async function setupTestEnvironment() {
  // Reset database state
  await testUtils.cleanup();

  // Set test environment variables (NODE_ENV is read-only, so we skip it);
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
  process.env.SUPABASE_SERVICE_ROLE = supabaseServiceRoleKey;
}

// Global test teardown
export async function teardownTestEnvironment() {
  await testUtils.cleanup();
}

// Jest setup for database tests
export const jestSetup = {
  setupFilesAfterEnv: ['<rootDir>/tests/supabase-test-setup.ts'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.spec.ts'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!lib/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
