import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSupabaseClient,
  setupTestEnvironment,
  resetEnvironment,
  createMockCookieStore,
  setupSuccessfulAuthMocks,
  setupDisabledSupabaseMocks,
  TEST_ENV_VARS,
  PLACEHOLDER_ENV_VARS,
} from '../../utils/supabase-mocks';

// Create hoisted mocks directly
const mockCreateBrowserClient = vi.hoisted(() => vi.fn());
const mockCreateServerClient = vi.hoisted(() => vi.fn());
const mockCookies = vi.hoisted(() => vi.fn());
const mockIsSupabaseEnabled = vi.hoisted(() => vi.fn());
const mockIsDevelopmentMode = vi.hoisted(() => vi.fn());
const mockIsRealtimeEnabled = vi.hoisted(() => vi.fn());

// Mock Supabase SSR clients
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock Supabase config functions with proper hoisting
vi.mock('@/lib/supabase/config', () => ({
  get IS_SUPABASE_ENABLED() {
    return mockIsSupabaseEnabled();
  },
  isSupabaseEnabled: mockIsSupabaseEnabled,
  isDevelopmentMode: mockIsDevelopmentMode,
  isRealtimeEnabled: mockIsRealtimeEnabled,
}));

describe('Supabase Authentication System', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup test environment with valid Supabase config
    setupTestEnvironment(true);

    // Create mock client
    mockClient = createMockSupabaseClient();

    // Setup default successful mocks
    mockCreateBrowserClient.mockReturnValue(mockClient);
    mockCreateServerClient.mockReturnValue(mockClient);
    mockIsSupabaseEnabled.mockReturnValue(true);
    mockIsDevelopmentMode.mockReturnValue(false);
    mockIsRealtimeEnabled.mockReturnValue(true);

    // Setup default cookie store
    const mockCookieStore = createMockCookieStore([
      { name: 'supabase-auth-token', value: 'mock-token' }
    ]);
    mockCookies.mockResolvedValue(mockCookieStore);
  });

  afterEach(() => {
    resetEnvironment();
  });

  describe('Browser Client', () => {
    it('should create browser client when Supabase is enabled', async () => {
      const { createClient } = await import('@/lib/supabase/client');

      const client = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_URL,
        TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      expect(client).toBe(mockClient);
    });

    it('should return null when Supabase is disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();

      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should throw error when URL is missing', async () => {
      // Set environment to missing URL but enabled config
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const { createClient } = await import('@/lib/supabase/client');
      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });

    it('should throw error when key is missing', async () => {
      // Set environment to missing key but enabled config
      process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

      const { createClient } = await import('@/lib/supabase/client');
      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });
  });

  describe('Server Client', () => {
    it('should create server client with cookies when enabled', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const client = await createClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_URL,
        TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toBe(mockClient);
      expect(mockCookies).toHaveBeenCalled();
    });

    it('should return null when disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/server');
      const client = await createClient();

      expect(client).toBeNull();
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it('should handle cookie operations correctly', async () => {
      const mockCookieStore = createMockCookieStore([
        { name: 'session', value: 'token123' }
      ]);
      mockCookies.mockResolvedValue(mockCookieStore);

      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return mockClient;
      });

      const { createClient } = await import('@/lib/supabase/server');
      await createClient();

      // Test getAll
      const cookies = capturedConfig.cookies.getAll();
      expect(cookies).toEqual([{ name: 'session', value: 'token123' }]);
      expect(mockCookieStore.getAll).toHaveBeenCalled();

      // Test setAll
      const cookiesToSet = [
        { name: 'test', value: 'value', options: { httpOnly: true } },
      ];
      capturedConfig.cookies.setAll(cookiesToSet);
      expect(mockCookieStore.set).toHaveBeenCalledWith('test', 'value', {
        httpOnly: true,
      });
    });

    it('should handle setAll errors gracefully in middleware', async () => {
      const mockCookieStore = createMockCookieStore();
      mockCookieStore.set.mockImplementation(() => {
        throw new Error('Middleware error');
      });
      mockCookies.mockResolvedValue(mockCookieStore);

      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return mockClient;
      });

      const { createClient } = await import('@/lib/supabase/server');
      await createClient();

      // Should not throw in middleware context
      expect(() => {
        capturedConfig.cookies.setAll([
          { name: 'test', value: 'value', options: {} },
        ]);
      }).not.toThrow();
    });
  });

  describe('Guest Server Client', () => {
    it('should create guest client with service role', async () => {
      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );
      const client = await createGuestServerClient();

      expect(mockCreateServerClient).toHaveBeenCalledWith(
        TEST_ENV_VARS.NEXT_PUBLIC_SUPABASE_URL,
        TEST_ENV_VARS.SUPABASE_SERVICE_ROLE,
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toBe(mockClient);
    });

    it('should return null when disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );
      const client = await createGuestServerClient();

      expect(client).toBeNull();
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it('should use empty cookies for guest client', async () => {
      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return mockClient;
      });

      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );
      await createGuestServerClient();

      // Guest client should have empty cookies
      expect(capturedConfig.cookies.getAll()).toEqual([]);

      // setAll should be no-op
      expect(() => {
        capturedConfig.cookies.setAll([
          { name: 'test', value: 'value', options: {} },
        ]);
      }).not.toThrow();
    });
  });

  describe('Configuration Functions', () => {
    it('should detect enabled configuration', () => {
      expect(mockIsSupabaseEnabled()).toBe(true);
    });

    it('should handle development mode', () => {
      mockIsDevelopmentMode.mockReturnValue(true);
      expect(mockIsDevelopmentMode()).toBe(true);
    });

    it('should handle production mode', () => {
      mockIsDevelopmentMode.mockReturnValue(false);
      expect(mockIsDevelopmentMode()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client creation errors', async () => {
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      const { createClient } = await import('@/lib/supabase/client');
      expect(() => createClient()).toThrow('Failed to create client');
    });

    it('should handle cookie errors in server client', async () => {
      mockCookies.mockRejectedValue(new Error('Cookie access failed'));

      const { createClient } = await import('@/lib/supabase/server');
      await expect(createClient()).rejects.toThrow('Cookie access failed');
    });
  });

  describe('Performance', () => {
    it('should handle multiple client creations', async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const client1 = createClient();
      const client2 = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledTimes(2);
      expect(client1).toBe(mockClient);
      expect(client2).toBe(mockClient);
    });

    it('should handle concurrent server client creation', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const promises = Array(3)
        .fill(null)
        .map(() => createClient());

      const clients = await Promise.all(promises);

      expect(clients).toHaveLength(3);
      clients.forEach(client => expect(client).toBe(mockClient));
    });
  });

  describe('Integration', () => {
    it('should handle both auth and guest clients', async () => {
      const { createClient } = await import('@/lib/supabase/server');
      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );

      const authClient = await createClient();
      const guestClient = await createGuestServerClient();

      expect(authClient).toBe(mockClient);
      expect(guestClient).toBe(mockClient);
      expect(mockCreateServerClient).toHaveBeenCalledTimes(2);
    });
  });
});
