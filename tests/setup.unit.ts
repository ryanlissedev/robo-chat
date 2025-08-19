import { beforeAll, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'

/**
 * Unit Test Setup
 * Configures mocks and test environment for isolated unit tests
 */

// Mock external dependencies before any imports
beforeAll(() => {
  console.log('🔧 Setting up unit test environment...')
  
  // Mock environment variables
  process.env.NODE_ENV = 'test'
  process.env.ENCRYPTION_KEY = 'unit-test-encryption-key-32-chars'
  process.env.ENCRYPTION_SALT = 'unit-test-salt'
  process.env.LANGSMITH_TRACING = 'false'
  
  // Mock crypto for consistent encryption tests
  Object.defineProperty(global, 'crypto', {
    value: {
      randomBytes: vi.fn((size: number) => Buffer.alloc(size, 'test')),
      pbkdf2Sync: vi.fn(() => Buffer.from('mocked-derived-key')),
      createCipheriv: vi.fn(() => ({
        update: vi.fn(() => 'encrypted'),
        final: vi.fn(() => ''),
        getAuthTag: vi.fn(() => Buffer.from('auth-tag'))
      })),
      createDecipheriv: vi.fn(() => ({
        setAuthTag: vi.fn(),
        setAAD: vi.fn(),
        update: vi.fn(() => 'decrypted'),
        final: vi.fn(() => '')
      }))
    },
    writable: true
  })

  // Mock Node.js modules
  vi.mock('crypto', async () => {
    const actual = await vi.importActual('crypto')
    return {
      ...actual,
      randomBytes: vi.fn((size: number) => Buffer.alloc(size, 'test')),
      pbkdf2Sync: vi.fn(() => Buffer.from('mocked-derived-key'))
    }
  })

  // Mock database connections
  vi.mock('../lib/db/drizzle', () => ({
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([]))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{}]))
        }))
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{}]))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    }
  }))

  // Mock Supabase client
  vi.mock('../lib/supabase/client', () => ({
    createClientComponentClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
        signOut: vi.fn(() => Promise.resolve()),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
      },
      from: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ data: [], error: null })),
        update: vi.fn(() => Promise.resolve({ data: [], error: null })),
        delete: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }))

  // Mock Next.js router
  vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      pathname: '/',
      query: {},
      asPath: '/'
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams())
  }))

  // Mock React hooks that might cause issues in tests
  vi.mock('react', async () => {
    const actual = await vi.importActual('react')
    return {
      ...actual,
      useEffect: vi.fn((fn, deps) => {
        // Execute effect immediately in tests unless deps change
        if (!deps || deps.length === 0) {
          fn()
        }
      }),
      useLayoutEffect: vi.fn((fn) => fn()) // Execute immediately
    }
  })

  // Mock localStorage and sessionStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null)
    },
    writable: true
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null)
    },
    writable: true
  })

  // Mock fetch for API calls
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      headers: new Headers(),
      redirected: false,
      statusText: 'OK',
      type: 'default' as ResponseType,
      url: '',
      clone: vi.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData())
    } as Response)
  )

  console.log('✅ Unit test environment ready')
})

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  
  // Reset localStorage and sessionStorage
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
    window.sessionStorage.clear()
  }
})

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
  vi.unstubAllGlobals()
})

// Extend expect with custom matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const pass = typeof received === 'string' && uuidRegex.test(received)
    
    return {
      message: () => `expected ${received} to be a valid UUID`,
      pass
    }
  },

  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const pass = typeof received === 'string' && emailRegex.test(received)
    
    return {
      message: () => `expected ${received} to be a valid email`,
      pass
    }
  },

  toBeWithinTimeRange(received, expected, toleranceMs = 1000) {
    const receivedTime = new Date(received).getTime()
    const expectedTime = new Date(expected).getTime()
    const diff = Math.abs(receivedTime - expectedTime)
    const pass = diff <= toleranceMs
    
    return {
      message: () => `expected ${received} to be within ${toleranceMs}ms of ${expected}, but was ${diff}ms away`,
      pass
    }
  }
})

// Global test utilities
declare global {
  var testUtils: {
    createMockUser: () => any
    createMockChat: () => any
    createMockMessage: () => any
    waitFor: (fn: () => boolean, timeout?: number) => Promise<void>
    mockApiResponse: (data: any, options?: { status?: number; delay?: number }) => void
  }

  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidUUID(): T
      toBeValidEmail(): T
      toBeWithinTimeRange(expected: string | Date, toleranceMs?: number): T
    }
  }
}

globalThis.testUtils = {
  createMockUser: () => ({
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    anonymous: false,
    createdAt: new Date().toISOString()
  }),

  createMockChat: () => ({
    id: 'chat-123',
    userId: 'user-123',
    title: 'Test Chat',
    model: 'gpt-4o',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),

  createMockMessage: () => ({
    id: 'message-123',
    chatId: 'chat-123',
    userId: 'user-123',
    role: 'user',
    content: 'Test message',
    createdAt: new Date().toISOString()
  }),

  waitFor: async (fn: () => boolean, timeout = 5000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (fn()) return
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    throw new Error(`waitFor timeout after ${timeout}ms`)
  },

  mockApiResponse: (data: any, options = {}) => {
    const { status = 200, delay = 0 } = options
    
    global.fetch = vi.fn(() =>
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: () => Promise.resolve(data),
            text: () => Promise.resolve(JSON.stringify(data)),
            headers: new Headers(),
            redirected: false,
            statusText: status === 200 ? 'OK' : 'Error',
            type: 'default' as ResponseType,
            url: '',
            clone: vi.fn(),
            body: null,
            bodyUsed: false,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            blob: () => Promise.resolve(new Blob()),
            formData: () => Promise.resolve(new FormData())
          } as Response)
        }, delay)
      })
    )
  }
}

export {}