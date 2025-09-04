import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/app/types/database.types';
import { mockIsolation } from './test-isolation';

// Test database configuration with isolation
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE || 'test-service-role-key';

// Create isolated test client factory
export const createTestSupabaseClient = () =>
  createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      params: {
        eventsPerSecond: -1, // Disable realtime for tests
      },
    },
    global: {
      headers: {
        'X-Test-Mode': 'true',
      },
    },
  });

// Main test client - recreated for each test to prevent state pollution
export let supabase = createTestSupabaseClient();

// Enhanced test utilities with isolation
export const testUtils = {
  // Recreate client for each test to prevent state pollution
  resetClient() {
    supabase = createTestSupabaseClient();
  },

  // Create isolated mock client
  createMockClient() {
    return mockIsolation.createIsolatedSupabaseMock();
  },

  // Clean up test data with better error handling
  async cleanup() {
    try {
      // Clean up test users
      await supabase.auth.admin.deleteUser('test-user-id').catch(() => {
        // Ignore if user doesn't exist
      });

      // Clean up test data with cascading deletes
      const testUserId = 'test-user-id';
      await Promise.all([
        supabase
          .from('messages')
          .delete()
          .eq('user_id', testUserId)
          .catch(() => {}),
        supabase
          .from('chats')
          .delete()
          .eq('user_id', testUserId)
          .catch(() => {}),
        supabase
          .from('user_keys')
          .delete()
          .eq('user_id', testUserId)
          .catch(() => {}),
        supabase
          .from('user_preferences')
          .delete()
          .eq('user_id', testUserId)
          .catch(() => {}),
      ]);

      // Recreate client after cleanup
      this.resetClient();
    } catch (error) {
      console.warn('Test cleanup error (ignored):', error);
    }
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

// Enhanced test environment setup with isolation
export async function setupTestEnvironment() {
  try {
    // Reset client first
    testUtils.resetClient();

    // Reset database state
    await testUtils.cleanup();

    // Set test environment variables with isolation
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = supabaseAnonKey;
    process.env.SUPABASE_SERVICE_ROLE = supabaseServiceRoleKey;

    // Ensure test-specific env vars
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
  } catch (error) {
    console.warn('Test environment setup error (ignored):', error);
  }
}

// Enhanced test teardown with isolation
export async function teardownTestEnvironment() {
  try {
    await testUtils.cleanup();
  } catch (error) {
    console.warn('Test environment teardown error (ignored):', error);
  }
}

// Vitest setup for database tests
export const vitestSetup = {
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
