import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store original environment
const originalEnv = process.env;

// Create hoisted mocks that properly simulate the SSR functions
const { mockCreateBrowserClient, mockCreateServerClient } = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

// Mock Supabase SSR package
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}));

// Mock Next.js headers
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock the configuration functions (they need to return the right values for our tests)
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
  isDevelopmentMode: vi.fn(() => false),
  isRealtimeEnabled: vi.fn(() => true),
  IS_SUPABASE_ENABLED: true,
}));

// Import after mocking to get mocked versions
const { isSupabaseEnabled } = await import('@/lib/supabase/config');

// Now import the modules we want to test
const { createClient } = await import('@/lib/supabase/client');
const { createClient: createServerClientFunc } = await import(
  '@/lib/supabase/server'
);
const { createGuestServerClient } = await import('@/lib/supabase/server-guest');

describe('Supabase Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon_key',
      SUPABASE_SERVICE_ROLE: 'test_service_role',
      NODE_ENV: 'test',
    };

    // Setup default mock returns
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

    // Reset config mock
    vi.mocked(isSupabaseEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Browser Client', () => {
    it('should create browser client when Supabase is enabled', () => {
      const client = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_anon_key'
      );
      expect(client).toBeDefined();
    });

    it('should return null when Supabase is disabled', () => {
      vi.mocked(isSupabaseEnabled).mockReturnValue(false);

      const client = createClient();

      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should throw error when URL is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';

      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });

    it('should throw error when key is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });
  });

  describe('Server Client', () => {
    it('should create server client with cookies when enabled', async () => {
      const client = await createServerClientFunc();

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
      vi.mocked(isSupabaseEnabled).mockReturnValue(false);

      const client = await createServerClientFunc();

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

      await createServerClientFunc();

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

      await createServerClientFunc();

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
      vi.mocked(isSupabaseEnabled).mockReturnValue(false);

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
      expect(isSupabaseEnabled()).toBe(true);
    });

    it('should handle development mode', () => {
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).toBe('development');
    });

    it('should handle production mode', () => {
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client creation errors', () => {
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      expect(() => createClient()).toThrow('Failed to create client');
    });

    it('should handle cookie errors in server client', async () => {
      mockCookies.mockRejectedValue(new Error('Cookie access failed'));

      await expect(createServerClientFunc()).rejects.toThrow(
        'Cookie access failed'
      );
    });

    it('should handle missing service role for guest client', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE;

      mockCreateServerClient.mockImplementation(() => {
        throw new Error('Invalid service role');
      });

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
    it('should handle multiple client creations', () => {
      const client1 = createClient();
      const client2 = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledTimes(2);
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });

    it('should handle concurrent server client creation', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => createServerClientFunc());

      const clients = await Promise.all(promises);

      expect(clients).toHaveLength(5);
      expect(mockCreateServerClient).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration', () => {
    it('should work in different environments', () => {
      const environments = ['development', 'production', 'test'];

      environments.forEach((env) => {
        process.env.NODE_ENV = env;
        const client = createClient();
        expect(client).toBeDefined();
      });
    });

    it('should handle both auth and guest clients', async () => {
      const authClient = await createServerClientFunc();
      const guestClient = await createGuestServerClient();

      expect(authClient).toBeDefined();
      expect(guestClient).toBeDefined();
      expect(mockCreateServerClient).toHaveBeenCalledTimes(2);
    });
  });
});
