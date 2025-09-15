import { vi } from 'vitest';

/**
 * Standardized Supabase test mocks and utilities
 * Use these across all test files to ensure consistency
 */

// Store original environment for restoration
export const originalEnv = process.env;

// Standard test environment variables
export const TEST_ENV_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon_key_123456789',
  SUPABASE_SERVICE_ROLE: 'test_service_role_987654321',
  NODE_ENV: 'test',
} as const;

// Placeholder environment variables for disabled state
export const PLACEHOLDER_ENV_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder_anon_key',
  SUPABASE_SERVICE_ROLE: 'placeholder_service_role',
  NODE_ENV: 'test',
} as const;

/**
 * Create standardized Supabase client mock
 */
export function createMockSupabaseClient(overrides?: Record<string, any>) {
  const defaultMethods = {
    // Auth methods
    auth: {
      getUser: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
    },

    // Database query chain
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(),
            single: vi.fn(),
          })),
          maybeSingle: vi.fn(),
          single: vi.fn(),
        })),
        maybeSingle: vi.fn(),
        single: vi.fn(),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(),
        })),
      })),
      upsert: vi.fn(() => ({
        select: vi.fn(),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),

    // RPC methods
    rpc: vi.fn(),

    // Storage methods
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        list: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },

    // Channel/Realtime methods
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    removeAllChannels: vi.fn(),
    getChannels: vi.fn(() => []),
  };

  return {
    ...defaultMethods,
    ...overrides,
  };
}

/**
 * Create hoisted mocks for Supabase SSR clients
 */
export function createHoistedSupabaseMocks() {
  return vi.hoisted(() => ({
    mockCreateBrowserClient: vi.fn(),
    mockCreateServerClient: vi.fn(),
    mockCookies: vi.fn(),
    mockIsSupabaseEnabled: vi.fn(),
    mockIsDevelopmentMode: vi.fn(),
    mockIsRealtimeEnabled: vi.fn(),
  }));
}

/**
 * Setup standard environment for Supabase tests
 */
export function setupTestEnvironment(enabled = true) {
  if (enabled) {
    process.env = {
      ...originalEnv,
      ...TEST_ENV_VARS,
    };
  } else {
    process.env = {
      ...originalEnv,
      ...PLACEHOLDER_ENV_VARS,
    };
  }
}

/**
 * Reset environment to original state
 */
export function resetEnvironment() {
  process.env = originalEnv;
}

/**
 * Create mock cookie store for server-side tests
 */
export function createMockCookieStore(cookies: Array<{ name: string; value: string }> = []) {
  return {
    getAll: vi.fn(() => cookies),
    set: vi.fn(),
    get: vi.fn((name: string) => cookies.find(c => c.name === name)),
    delete: vi.fn(),
    has: vi.fn((name: string) => cookies.some(c => c.name === name)),
  };
}

/**
 * Setup mock auth user data
 */
export function createMockAuthUser(userId = 'test-user-123', overrides?: Record<string, any>) {
  return {
    id: userId,
    email: `${userId}@test.com`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    aud: 'authenticated',
    role: 'authenticated',
    ...overrides,
  };
}

/**
 * Setup mock auth response
 */
export function createMockAuthResponse(user?: any, error?: any) {
  return {
    data: { user: user || null },
    error: error || null,
  };
}

/**
 * Setup mock database query response
 */
export function createMockDbResponse(data?: any, error?: any) {
  return {
    data: data || null,
    error: error || null,
  };
}

/**
 * Common mock implementations for successful auth flow
 */
export function setupSuccessfulAuthMocks(mocks: any, userId = 'test-user-123') {
  const mockClient = createMockSupabaseClient();
  const mockUser = createMockAuthUser(userId);
  const mockAuthResponse = createMockAuthResponse(mockUser);

  // Setup client creation
  mocks.mockCreateBrowserClient.mockReturnValue(mockClient);
  mocks.mockCreateServerClient.mockReturnValue(mockClient);

  // Setup auth responses
  mockClient.auth.getUser.mockResolvedValue(mockAuthResponse);

  // Setup config
  mocks.mockIsSupabaseEnabled.mockReturnValue(true);
  mocks.mockIsDevelopmentMode.mockReturnValue(false);
  mocks.mockIsRealtimeEnabled.mockReturnValue(true);

  // Setup cookies
  const mockCookieStore = createMockCookieStore([
    { name: 'supabase-auth-token', value: 'mock-token' }
  ]);
  mocks.mockCookies.mockResolvedValue(mockCookieStore);

  return { mockClient, mockUser, mockAuthResponse, mockCookieStore };
}

/**
 * Common mock implementations for disabled Supabase
 */
export function setupDisabledSupabaseMocks(mocks: any) {
  mocks.mockCreateBrowserClient.mockReturnValue(null);
  mocks.mockCreateServerClient.mockReturnValue(null);
  mocks.mockIsSupabaseEnabled.mockReturnValue(false);
  mocks.mockIsDevelopmentMode.mockReturnValue(false);
  mocks.mockIsRealtimeEnabled.mockReturnValue(false);
}

/**
 * Setup mock for auth errors
 */
export function setupAuthErrorMocks(mocks: any, errorMessage = 'Authentication failed') {
  const mockClient = createMockSupabaseClient();
  const errorResponse = createMockAuthResponse(null, { message: errorMessage });

  mocks.mockCreateBrowserClient.mockReturnValue(mockClient);
  mocks.mockCreateServerClient.mockReturnValue(mockClient);
  mocks.mockIsSupabaseEnabled.mockReturnValue(true);

  mockClient.auth.getUser.mockResolvedValue(errorResponse);

  return { mockClient, errorResponse };
}

/**
 * Setup standard mock chain for database operations
 */
export function setupMockDbChain(mockClient: any, tableName = 'users') {
  const mockResponse = createMockDbResponse({ id: 'test-id' });

  const mockMaybeSingle = vi.fn().mockResolvedValue(mockResponse);
  const mockSingle = vi.fn().mockResolvedValue(mockResponse);
  const mockEq2 = vi.fn(() => ({ maybeSingle: mockMaybeSingle, single: mockSingle }));
  const mockEq1 = vi.fn(() => ({ eq: mockEq2, maybeSingle: mockMaybeSingle, single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq1, maybeSingle: mockMaybeSingle, single: mockSingle }));
  const mockInsert = vi.fn().mockResolvedValue(mockResponse);
  const mockUpsert = vi.fn().mockResolvedValue(mockResponse);

  mockClient.from.mockImplementation((table: string) => {
    if (table === tableName) {
      return {
        select: mockSelect,
        insert: mockInsert,
        upsert: mockUpsert,
      };
    }
    return mockClient.from.mockReturnValue({});
  });

  return {
    mockSelect,
    mockInsert,
    mockUpsert,
    mockEq1,
    mockEq2,
    mockMaybeSingle,
    mockSingle,
    mockResponse,
  };
}