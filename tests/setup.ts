import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Make vi available globally to prevent "vi.mock is not a function" errors
globalThis.vi = vi;

// Ensure React act() is enabled for the testing environment (React 19+)
// https://react.dev/blog/2024/04/25/react-19-upgrade-guide#testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).IS_REACT_ACT_ENVIRONMENT = true;
}
process.env.IS_REACT_ACT_ENVIRONMENT = 'true';

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

if (typeof global.window === 'undefined') {
  global.window = globalThis.window || ({
    document: global.document,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    getComputedStyle: () => ({
      getPropertyValue: () => '',
    }),
  } as any);
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
  const mockMotionCreate = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      return React.createElement(component as any, otherProps, children);
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
      Group: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      Item: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
    },
  };
});

// Mock framer-motion for legacy imports
vi.mock('framer-motion', () => {
  const mockMotionCreate = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      return React.createElement(component as any, otherProps, children);
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
      Group: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
      Item: ({ children, ...props }: any) =>
        React.createElement('div', props, children),
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
  })),
})));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

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

// Mock ai-extended utility functions
vi.mock('@/app/types/ai-extended', () => ({
  hasAttachments: vi.fn(() => false),
  getMessageContent: vi.fn((message: any) => message?.content || message?.text || ''),
  hasContent: vi.fn(() => true),
  hasParts: vi.fn(() => false),
  getMessageReasoning: vi.fn(() => undefined),
}));

// Mock chat components
vi.mock('@/components/app/chat/message-user', () => ({
  MessageUser: ({ children, id, onDelete, onEdit, attachments, isLast, hasScrollAnchor, ...props }: any) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'message-user',
      'data-message-id': id,
      'data-is-last': String(Boolean(isLast)),
      'data-has-scroll-anchor': String(Boolean(hasScrollAnchor))
    }, [
      children && React.createElement('div', { 'data-testid': 'message-content', key: 'content' }, children),
      attachments && React.createElement('div', { 'data-testid': 'message-attachments', key: 'attachments' },
        attachments.map((att: any, i: number) =>
          React.createElement('div', { 'data-testid': `attachment-${i}`, key: i }, att.name)
        )
      ),
      React.createElement('button', {
        'data-testid': 'delete-button',
        onClick: () => onDelete?.(id),
        key: 'delete'
      }, 'Delete'),
      React.createElement('button', {
        'data-testid': 'edit-button',
        onClick: () => onEdit?.(id, 'edited'),
        key: 'edit'
      }, 'Edit')
    ].filter(Boolean))
}));

vi.mock('@/components/app/chat/message-assistant', () => ({
  MessageAssistant: ({ children, messageId, onReload, onQuote, parts, langsmithRunId, isLast, hasScrollAnchor, ...props }: any) =>
    React.createElement('div', {
      ...props,
      'data-testid': 'message-assistant',
      'data-message-id': messageId,
      'data-is-last': String(Boolean(isLast)),
      'data-has-scroll-anchor': String(Boolean(hasScrollAnchor)),
      'data-langsmith-run-id': langsmithRunId?.toString() || 'null'
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
        'data-testid': 'reload-button',
        onClick: () => onReload?.(),
        key: 'reload'
      }, 'Reload'),
      React.createElement('button', {
        'data-testid': 'quote-button',
        onClick: () => onQuote?.('quoted text', messageId),
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
