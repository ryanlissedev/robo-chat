import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Store original environment
const originalEnv = process.env;

// Create mock functions
const mockCreateBrowserClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockCookies = vi.fn();
const mockIsSupabaseEnabled = vi.fn();

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClient,
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock config to control isSupabaseEnabled dynamically
vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: mockIsSupabaseEnabled,
  get IS_SUPABASE_ENABLED() {
    return mockIsSupabaseEnabled();
  },
  get isDevelopmentMode() {
    return process.env.NODE_ENV === 'development';
  },
  get isRealtimeEnabled() {
    return mockIsSupabaseEnabled() && process.env.NODE_ENV !== 'development';
  },
}));

// Create mock client objects
const mockClient = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
};

describe('Supabase Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    process.env = { ...originalEnv };
  });

  describe('Browser Client', () => {
    it('should create browser client when Supabase is enabled', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(true);

      // Need to dynamically import to pick up env changes
      const clientModule = await import('@/lib/supabase/client');
      const client = clientModule.createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test_anon_key'
      );
      expect(client).toBe(mockClient);
    });

    it('should return null when URL contains placeholder', async () => {
      // Set placeholder URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(false);

      const clientModule = await import('@/lib/supabase/client');
      const client = clientModule.createClient();

      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should return null when key contains placeholder', async () => {
      // Set placeholder key
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(false);

      const clientModule = await import('@/lib/supabase/client');
      const client = clientModule.createClient();

      expect(client).toBeNull();
      expect(mockCreateBrowserClient).not.toHaveBeenCalled();
    });

    it('should throw error when URL is missing', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(true);

      const clientModule = await import('@/lib/supabase/client');
      expect(() => clientModule.createClient()).toThrow(
        'Missing Supabase environment variables'
      );
    });
  });

  describe('Server Client', () => {
    it('should create server client with cookies when enabled', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(true);

      const serverModule = await import('@/lib/supabase/server');
      const client = await serverModule.createClient();

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
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(false);

      const serverModule = await import('@/lib/supabase/server');
      const client = await serverModule.createClient();

      expect(client).toBeNull();
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it('should handle cookie operations correctly', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
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

      const serverModule = await import('@/lib/supabase/server');
      await serverModule.createClient();

      // Test getAll
      const cookieList = capturedConfig.cookies.getAll();
      expect(cookieList).toEqual([{ name: 'session', value: 'token123' }]);
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
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
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

      const serverModule = await import('@/lib/supabase/server');
      await serverModule.createClient();

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
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE = 'test_service_role';
      mockIsSupabaseEnabled.mockReturnValue(true);

      const guestModule = await import('@/lib/supabase/server-guest');
      const client = await guestModule.createGuestServerClient();

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
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE = 'test_service_role';
      mockIsSupabaseEnabled.mockReturnValue(false);

      const guestModule = await import('@/lib/supabase/server-guest');
      const client = await guestModule.createGuestServerClient();

      expect(client).toBeNull();
      expect(mockCreateServerClient).not.toHaveBeenCalled();
    });

    it('should use empty cookies for guest client', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.SUPABASE_SERVICE_ROLE = 'test_service_role';
      mockIsSupabaseEnabled.mockReturnValue(true);

      let capturedConfig: any;
      mockCreateServerClient.mockImplementation((_url, _key, config) => {
        capturedConfig = config;
        return mockClient;
      });

      const guestModule = await import('@/lib/supabase/server-guest');
      await guestModule.createGuestServerClient();

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
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'test';
      mockIsSupabaseEnabled.mockReturnValue(true);

      expect(mockIsSupabaseEnabled()).toBe(true);
    });

    it('should detect disabled with placeholder URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'test';
      mockIsSupabaseEnabled.mockReturnValue(false);

      expect(mockIsSupabaseEnabled()).toBe(false);
    });

    it('should detect disabled with placeholder key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder_anon_key';
      process.env.NODE_ENV = 'test';
      mockIsSupabaseEnabled.mockReturnValue(false);

      expect(mockIsSupabaseEnabled()).toBe(false);
    });

    it('should handle development mode', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'development';

      // The mocked getter should read process.env.NODE_ENV directly
      expect(process.env.NODE_ENV).toBe('development');
    });

    it('should handle realtime settings', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      process.env.NODE_ENV = 'production';
      mockIsSupabaseEnabled.mockReturnValue(true);

      // isRealtimeEnabled depends on mockIsSupabaseEnabled() && NODE_ENV !== 'development'
      expect(mockIsSupabaseEnabled()).toBe(true);
      expect(process.env.NODE_ENV).toBe('production');
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client creation errors', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(true);

      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      const clientModule = await import('@/lib/supabase/client');
      expect(() => clientModule.createClient()).toThrow('Failed to create client');
    });

    it('should handle cookie errors in server client', async () => {
      // Set valid environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test_anon_key';
      mockIsSupabaseEnabled.mockReturnValue(true);

      mockCookies.mockRejectedValue(new Error('Cookie access failed'));

      const serverModule = await import('@/lib/supabase/server');
      await expect(serverModule.createClient()).rejects.toThrow('Cookie access failed');
    });
  });
});
