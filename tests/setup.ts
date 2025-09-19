import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { act } from '@testing-library/react';

// Make vi available globally to prevent "vi.mock is not a function" errors
globalThis.vi = vi;

// Make act available globally to ensure proper React state handling
globalThis.act = act;

// Ensure React act() is enabled for the testing environment (React 19+)
// https://react.dev/blog/2024/04/25/react-19-upgrade-guide#testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).IS_REACT_ACT_ENVIRONMENT = true;
}
process.env.IS_REACT_ACT_ENVIRONMENT = 'true';

// Override console methods during tests to suppress act() warnings when using global act()
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    (msg.includes('Warning: The current testing environment is not configured to support act(...)') ||
     msg.includes('An update to') && msg.includes('inside a test was not wrapped in act'))
  ) {
    return; // Suppress React act() warnings - we handle this properly with global act()
  }
  originalConsoleError(...args);
};

// Enhance vi.fn to include Jest-style methods automatically
const originalViFn = vi.fn;
vi.fn = ((impl?: any) => {
  const mock = originalViFn(impl);
  // Add Jest-style methods for compatibility
  mock.mockResolvedValue = (value: any) => {
    mock.mockImplementation(() => Promise.resolve(value));
    return mock;
  };
  mock.mockResolvedValueOnce = (value: any) => {
    mock.mockImplementationOnce(() => Promise.resolve(value));
    return mock;
  };
  mock.mockRejectedValue = (value: any) => {
    mock.mockImplementation(() => Promise.reject(value));
    return mock;
  };
  mock.mockRejectedValueOnce = (value: any) => {
    mock.mockImplementationOnce(() => Promise.reject(value));
    return mock;
  };
  return mock;
}) as any;

// Helper function to add Jest-style methods to vi mocks
const createMockWithJestMethods = (baseMock: any) => {
  // Add Jest-style methods for compatibility
  baseMock.mockResolvedValue = (value: any) => {
    baseMock.mockImplementation(() => Promise.resolve(value));
    return baseMock;
  };
  baseMock.mockResolvedValueOnce = (value: any) => {
    baseMock.mockImplementationOnce(() => Promise.resolve(value));
    return baseMock;
  };
  baseMock.mockRejectedValue = (value: any) => {
    baseMock.mockImplementation(() => Promise.reject(value));
    return baseMock;
  };
  baseMock.mockRejectedValueOnce = (value: any) => {
    baseMock.mockImplementationOnce(() => Promise.reject(value));
    return baseMock;
  };
  return baseMock;
};

// Mock fetch globally for all tests with enhanced methods
const mockFetch = createMockWithJestMethods(vi.fn());
globalThis.fetch = mockFetch;

// Ensure DOM globals are available (sometimes happy-dom doesn't expose them properly)
if (typeof global.document === 'undefined') {
  global.document = globalThis.document || {
    body: { style: {} },
    createElement: () => ({ style: {} }),
    getElementsByTagName: () => [],
  } as any;
}

// Mock storage APIs for API key manager tests
const createMockStorage = () => {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    get length() {
      return storage.size;
    },
    key: vi.fn((index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] || null;
    }),
  };
};

if (typeof global.window === 'undefined') {
  global.window = globalThis.window || ({
    document: global.document,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getComputedStyle: () => ({
      getPropertyValue: () => '',
    }),
    localStorage: createMockStorage(),
    sessionStorage: createMockStorage(),
  } as any);
} else {
  // Enhance existing window object with storage mocks
  if (!global.window.localStorage) {
    global.window.localStorage = createMockStorage();
  }
  if (!global.window.sessionStorage) {
    global.window.sessionStorage = createMockStorage();
  }
}

// Make storage available globally
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = global.window.localStorage;
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = global.window.sessionStorage;
}

// Mock TextEncoder and TextDecoder for Web APIs (needed for crypto and fetch operations)
if (typeof globalThis.TextEncoder === 'undefined') {
  const MockTextEncoder = function TextEncoder() {
    this.encode = (str: string) => new Uint8Array(Buffer.from(str, 'utf8'));
    this.encoding = 'utf-8';
  };
  globalThis.TextEncoder = MockTextEncoder as any;
}

if (typeof globalThis.TextDecoder === 'undefined') {
  const MockTextDecoder = function TextDecoder(encoding = 'utf-8') {
    this.encoding = encoding;
    this.decode = (bytes: Uint8Array | ArrayBuffer) => {
      if (bytes instanceof ArrayBuffer) {
        bytes = new Uint8Array(bytes);
      }
      return Buffer.from(bytes).toString('utf8');
    };
  };
  globalThis.TextDecoder = MockTextDecoder as any;
}

// Global setup for all tests

// Ensure environment variables do not leak between tests
// We snapshot the environment at the start of every test and restore it afterward.
let __envBaseline: NodeJS.ProcessEnv | null = null;

beforeEach(() => {
  // Capture a shallow snapshot of current env just before each test begins
  __envBaseline = { ...process.env };
});

afterEach(() => {
  // Reset any vi.stubEnv calls first
  if (typeof (vi as any).unstubAllEnvs === 'function') {
    try {
      (vi as any).unstubAllEnvs();
    } catch {
      // ignore
    }
  }

  // Restore environment variables to the per-test baseline
  if (__envBaseline) {
    // Remove keys added during the test
    for (const key of Object.keys(process.env)) {
      if (!(key in __envBaseline)) {
        delete process.env[key];
      }
    }
    // Restore baseline values
    for (const [key, value] of Object.entries(__envBaseline)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value as string;
      }
    }
  }
});

// Mock motion/react (the new framer-motion import)
vi.mock('motion/react', () => {
  const motionProps = new Set([
    'animate', 'initial', 'exit', 'variants', 'transition', 'whileHover', 'whileTap',
    'whileFocus', 'whileDrag', 'whileInView', 'drag', 'dragConstraints', 'dragElastic',
    'dragMomentum', 'dragTransition', 'layoutId', 'layout', 'onAnimationStart',
    'onAnimationComplete', 'onUpdate', 'onDrag', 'onDragStart', 'onDragEnd'
  ]);

  const mockMotionCreate = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      // Filter out motion-specific props to prevent React warnings
      const filteredProps = Object.keys(otherProps).reduce((acc, key) => {
        if (!motionProps.has(key)) {
          acc[key] = otherProps[key];
        }
        return acc;
      }, {} as any);
      return React.createElement(component as any, filteredProps, children);
    };
    MotionComponent.displayName = `Motion(${typeof component === 'string' ? component : component.displayName || component.name || 'Component'})`;
    return MotionComponent;
  };

  const motion = {
    create: mockMotionCreate,
    div: mockMotionCreate('div'),
    span: mockMotionCreate('span'),
    button: mockMotionCreate('button'),
    input: mockMotionCreate('input'),
  };

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Reorder: {
      Group: ({ children, ...props }: any) => {
        const { children: reorderChildren, ...filteredProps } = props;
        Object.keys(filteredProps).forEach(key => {
          if (motionProps.has(key)) delete filteredProps[key];
        });
        return React.createElement('div', filteredProps, reorderChildren || children);
      },
      Item: ({ children, ...props }: any) => {
        const { children: reorderChildren, ...filteredProps } = props;
        Object.keys(filteredProps).forEach(key => {
          if (motionProps.has(key)) delete filteredProps[key];
        });
        return React.createElement('div', filteredProps, reorderChildren || children);
      },
    },
  };
});

// Mock framer-motion for legacy imports
vi.mock('framer-motion', () => {
  const motionProps = new Set([
    'animate', 'initial', 'exit', 'variants', 'transition', 'whileHover', 'whileTap',
    'whileFocus', 'whileDrag', 'whileInView', 'drag', 'dragConstraints', 'dragElastic',
    'dragMomentum', 'dragTransition', 'layoutId', 'layout', 'onAnimationStart',
    'onAnimationComplete', 'onUpdate', 'onDrag', 'onDragStart', 'onDragEnd'
  ]);

  const mockMotionCreate = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      // Filter out motion-specific props to prevent React warnings
      const filteredProps = Object.keys(otherProps).reduce((acc, key) => {
        if (!motionProps.has(key)) {
          acc[key] = otherProps[key];
        }
        return acc;
      }, {} as any);
      return React.createElement(component as any, filteredProps, children);
    };
    MotionComponent.displayName = `Motion(${typeof component === 'string' ? component : component.displayName || component.name || 'Component'})`;
    return MotionComponent;
  };

  const motion = {
    create: mockMotionCreate,
    div: mockMotionCreate('div'),
    span: mockMotionCreate('span'),
    button: mockMotionCreate('button'),
    input: mockMotionCreate('input'),
  };

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Reorder: {
      Group: ({ children, ...props }: any) => {
        const { children: reorderChildren, ...filteredProps } = props;
        Object.keys(filteredProps).forEach(key => {
          if (motionProps.has(key)) delete filteredProps[key];
        });
        return React.createElement('div', filteredProps, reorderChildren || children);
      },
      Item: ({ children, ...props }: any) => {
        const { children: reorderChildren, ...filteredProps } = props;
        Object.keys(filteredProps).forEach(key => {
          if (motionProps.has(key)) delete filteredProps[key];
        });
        return React.createElement('div', filteredProps, reorderChildren || children);
      },
    },
  };
});

// Mock OpenAI globally with realistic defaults
vi.mock('openai', () => ({
  __esModule: true,
  default: class OpenAI {
    vectorStores = {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi.fn().mockResolvedValue({ id: 'vs_mock', name: 'Mock Store' }),
      search: vi.fn().mockResolvedValue({ data: [] }),
    };
    files = {
      create: vi.fn().mockResolvedValue({ id: 'file_mock' }),
    };
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({
          id: 'chatcmpl-mock',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-5-mini',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Mock response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
        }),
      },
    };
  },
}));

// Mock logger globally
vi.mock('@/lib/utils/logger', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  logWarning: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock web crypto utilities for API key storage
vi.mock('@/lib/security/web-crypto', () => ({
  setMemoryCredential: vi.fn().mockResolvedValue({ masked: 'sk-1...abcd' }),
  getMemoryCredential: vi.fn().mockResolvedValue(null),
  setSessionCredential: vi.fn().mockResolvedValue({ masked: 'sk-1...abcd' }),
  getSessionCredential: vi.fn().mockResolvedValue(null),
  setPersistentCredential: vi.fn().mockResolvedValue({ masked: 'sk-1...abcd' }),
  getPersistentCredential: vi.fn().mockResolvedValue(null),
  clearAllGuestCredentialsFor: vi.fn().mockResolvedValue(undefined),
  maskKey: vi.fn((key: string) => `${key.slice(0, 4)}...${key.slice(-4)}`),
}));

// Mock radix-ui components that might cause issues
vi.mock('@radix-ui/react-tooltip', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    Arrow: () => null,
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Root: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({ children, ...props }: any) =>
      React.createElement('button', props, children),
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Content: ({ children, ...props }: any) =>
      React.createElement('div', props, children),
  };
});

// Mock Supabase client and realtime to prevent unhandled rejection errors
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      signIn: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        download: vi.fn(() => Promise.resolve({ data: null, error: null })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    },
    // Mock realtime to prevent disconnect errors
    realtime: {
      channels: new Map(),
      conn: {
        close: vi.fn(),
        disconnect: vi.fn(),
      },
      disconnect: vi.fn().mockResolvedValue(undefined),
      removeChannel: vi.fn(),
      removeAllChannels: vi.fn(),
      getChannels: vi.fn(() => []),
    },
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
      unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      send: vi.fn(),
    })),
  })),
}));

// Mock @supabase/realtime-js to prevent connection errors
vi.mock('@supabase/realtime-js', () => ({
  RealtimeClient: vi.fn().mockImplementation(() => ({
    conn: {
      close: vi.fn(),
      disconnect: vi.fn(),
    },
    channels: new Map(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    removeChannel: vi.fn(),
    removeAllChannels: vi.fn(),
    getChannels: vi.fn(() => []),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
      subscribe: vi.fn(),
      unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      send: vi.fn(),
    })),
  })),
}));

// Mock Supabase config functions
vi.mock('@/lib/supabase/config', () => ({
  IS_SUPABASE_ENABLED: false,
  isSupabaseEnabled: vi.fn(() => false),
  isDevelopmentMode: true,
  isRealtimeEnabled: false,
}));

// Mock other common UI dependencies
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({
    preferences: {
      multiModelEnabled: false,
      showToolInvocations: true,
    },
  }),
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Ensure React is available globally for test files that assume it
// This aligns with React 17+ JSX transform inconsistencies across mocks
// eslint-disable-next-line @typescript-eslint/no-var-requires
globalThis.React = require('react');

// Ensure a clean DOM after every test to prevent cross-test interference
afterEach(() => {
  cleanup();
});

// Partial mock for ui/button to provide buttonVariants for tests that import it
vi.mock('@/components/ui/button', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    buttonVariants: actual.buttonVariants ?? (({ variant, size, className }: any) => {
      const base = 'inline-flex items-center justify-center';
      return [base, className].filter(Boolean).join(' ');
    }),
  };
});

// (Intentionally avoid mocking MessageAssistant/MessageUser so their unit tests exercise real implementations)

// Mock multi-model selector
vi.mock('@/components/common/multi-model-selector', () => ({
  MultiModelSelector: () =>
    React.createElement('div', { 'data-testid': 'mock-multi-model-selector' }),
}));

// Mock langsmith client
vi.mock('@/lib/langsmith/client', () => ({
  createFeedback: vi.fn(),
}));

// Mock Supabase server client with enhanced methods
const mockCreateClient = createMockWithJestMethods(vi.fn(() => ({
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
    upsert: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: [], error: null })),
    })),
  })),
})));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

// Mock guest server client
vi.mock('@/lib/supabase/server-guest', () => ({
  createGuestServerClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

// Mock authentication utilities
vi.mock('@/lib/api-auth', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    authenticateRequest: vi.fn(async (request: any, options: any = {}) => {
      // Handle database connection failure test case
      if (mockCreateClient.getMockImplementation()?.() === null) {
        throw new Error('Database connection failed');
      }

      // Default guest user for tests
      return {
        isGuest: true,
        userId: 'guest-user-123',
        supabase: mockCreateClient(),
        user: { id: 'guest-user-123', anonymous: true },
      };
    }),
    getUserPreferences: vi.fn(async (request: any, authResult: any) => {
      if (authResult.isGuest) {
        return {
          preferences: {
            layout: 'fullscreen',
            prompt_suggestions: true,
            show_tool_invocations: true,
            show_conversation_previews: true,
            multi_model_enabled: false,
            hidden_models: [],
            favorite_models: [],
          },
        };
      }
      // Handle authenticated users
      return actual.getUserPreferences(request, authResult);
    }),
    updateUserPreferences: vi.fn(async (request: any, authResult: any, updates: any) => {
      if (authResult.isGuest) {
        return {
          preferences: {
            layout: 'fullscreen',
            prompt_suggestions: true,
            show_tool_invocations: true,
            show_conversation_previews: true,
            multi_model_enabled: false,
            hidden_models: [],
            favorite_models: [],
            ...updates,
          },
        };
      }
      // Handle authenticated users
      return actual.updateUserPreferences(request, authResult, updates);
    }),
  };
});

// Mock guest utilities
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    isGuestUser: vi.fn(() => true),
    getGuestUserId: vi.fn(() => 'guest-user-123'),
    generateGuestUserId: vi.fn(() => 'guest-user-123'),
    createGuestCookie: vi.fn((name: string, value: string) => `${name}=${value}; Path=/; SameSite=Lax`),
    DEFAULT_GUEST_PREFERENCES: {
      layout: 'fullscreen',
      prompt_suggestions: true,
      show_tool_invocations: true,
      show_conversation_previews: true,
      multi_model_enabled: false,
      hidden_models: [],
      favorite_models: [],
    },
  };
});

// Mock CSS imports globally - handled by vitest config CSS modules
vi.mock('katex/dist/katex.min.css', () => ({}));

// Mock use-stick-to-bottom
vi.mock('use-stick-to-bottom', () => ({
  StickToBottom: ({ children, ...props }: any) => {
    const Component = React.createElement('div', {
      ...props,
      'data-testid': 'chat-container-root'
    }, children);

    // Add Content as a property
    (Component as any).Content = ({ children, ...contentProps }: any) =>
      React.createElement('div', {
        ...contentProps,
        'data-testid': 'chat-container-content'
      }, children);

    return Component;
  },
}));

// Mock ai-extended utility functions (except getMessageContent which we want to test)
vi.mock('@/app/types/ai-extended', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    hasAttachments: vi.fn(() => false),
    hasContent: vi.fn(() => true),
    hasParts: vi.fn(() => false),
    getMessageReasoning: vi.fn(() => undefined),
  };
});

// Mock chat components
vi.mock('@/components/app/chat/message-user', () => ({
  MessageUser: ({ children, id, onDelete, onEdit, attachments, isLast, hasScrollAnchor, copied, copyToClipboard, onReload, className, ...domProps }: any) =>
    React.createElement('div', {
      ...domProps,
      className,
      'data-testid': 'message-user',
      'data-message-id': id,
      'data-is-last': String(Boolean(isLast)),
      'data-has-scroll-anchor': String(Boolean(hasScrollAnchor))
    }, [
      children && React.createElement('div', { 'data-testid': 'message-content', key: 'content' }, children),
      attachments && React.createElement('div', { 'data-testid': 'message-attachments', key: 'attachments' },
        attachments.map((att: any, i: number) =>
          React.createElement('div', { 'data-testid': `attachment-${i}`, key: i }, [
            att.type?.startsWith('image/') ?
              React.createElement('img', {
                alt: att.name,
                src: att.url || `data:${att.type};base64,${att.data}`,
                key: 'img'
              }) :
              React.createElement('span', { key: 'name' }, att.name)
          ])
        )
      ),
      React.createElement('button', {
        'data-testid': 'copy-button',
        onClick: () => copyToClipboard?.(),
        'aria-label': copied ? 'Copied!' : 'Copy text',
        key: 'copy'
      }, 'Copy'),
      React.createElement('button', {
        'data-testid': 'delete-button',
        onClick: () => onDelete?.(id),
        'aria-label': 'Delete',
        key: 'delete'
      }, 'Delete'),
      React.createElement('button', {
        'data-testid': 'edit-button',
        onClick: () => onEdit?.(id, 'edited'),
        'aria-label': 'Edit',
        key: 'edit'
      }, 'Edit')
    ].filter(Boolean))
}));

vi.mock('@/components/app/chat/message-assistant', () => ({
  MessageAssistant: ({ children, messageId, onReload, onQuote, parts, langsmithRunId, isLast, hasScrollAnchor, copied, copyToClipboard, className, status, ...domProps }: any) =>
    React.createElement('div', {
      ...domProps,
      className,
      'data-testid': 'message-assistant',
      'data-message-id': messageId,
      'data-is-last': String(Boolean(isLast)),
      'data-has-scroll-anchor': String(Boolean(hasScrollAnchor)),
      'data-langsmith-run-id': langsmithRunId?.toString() || 'null',
      'data-status': status
    }, [
      children && React.createElement('div', { 'data-testid': 'message-content', key: 'content' }, children),
      parts && React.createElement('div', { 'data-testid': 'message-parts', key: 'parts' },
        parts.map((part: any, i: number) =>
          React.createElement('div', {
            'data-testid': `part-${i}`,
            'data-part-type': part.type,
            key: i
          }, part.text || part.toolName)
        )
      ),
      React.createElement('button', {
        'data-testid': 'copy-button',
        onClick: () => copyToClipboard?.(),
        'aria-label': copied ? 'Copied!' : 'Copy text',
        key: 'copy'
      }, 'Copy'),
      React.createElement('button', {
        'data-testid': 'reload-button',
        onClick: () => onReload?.(),
        'aria-label': 'Reload',
        key: 'reload'
      }, 'Reload'),
      React.createElement('button', {
        'data-testid': 'quote-button',
        onClick: () => onQuote?.('quoted text', messageId),
        'aria-label': 'Quote',
        key: 'quote'
      }, 'Quote')
    ].filter(Boolean))
}));

// Mock prompt-kit components
vi.mock('@/components/prompt-kit/loader', () => ({
  Loader: () => React.createElement('div', { 'data-testid': 'loader' }, 'Loading...')
}));

vi.mock('@/components/prompt-kit/scroll-button', () => ({
  ScrollButton: (props: any) => React.createElement('button', {
    ...props,
    'data-testid': 'scroll-button'
  }, 'Scroll')
}));

vi.mock('@/components/prompt-kit/chat-container', () => ({
  ChatContainerRoot: ({ children, ...props }: any) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'chat-container-root'
    }, children),
  ChatContainerContent: ({ children, style, ...props }: any) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'chat-container-content',
      className: 'flex w-full flex-col items-center pt-20 pb-4',
      style: {
        scrollbarGutter: 'stable both-edges',
        scrollbarWidth: 'none',
        ...style
      }
    }, children)
}));
