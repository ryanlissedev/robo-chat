/**
 * Mock factories for creating test data and mocked dependencies
 * Provides consistent, reusable mocks for Supabase, authentication, API responses, and more
 */

import type {
  AuthError,
  AuthResponse,
  PostgrestError,
  PostgrestResponse,
  Session,
  User,
} from '@supabase/supabase-js';
import { vi } from 'vitest';

// ============================================================================
// Supabase Mock Factory
// ============================================================================

export interface MockSupabaseOptions {
  user?: Partial<User> | null;
  session?: Partial<Session> | null;
  error?: AuthError | null;
  isAuthenticated?: boolean;
}

export const createMockSupabaseClient = (
  options: MockSupabaseOptions = {}
): any => {
  const {
    user = null,
    session = null,
    error = null,
    isAuthenticated = false,
  } = options;

  const mockUser = user ? createMockUser(user) : undefined;
  const mockSession = session
    ? createMockSession({ ...session, user: mockUser })
    : null;

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: isAuthenticated ? mockUser : undefined },
        error: error,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: isAuthenticated ? mockSession : null },
        error: error,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: error,
      } as AuthResponse),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: error,
      } as AuthResponse),
      signOut: vi.fn().mockResolvedValue({
        error: error,
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        // Simulate auth state change
        if (isAuthenticated && mockSession) {
          callback('SIGNED_IN', mockSession);
        } else {
          callback('SIGNED_OUT', null);
        }
        return {
          data: { subscription: { unsubscribe: vi.fn() } },
          error: null,
        };
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: error,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
        error: error,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: error,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: null,
      error: undefined,
      count: null,
      status: 200,
      statusText: 'OK',
    } as unknown as PostgrestResponse<any>),
    maybeSingle: vi.fn().mockResolvedValue({
      data: null,
      error: undefined,
      count: null,
      status: 200,
      statusText: 'OK',
    } as unknown as PostgrestResponse<any>),
    then: vi.fn().mockResolvedValue({
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
    } as PostgrestResponse<any[]>),
    storage: {
      from: vi.fn().mockReturnThis(),
      upload: vi.fn().mockResolvedValue({
        data: { path: 'test-file.txt' },
        error: null,
      }),
      download: vi.fn().mockResolvedValue({
        data: new Blob(['test content']),
        error: null,
      }),
      remove: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      list: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null,
      }),
      createSignedUrls: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/public-url' },
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      off: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn().mockResolvedValue({ status: 'ok', error: null }),
      send: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn().mockResolvedValue({ status: 'ok', error: null }),
    removeAllChannels: vi.fn().mockResolvedValue([]),
    getChannels: vi.fn().mockReturnValue([]),
  } as any;
};

// ============================================================================
// User Mock Factory
// ============================================================================

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'mock-user-id',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  phone: undefined,
  confirmed_at: new Date().toISOString(),
  recovery_sent_at: undefined,
  role: 'authenticated',
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Session Mock Factory
// ============================================================================

export const createMockSession = (
  overrides: Partial<Session> = {}
): Session => ({
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token',
  user: createMockUser(),
  ...overrides,
});

// ============================================================================
// API Response Mock Factories
// ============================================================================

export interface MockApiResponseOptions<T = any> {
  data?: T;
  error?: string | null;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}

export const createMockApiResponse = <T = any>(
  options: MockApiResponseOptions<T> = {}
): Response => {
  const {
    data = null,
    error = null,
    status = 200,
    statusText = 'OK',
    headers = { 'Content-Type': 'application/json' },
  } = options;

  const responseBody = error ? { error, data: null } : { data, error: null };

  return new Response(JSON.stringify(responseBody), {
    status,
    statusText,
    headers: new Headers(headers),
  });
};

export const createMockStreamingResponse = (
  chunks: string[],
  options: Omit<MockApiResponseOptions, 'data'> = {}
): Response => {
  const {
    status = 200,
    statusText = 'OK',
    headers = { 'Content-Type': 'text/plain; charset=utf-8' },
  } = options;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          controller.enqueue(encoder.encode(chunk));
          if (index === chunks.length - 1) {
            controller.close();
          }
        }, index * 10);
      });
    },
  });

  return new Response(stream, {
    status,
    statusText,
    headers: new Headers(headers),
  });
};

// ============================================================================
// Chat Message Mock Factory
// ============================================================================

export interface MockChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const createMockChatMessage = (
  overrides: Partial<MockChatMessage> = {}
): MockChatMessage => ({
  id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  role: 'user',
  content: 'Test message content',
  timestamp: new Date().toISOString(),
  metadata: {},
  ...overrides,
});

export const createMockChatConversation = (
  messageCount: number = 3
): MockChatMessage[] => {
  return Array.from({ length: messageCount }, (_, index) =>
    createMockChatMessage({
      id: `msg-${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${index + 1} content`,
      timestamp: new Date(
        Date.now() - (messageCount - index) * 60000
      ).toISOString(),
    })
  );
};

// ============================================================================
// File Upload Mock Factory
// ============================================================================

export const createMockFile = (
  name: string = 'test-file.txt',
  content: string = 'test content',
  type: string = 'text/plain'
): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

export const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };

  // Add indexed access
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as FileList;
};

// ============================================================================
// Error Mock Factory
// ============================================================================

export const createMockError = (
  message: string = 'Test error',
  code: string = 'TEST_ERROR'
): AuthError =>
  ({
    message,
    name: 'AuthError',
    status: 400,
    code,
  }) as AuthError;

export const createMockPostgrestError = (
  message: string = 'Database error',
  code: string = 'PGRST116'
): PostgrestError => ({
  message,
  name: 'PostgrestError',
  code,
  details: 'Test error details',
  hint: 'Test error hint',
});

// ============================================================================
// LocalStorage Mock Factory
// ============================================================================

export const createMockLocalStorage = (): Storage => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    },
  };
};

// ============================================================================
// WebSocket Mock Factory
// ============================================================================

export const createMockWebSocket = (): any => {
  const mockWS = {
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    readyState: WebSocket.CONNECTING,
    bufferedAmount: 0,
    extensions: '',
    protocol: '',
    url: 'wss://example.com',
    binaryType: 'blob' as BinaryType,
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
  };

  return mockWS as any;
};

// ============================================================================
// Environment Mock Factory
// ============================================================================

export const createMockEnvironment = (
  overrides: Record<string, string> = {}
): void => {
  const mockEnv = {
    NODE_ENV: 'test',
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    ENCRYPTION_KEY: Buffer.from('a'.repeat(32)).toString('base64'),
    ...overrides,
  };

  Object.keys(mockEnv).forEach((key) => {
    process.env[key] = mockEnv[key as keyof typeof mockEnv];
  });
};

// ============================================================================
// Cleanup Utilities
// ============================================================================

export const resetAllMocks = (): void => {
  vi.clearAllMocks();
  vi.resetAllMocks();
  vi.restoreAllMocks();
};

export const cleanupMockEnvironment = (keys: string[]): void => {
  keys.forEach((key) => {
    delete process.env[key];
  });
};
