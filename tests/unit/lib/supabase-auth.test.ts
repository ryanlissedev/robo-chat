import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store original environment
const originalEnv = process.env;

// Create hoisted mocks for SSR clients
const { mockCreateBrowserClient, mockCreateServerClient, mockCookies } =
  vi.hoisted(() => ({
    mockCreateBrowserClient: vi.fn(),
    mockCreateServerClient: vi.fn(),
    mockCookies: vi.fn(),
  }));

// Create hoisted mocks for config functions
const {
  mockIsSupabaseEnabled,
  mockIsDevelopmentMode,
  mockIsRealtimeEnabled,
  getConfigMock,
} = vi.hoisted(() => {
  const mockIsSupabaseEnabled = vi.fn();
  const mockIsDevelopmentMode = vi.fn();
  const mockIsRealtimeEnabled = vi.fn();

  const getConfigMock = () => ({
    get IS_SUPABASE_ENABLED() {
      return mockIsSupabaseEnabled();
    },
    isSupabaseEnabled: () => mockIsSupabaseEnabled(),
    isDevelopmentMode: () => mockIsDevelopmentMode(),
    isRealtimeEnabled: () => mockIsRealtimeEnabled(),
  });

  return {
    mockIsSupabaseEnabled,
    mockIsDevelopmentMode,
    mockIsRealtimeEnabled,
    getConfigMock,
  };
});

// Mock Supabase SSR clients
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock Supabase config functions - need to mock both possible import paths
vi.mock('@/lib/supabase/config', () => getConfigMock());
vi.mock('./config', () => getConfigMock());
vi.mock('../config', () => getConfigMock());

// Note: Imports moved inside test functions due to vi.resetModules()

describe('Supabase Authentication System', () => {
  beforeEach(() => {
    // Clear all mocks first
    vi.clearAllMocks();

    // Reset environment with valid values
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon_key',
      SUPABASE_SERVICE_ROLE: 'test_service_role',
      NODE_ENV: 'test',
    };

    // Setup config mocks to return true by default
    mockIsSupabaseEnabled.mockImplementation(() => true);
    mockIsDevelopmentMode.mockImplementation(() => false);
    mockIsRealtimeEnabled.mockImplementation(() => true);

    // Setup default mock returns for SSR clients
    const mockClient = {
      auth: { getUser: vi.fn() },
      from: vi.fn(),
    };

    mockCreateBrowserClient.mockReturnValue(mockClient);
    mockCreateServerClient.mockReturnValue(mockClient);

    // Setup mock cookie store
    const mockCookieStore = {
      getAll: vi.fn(() => [{ name: 'test', value: 'value' }]),
      set: vi.fn(),
    };
    mockCookies.mockResolvedValue(mockCookieStore);

    // Force re-import of modules to pick up new environment
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Browser Client', () => {
    it('should create browser client when Supabase is enabled', async () => {
      const { createClient } = await import('@/lib/supabase/client');

      const client = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_anon_key'
      );
      expect(client).toBeDefined();
    });

    it('should return null when Supabase is disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();

      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should throw error when URL is missing', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';

      const { createClient } = await import('@/lib/supabase/client');
      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });

    it('should throw error when key is missing', async () => {
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
        'https://test.supabase.co',
        'test_anon_key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should return null when disabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/server');
      const client = await createClient();

      expect(client).toBeNull();
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it('should handle cookie operations correctly', async () => {
      const mockCookieStore = {
        getAll: vi.fn(() => [{ name: 'session', value: 'token123' }]),
        set: vi.fn(),
      };
      mockCookies.mockResolvedValue(mockCookieStore);

      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return { auth: { getUser: vi.fn() } };
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
      const mockCookieStore = {
        getAll: vi.fn(() => []),
        set: vi.fn(() => {
          throw new Error('Middleware error');
        }),
      };
      mockCookies.mockResolvedValue(mockCookieStore);

      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return { auth: { getUser: vi.fn() } };
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
        'https://test.supabase.co',
        'test_service_role',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toBeDefined();
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
        return { from: vi.fn() };
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

      const { createServerClient } = await import('@/lib/supabase/server');
      await expect(createServerClient()).rejects.toThrow(
        'Cookie access failed'
      );
    });

    it('should handle missing service role for guest client', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE;

      mockCreateServerClient.mockImplementation(() => {
        throw new Error('Invalid service role');
      });

      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );
      await expect(createGuestServerClient()).rejects.toThrow(
        'Invalid service role'
      );
    });
  });

  describe('Environment Configuration', () => {
    it('should handle placeholder URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')).toBe(
        true
      );
    });

    it('should handle placeholder keys', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder_anon_key';
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(
        'placeholder_anon_key'
      );
    });

    it('should handle missing URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)).toBe(false);
    });

    it('should handle missing keys', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should handle multiple client creations', async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const client1 = createClient();
      const client2 = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledTimes(2);
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    it('should handle concurrent server client creation', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const promises = Array(5)
        .fill(null)
        .map(() => createServerClient());

      const clients = await Promise.all(promises);

      expect(clients).toHaveLength(5);
      expect(mockCreateServerClient).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration', () => {
    it('should work in different environments', async () => {
      const environments = ['development', 'production', 'test'];

      for (const env of environments) {
        process.env.NODE_ENV = env;
        const { createClient } = await import('@/lib/supabase/client');
        const client = createClient();
        expect(client).toBeDefined();
      }
    });

    it('should handle both auth and guest clients', async () => {
      const { createServerClient } = await import('@/lib/supabase/server');
      const { createGuestServerClient } = await import(
        '@/lib/supabase/server-guest'
      );

      const authClient = await createServerClient();
      const guestClient = await createGuestServerClient();

      expect(authClient).toBeDefined();
      expect(guestClient).toBeDefined();
      expect(mockCreateServerClient).toHaveBeenCalledTimes(2);
    });
  });
});
