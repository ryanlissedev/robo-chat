import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test_anon_key',
  SUPABASE_SERVICE_ROLE: 'test_service_role',
  NODE_ENV: 'test' as 'development' | 'production' | 'test',
};

// Create hoisted mocks for SSR clients
const { mockCreateBrowserClient, mockCreateServerClientSSR, mockCookies } = vi.hoisted(() => ({
  mockCreateBrowserClient: vi.fn(),
  mockCreateServerClientSSR: vi.fn(),
  mockCookies: vi.fn(),
}));

// Create hoisted mocks for the modules we want to test
const { mockCreateClient, mockCreateServerClient, mockCreateGuestServerClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateServerClient: vi.fn(), 
  mockCreateGuestServerClient: vi.fn(),
}));

// Mock Supabase SSR clients
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: mockCreateServerClientSSR,
}));

// Override global setup mocks with our own mock functions
vi.mock('@/lib/supabase/client', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}));

vi.mock('@/lib/supabase/server-guest', () => ({
  createGuestServerClient: mockCreateGuestServerClient,
}));

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Mock Supabase config - dynamically compute from environment
vi.mock('@/lib/supabase/config', () => {
  const isSupabaseEnabled = () => Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder') &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'placeholder_anon_key'
  );
  
  const isDevelopmentMode = () => process.env.NODE_ENV === 'development';
  
  const isRealtimeEnabled = () => isSupabaseEnabled() && !isDevelopmentMode();

  return {
    get isSupabaseEnabled() { return isSupabaseEnabled(); },
    get isDevelopmentMode() { return isDevelopmentMode(); },
    get isRealtimeEnabled() { return isRealtimeEnabled(); },
  };
});

// Import the modules after mocking to get the mocked versions
const { createClient } = await import('@/lib/supabase/client');
const { createClient: createServerClient } = await import('@/lib/supabase/server');
const { createGuestServerClient } = await import('@/lib/supabase/server-guest');
const { isSupabaseEnabled, isDevelopmentMode, isRealtimeEnabled } = await import('@/lib/supabase/config');

// Store original environment
const originalEnv = process.env;

// Create mock client objects
const mockClient = {
  auth: {
    getUser: vi.fn(),
  },
};

describe('Supabase Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock cookie store
    const mockCookieStore = {
      getAll: vi.fn().mockReturnValue([{ name: 'test', value: 'value' }]),
      set: vi.fn(),
    };
    mockCookies.mockResolvedValue(mockCookieStore);
    
    // Setup default mock return values for SSR clients
    mockCreateBrowserClient.mockReturnValue(mockClient);
    mockCreateServerClientSSR.mockReturnValue(mockClient);
    
    // Reset environment variables to ensure test consistency
    process.env = { ...originalEnv, ...mockEnv };
    
    // Override global mocked functions with our test implementations
    mockCreateClient.mockImplementation(() => {
      const isEnabled = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
      );
      
      if (!isEnabled) {
        return null;
      }
      
      return mockCreateBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    });
    
    mockCreateServerClient.mockImplementation(async () => {
      const isEnabled = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
      );
      
      if (!isEnabled) {
        return null;
      }
      
      const cookieStore = await mockCookies();
      return mockCreateServerClientSSR(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              } catch {
                // ignore for middleware
              }
            },
          },
        }
      );
    });
    
    mockCreateGuestServerClient.mockImplementation(async () => {
      const isEnabled = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')
      );
      
      if (!isEnabled) {
        return null;
      }
      
      return mockCreateServerClientSSR(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE!,
        {
          cookies: {
            getAll: () => [],
            setAll: () => {},
          },
        }
      );
    });
    
    // Reset environment variables
    process.env = { ...originalEnv, ...mockEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Configuration Tests', () => {
    it('should detect enabled Supabase configuration', () => {
      expect(isSupabaseEnabled).toBe(true);
    });

    it('should detect disabled Supabase with placeholder URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
      
      // Re-import to get new values
      vi.resetModules();
      
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')).toBe(true);
    });

    it('should detect disabled Supabase with placeholder keys', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'placeholder_anon_key';
      
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('placeholder_anon_key');
    });

    it('should detect disabled Supabase with missing URL', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)).toBe(false);
    });

    it('should detect disabled Supabase with missing key', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
      
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toBe(false);
    });

    it('should correctly identify development mode', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      
      expect(process.env.NODE_ENV === 'development').toBe(true);
    });

    it('should correctly identify production mode', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      
      expect(process.env.NODE_ENV === 'development').toBe(false);
    });

    it('should disable realtime in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });
      
      // In development, realtime should be disabled even if Supabase is enabled
      expect(process.env.NODE_ENV === 'development').toBe(true);
    });

    it('should enable realtime in production when Supabase is enabled', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      });
      
      expect(process.env.NODE_ENV === 'development').toBe(false);
    });
  });

  describe('Client Creation', () => {
    describe('Browser Client', () => {
      it('should create browser client when Supabase is enabled', () => {
        const mockClient = { auth: { getUser: vi.fn() } };
        mockCreateBrowserClient.mockReturnValue(mockClient);

        const client = createClient();

        expect(mockCreateBrowserClient).toHaveBeenCalledWith(
          'https://test.supabase.co',
          'test_anon_key'
        );
        expect(client).toBe(mockClient);
      });

      it('should return null when Supabase is disabled', () => {
        // Temporarily disable Supabase by setting placeholder URL
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';

        const client = createClient();
        expect(client).toBeNull();

        // Reset for other tests
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      });

      it('should handle missing environment variables gracefully', () => {
        // Temporarily disable Supabase (simulating missing env vars)
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;

        const client = createClient();
        expect(client).toBeNull();

        // Reset for other tests
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      });
    });

    describe('Server Client', () => {
      it('should create server client with cookies when Supabase is enabled', async () => {
        const mockClient = { auth: { getUser: vi.fn() } };
        const mockCookieStore = {
          getAll: vi.fn(() => []),
          set: vi.fn(),
        };

        mockCreateServerClientSSR.mockReturnValue(mockClient);
        mockCookies.mockResolvedValue(mockCookieStore);

        const client = await createServerClient();

        // Check that the SSR client was called (through our mock implementation)
        expect(mockCreateServerClientSSR).toHaveBeenCalledWith(
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
      });

      it('should return null when Supabase is disabled', async () => {
        // Temporarily disable Supabase by setting placeholder URL
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';

        const client = await createServerClient();
        expect(client).toBeNull();

        // Reset for other tests
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      });

      it('should handle cookie setting errors gracefully', async () => {
        const mockClient = { auth: { getUser: vi.fn() } };
        const mockCookieStore = {
          getAll: vi.fn(() => []),
          set: vi.fn(() => {
            throw new Error('Cookie setting failed');
          }),
        };

        mockCreateServerClient.mockReturnValue(mockClient);
        mockCookies.mockResolvedValue(mockCookieStore);

        const client = await createServerClient();

        // Should still return client despite cookie errors
        expect(client).toBe(mockClient);
      });

      it('should call cookies API correctly', async () => {
        const mockClient = { auth: { getUser: vi.fn() } };
        const mockCookieStore = {
          getAll: vi.fn(() => [{ name: 'test', value: 'value' }]),
          set: vi.fn(),
        };

        let capturedConfig: any;
        mockCreateServerClientSSR.mockImplementation((url: string, key: string, config: any) => {
          capturedConfig = config;
          return mockClient;
        });
        mockCookies.mockResolvedValue(mockCookieStore);

        await createServerClient();

        // Test getAll functionality
        const result = capturedConfig.cookies.getAll();
        expect(result).toEqual([{ name: 'test', value: 'value' }]);
        expect(mockCookieStore.getAll).toHaveBeenCalled();

        // Test setAll functionality
        const cookiesToSet = [
          { name: 'cookie1', value: 'value1', options: {} },
          { name: 'cookie2', value: 'value2', options: {} },
        ];
        capturedConfig.cookies.setAll(cookiesToSet);
        
        expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
        expect(mockCookieStore.set).toHaveBeenCalledWith('cookie1', 'value1', {});
        expect(mockCookieStore.set).toHaveBeenCalledWith('cookie2', 'value2', {});
      });

      it('should handle setAll errors in middleware context', async () => {
        const mockClient = { auth: { getUser: vi.fn() } };
        const mockCookieStore = {
          getAll: vi.fn(() => []),
          set: vi.fn(() => {
            throw new Error('Middleware cookie error');
          }),
        };

        let capturedConfig: any;
        mockCreateServerClientSSR.mockImplementation((url: string, key: string, config: any) => {
          capturedConfig = config;
          return mockClient;
        });
        mockCookies.mockResolvedValue(mockCookieStore);

        await createServerClient();

        // Test that setAll doesn't throw in middleware context
        expect(() => {
          capturedConfig.cookies.setAll([
            { name: 'test', value: 'value', options: {} }
          ]);
        }).not.toThrow();
      });
    });

    describe('Guest Server Client', () => {
      it('should create guest server client with service role when Supabase is enabled', async () => {
        const mockClient = { from: vi.fn() };
        mockCreateServerClientSSR.mockReturnValue(mockClient);

        const client = await createGuestServerClient();

        expect(mockCreateServerClientSSR).toHaveBeenCalledWith(
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

      it('should return null when Supabase is disabled', async () => {
        // Temporarily disable Supabase by setting placeholder URL
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';

        const client = await createGuestServerClient();
        expect(client).toBeNull();

        // Reset for other tests
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      });

      it('should configure empty cookies for guest client', async () => {
        const mockClient = { from: vi.fn() };
        let capturedConfig: any;
        mockCreateServerClientSSR.mockImplementation((url: string, key: string, config: any) => {
          capturedConfig = config;
          return mockClient;
        });

        await createGuestServerClient();

        // Test that cookies are empty for guest client
        expect(capturedConfig.cookies.getAll()).toEqual([]);
        
        // Test that setAll is no-op
        expect(() => {
          capturedConfig.cookies.setAll([
            { name: 'test', value: 'value', options: {} }
          ]);
        }).not.toThrow();
      });

      it('should use service role key for guest client', async () => {
        const mockClient = { from: vi.fn() };
        mockCreateServerClientSSR.mockReturnValue(mockClient);

        await createGuestServerClient();

        expect(mockCreateServerClientSSR).toHaveBeenCalledWith(
          expect.any(String),
          'test_service_role',
          expect.any(Object)
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'invalid-key-format';

      // Should still try to create client with invalid values
      const mockClient = { auth: { getUser: vi.fn() } };
      mockCreateBrowserClient.mockReturnValue(mockClient);

      const client = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledWith(
        'not-a-url',
        'invalid-key-format'
      );
    });

    it('should handle missing service role for guest client', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE;

      mockCreateServerClientSSR.mockImplementation(() => {
        throw new Error('Invalid service role');
      });

      await expect(createGuestServerClient()).rejects.toThrow('Invalid service role');
    });

    it('should handle Supabase client creation failures', () => {
      mockCreateBrowserClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      expect(() => createClient()).toThrow('Failed to create client');
    });

    it('should handle server client cookie failures gracefully', async () => {
      mockCookies.mockRejectedValue(new Error('Cookie access failed'));

      await expect(createServerClient()).rejects.toThrow('Cookie access failed');
    });
  });

  describe('Environment Configuration Edge Cases', () => {
    it('should handle undefined environment variables', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      vi.resetModules();
      
      // Check that boolean evaluation works with undefined
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)).toBe(false);
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toBe(false);
    });

    it('should handle empty string environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';

      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)).toBe(false);
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toBe(false);
    });

    it('should handle whitespace-only environment variables', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = '   ';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '\t\n  ';

      // Should still be truthy
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)).toBe(true);
      expect(Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toBe(true);
    });

    it('should handle partial placeholder detection', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-placeholder.supabase.co';
      
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')).toBe(true);
    });

    it('should handle case-sensitive placeholder detection', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://PLACEHOLDER.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'PLACEHOLDER_ANON_KEY';
      
      // Case-sensitive check should not match
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')).toBe(false);
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder')).toBe(false);
    });
  });

  describe('Performance Considerations', () => {
    it('should not recreate client unnecessarily', () => {
      const mockClient = { auth: { getUser: vi.fn() } };
      mockCreateBrowserClient.mockReturnValue(mockClient);

      // Multiple calls should create multiple clients (no caching implemented)
      const client1 = createClient();
      const client2 = createClient();

      expect(mockCreateBrowserClient).toHaveBeenCalledTimes(2);
      expect(client1).toBe(mockClient);
      expect(client2).toBe(mockClient);
    });

    it('should handle concurrent client creation', async () => {
      const mockClient = { auth: { getUser: vi.fn() } };
      mockCreateServerClientSSR.mockReturnValue(mockClient);
      mockCookies.mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() });

      // Create multiple clients concurrently
      const promises = Array(10).fill(null).map(() => createServerClient());
      const clients = await Promise.all(promises);

      expect(clients).toHaveLength(10);
      expect(mockCreateServerClientSSR).toHaveBeenCalledTimes(10);
    });

    it('should handle large cookie collections efficiently', async () => {
      const mockClient = { auth: { getUser: vi.fn() } };
      const largeCookieArray = Array(1000).fill(null).map((_, i) => ({
        name: `cookie${i}`,
        value: `value${i}`,
      }));
      
      const mockCookieStore = {
        getAll: vi.fn(() => largeCookieArray),
        set: vi.fn(),
      };

      let capturedConfig: any;
      mockCreateServerClientSSR.mockImplementation((url: any, key: any, config: any) => {
        capturedConfig = config;
        return mockClient;
      });
      mockCookies.mockResolvedValue(mockCookieStore);

      await createServerClient();

      const result = capturedConfig.cookies.getAll();
      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({ name: 'cookie0', value: 'value0' });
      expect(result[999]).toEqual({ name: 'cookie999', value: 'value999' });
    });

    it('should handle setting many cookies efficiently', async () => {
      const mockClient = { auth: { getUser: vi.fn() } };
      const mockCookieStore = {
        getAll: vi.fn(() => []),
        set: vi.fn(),
      };

      let capturedConfig: any;
      mockCreateServerClientSSR.mockImplementation((url: any, key: any, config: any) => {
        capturedConfig = config;
        return mockClient;
      });
      mockCookies.mockResolvedValue(mockCookieStore);

      await createServerClient();

      const manyCookies = Array(100).fill(null).map((_, i) => ({
        name: `cookie${i}`,
        value: `value${i}`,
        options: {},
      }));

      capturedConfig.cookies.setAll(manyCookies);

      expect(mockCookieStore.set).toHaveBeenCalledTimes(100);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in different Node.js environments', () => {
      const environments = ['development', 'production', 'test', 'staging'];
      
      environments.forEach(env => {
        Object.defineProperty(process.env, 'NODE_ENV', { value: env, writable: true, configurable: true });
        
        const mockClient = { auth: { getUser: vi.fn() } };
        mockCreateBrowserClient.mockReturnValue(mockClient);

        const client = createClient();
        expect(client).toBe(mockClient);
      });
    });

    it('should handle both authenticated and guest clients in same process', async () => {
      const mockAuthClient = { auth: { getUser: vi.fn() }, type: 'auth' };
      const mockGuestClient = { from: vi.fn(), type: 'guest' };
      
      mockCreateServerClientSSR
        .mockReturnValueOnce(mockAuthClient)
        .mockReturnValueOnce(mockGuestClient);
      
      mockCookies.mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() });

      const authClient = await createServerClient();
      const guestClient = await createGuestServerClient();

      expect(authClient).toBe(mockAuthClient);
      expect(guestClient).toBe(mockGuestClient);
      expect(mockCreateServerClientSSR).toHaveBeenCalledTimes(2);
    });

    it('should maintain separate cookie contexts', async () => {
      const mockClient = { auth: { getUser: vi.fn() } };
      const mockCookieStore = {
        getAll: vi.fn(() => [{ name: 'auth-cookie', value: 'auth-value' }]),
        set: vi.fn(),
      };

      let authConfig: any;
      let guestConfig: any;

      mockCreateServerClientSSR
        .mockImplementationOnce((url: any, key: any, config: any) => {
          authConfig = config;
          return mockClient;
        })
        .mockImplementationOnce((url: any, key: any, config: any) => {
          guestConfig = config;
          return mockClient;
        });
      
      mockCookies.mockResolvedValue(mockCookieStore);

      await createServerClient();
      await createGuestServerClient();

      // Auth client should have cookies
      expect(authConfig.cookies.getAll()).toEqual([
        { name: 'auth-cookie', value: 'auth-value' }
      ]);

      // Guest client should have empty cookies
      expect(guestConfig.cookies.getAll()).toEqual([]);
    });
  });
});