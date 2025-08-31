import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create hoisted mocks
const {
  mockCreateBrowserClient,
  mockCreateServerClient,
  mockCookies,
  mockIsSupabaseEnabled,
} = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn(),
  mockCreateServerClient: vi.fn(),
  mockCookies: vi.fn(),
  mockIsSupabaseEnabled: vi.fn(),
}));

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock config module
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: mockIsSupabaseEnabled,
  IS_SUPABASE_ENABLED: true,
  isDevelopmentMode: false,
  isRealtimeEnabled: true,
}));

// Store original environment
const originalEnv = process.env;

// Create mock client objects
const mockClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

describe('Supabase Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon_key',
      SUPABASE_SERVICE_ROLE: 'test_service_role',
      NODE_ENV: 'test',
    };

    // Setup default mock returns
    mockCreateBrowserClient.mockReturnValue(mockClient);
    mockCreateServerClient.mockReturnValue(mockClient);
    mockIsSupabaseEnabled.mockReturnValue(true);

    // Setup mock cookie store
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: 'test', value: 'value' }]),
      set: vi.fn(),
    };
    mockCookies.mockResolvedValue(mockCookieStore);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Browser Client', () => {
    it('should create browser client when Supabase is enabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(true);

      const { createClient } = await import('@/lib/supabase/client');

      const client = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_anon_key'
      );
      expect(client).toBe(mockClient);
    });

    it('should return null when URL contains placeholder', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/client');

      const client = createClient();
      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should return null when key contains placeholder', async () => {
      mockIsSupabaseEnabled.mockReturnValue(false);

      const { createClient } = await import('@/lib/supabase/client');

      const client = createClient();
      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should throw error when URL is missing', async () => {
      mockIsSupabaseEnabled.mockReturnValue(true);
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';

      const { createClient } = await import('@/lib/supabase/client');

      expect(() => createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });
  });

  describe('Server Client', () => {
    it('should create server client with cookies when enabled', async () => {
      mockIsSupabaseEnabled.mockReturnValue(true);

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
      mockIsSupabaseEnabled.mockReturnValue(true);

      const mockCookieStore = {
        getAll: vi.fn(() => [{ name: 'session', value: 'token123' }]),
        set: vi.fn(),
      };
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
      mockIsSupabaseEnabled.mockReturnValue(true);

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
      mockIsSupabaseEnabled.mockReturnValue(true);

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
      mockIsSupabaseEnabled.mockReturnValue(true);

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
    it('should detect enabled configuration', async () => {
      // Test the actual config module with proper environment
      vi.unmock('@/lib/supabase/config');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'test';

      vi.resetModules();
      const { isSupabaseEnabled } = await import('@/lib/supabase/config');
      expect(isSupabaseEnabled()).toBe(true);

      // Re-mock for other tests
      vi.doMock('@/lib/supabase/config', () => ({
        isSupabaseEnabled: mockIsSupabaseEnabled,
        IS_SUPABASE_ENABLED: true,
        isDevelopmentMode: false,
        isRealtimeEnabled: true,
      }));
    });

    it('should detect disabled with placeholder URL', async () => {
      vi.unmock('@/lib/supabase/config');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'test';

      vi.resetModules();
      const { isSupabaseEnabled } = await import('@/lib/supabase/config');
      expect(isSupabaseEnabled()).toBe(false);

      vi.doMock('@/lib/supabase/config', () => ({
        isSupabaseEnabled: mockIsSupabaseEnabled,
        IS_SUPABASE_ENABLED: true,
        isDevelopmentMode: false,
        isRealtimeEnabled: true,
      }));
    });

    it('should detect disabled with placeholder key', async () => {
      vi.unmock('@/lib/supabase/config');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder_anon_key';
      process.env.NODE_ENV = 'test';

      vi.resetModules();
      const { isSupabaseEnabled } = await import('@/lib/supabase/config');
      expect(isSupabaseEnabled()).toBe(false);

      vi.doMock('@/lib/supabase/config', () => ({
        isSupabaseEnabled: mockIsSupabaseEnabled,
        IS_SUPABASE_ENABLED: true,
        isDevelopmentMode: false,
        isRealtimeEnabled: true,
      }));
    });

    it('should handle development mode', async () => {
      vi.unmock('@/lib/supabase/config');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'development';

      vi.resetModules();
      const { isDevelopmentMode } = await import('@/lib/supabase/config');
      expect(isDevelopmentMode).toBe(true);

      vi.doMock('@/lib/supabase/config', () => ({
        isSupabaseEnabled: mockIsSupabaseEnabled,
        IS_SUPABASE_ENABLED: true,
        isDevelopmentMode: false,
        isRealtimeEnabled: true,
      }));
    });

    it('should handle realtime settings', async () => {
      vi.unmock('@/lib/supabase/config');

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'production';

      vi.resetModules();
      const { isRealtimeEnabled } = await import('@/lib/supabase/config');
      expect(isRealtimeEnabled).toBe(true);

      vi.doMock('@/lib/supabase/config', () => ({
        isSupabaseEnabled: mockIsSupabaseEnabled,
        IS_SUPABASE_ENABLED: true,
        isDevelopmentMode: false,
        isRealtimeEnabled: true,
      }));
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client creation errors', async () => {
      mockIsSupabaseEnabled.mockReturnValue(true);
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      const { createClient } = await import('@/lib/supabase/client');
      expect(() => createClient()).toThrow('Failed to create client');
    });

    it('should handle cookie errors in server client', async () => {
      mockIsSupabaseEnabled.mockReturnValue(true);
      mockCookies.mockRejectedValue(new Error('Cookie access failed'));

      const { createClient } = await import('@/lib/supabase/server');
      await expect(createClient()).rejects.toThrow('Cookie access failed');
    });
  });
});
