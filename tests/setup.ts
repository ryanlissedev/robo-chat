// Environment variables are handled in vitest config via define section
// Set up test environment variables that aren't handled by vitest config
process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');

// Set IS_REACT_ACT_ENVIRONMENT for React Testing Library
process.env.IS_REACT_ACT_ENVIRONMENT = 'true';

import { act, cleanup, configure } from '@testing-library/react';
// DOM environment is provided by jsdom via vitest config
import React from 'react';
import { vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

// Configure React testing environment for React 19
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// Fix React 19 DOM strict mode issues
if (typeof document !== 'undefined') {
  // Prevent multiple root elements
  const originalAppendChild = document.body.appendChild;
  document.body.appendChild = function (node: Node) {
    // Only allow one test root at a time
    if (node.nodeName === 'DIV' && document.body.children.length > 0) {
      // Clean existing content first
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
    }
    return originalAppendChild.call(this, node);
  };
}

// Make React and act available globally for tests that need them
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).act = act;

// Configure React Testing Library
configure({
  asyncUtilTimeout: 5000,
  getElementError: (message) => new Error(message ?? 'Element not found'),
  // Enable automatic act wrapping for React 19 compatibility
  reactStrictMode: true,
  // Configure testing library for React 19
  testIdAttribute: 'data-testid',
});

// Ensure window object is available and properly configured
if (typeof window === 'undefined') {
  // Create minimal window mock
  (global as any).window = {
    localStorage: {
      getItem: vi.fn(() => undefined),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    matchMedia: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  };
}

// Ensure document is available in jsdom environment
if (typeof document === 'undefined') {
  // jsdom should provide document, but ensure it exists
}

// Global test cleanup and isolation setup
import { afterEach, beforeEach } from 'vitest';

// Optimized global beforeEach - conditional setup based on test type
beforeEach(() => {
  // Always clear mocks and timers
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Console mocking (reduced in fast mode)
  if (!IS_FAST_MODE) {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  }

  // React cleanup - always needed
  cleanup();

  // DOM reset - optimized for different environments
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
    // Only setup event listeners if not in fast mode
    if (!IS_FAST_MODE) {
      document.removeEventListener = document.removeEventListener || vi.fn();
    }
  }
  if (typeof window !== 'undefined' && !IS_FAST_MODE) {
    window.removeEventListener = window.removeEventListener || vi.fn();
  }
});

// Global afterEach - runs after every single test
afterEach(() => {
  // Clean up React components first
  cleanup();

  // Handle timer cleanup safely - but don't force real timers
  // Individual tests should manage their own timer lifecycle
  if (vi.isFakeTimers()) {
    try {
      vi.runOnlyPendingTimers();
    } catch {
      // Ignore errors if no pending timers
    }
  }

  // Clear mocks and timers
  vi.clearAllMocks();
  vi.clearAllTimers();

  // Reset modules to prevent cross-test contamination
  vi.resetModules();

  // Clear DOM completely
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }

  // Clean up any global state
  if (typeof window !== 'undefined') {
    // Clear any timers that might be lingering
    let id = window.setTimeout(() => {}, 0);
    while (id--) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
  }

  // Reset fetch mock state
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    (global.fetch as any).mockReset();
  }

  // Restore console
  if (vi.isMockFunction(console.error)) {
    (console.error as any).mockRestore();
  }
  if (vi.isMockFunction(console.warn)) {
    (console.warn as any).mockRestore();
  }

  // Force garbage collection if available (Node.js)
  if (typeof global !== 'undefined' && global.gc) {
    global.gc();
  }
});

// Mock next/navigation redirect as vi.fn()
vi.mock('next/navigation', async (orig) => {
  const actual = await (orig() as Promise<any>);
  return {
    ...actual,
    redirect: vi.fn(),
  };
});

// Prevent creating real Supabase browser client during tests.
// Many providers call `createClient()` from `lib/supabase/client`, which can
// initialize Realtime/WebSocket connections that Happy DOM can't fully emulate.
// We mock it to return `null` so feature flags that check for a client simply
// no-op in tests.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => null,
}));

// Mock Supabase configuration for tests
vi.mock('@/lib/supabase/config', () => ({
  IS_SUPABASE_ENABLED: true,
  isSupabaseEnabled: vi.fn().mockReturnValue(true),
  isDevelopmentMode: vi.fn().mockReturnValue(false),
  isRealtimeEnabled: vi.fn().mockReturnValue(false),
}));

// =============================================================================
// STANDARDIZED MOCK HELPERS
// =============================================================================

// Standard UI Component Mocks
vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
  useToast: vi.fn(() => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

// Standard Radix UI Component Mocks
vi.mock('@radix-ui/react-dialog', () => ({
  Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Portal: ({ children }: any) => children,
  Overlay: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Content: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Trigger: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...filterDOMProps(props), ref }, children)
  ),
  Close: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...filterDOMProps(props), ref }, children)
  ),
  Title: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('h2', { ...filterDOMProps(props), ref }, children)
  ),
  Description: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('p', { ...filterDOMProps(props), ref }, children)
  ),
}));

vi.mock('@radix-ui/react-popover', () => ({
  Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Trigger: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...filterDOMProps(props), ref }, children)
  ),
  Content: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Portal: ({ children }: any) => children,
  Anchor: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
}));

vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: any) => children,
  Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Trigger: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...filterDOMProps(props), ref }, children)
  ),
  Content: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Portal: ({ children }: any) => children,
  Arrow: React.forwardRef(({ ...props }: any, ref: any) =>
    React.createElement('span', {
      ...filterDOMProps(props),
      ref,
      'data-testid': 'tooltip-arrow',
    })
  ),
}));

vi.mock('@radix-ui/react-accordion', () => ({
  Root: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Item: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Trigger: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...filterDOMProps(props), ref }, children)
  ),
  Content: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('div', { ...filterDOMProps(props), ref }, children)
  ),
  Header: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('h3', { ...filterDOMProps(props), ref }, children)
  ),
}));

// Standard Supabase Client Mocks
const createStandardSupabaseClient = () => ({
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: null }, error: null })
    ),
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null })
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null })
          ),
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
});

// Standard Next.js API Mocks
const createStandardNextRequest = (body = {}, method = 'POST') => ({
  json: vi.fn(() => Promise.resolve(body)),
  method,
  headers: new Headers(),
  url: 'http://localhost:3000/api/test',
});

const createStandardNextResponse = (data = {}, status = 200) =>
  new Response(JSON.stringify(data), { status });

// =============================================================================
// EXPORT STANDARD MOCK HELPERS
// =============================================================================

export const mockHelpers = {
  // Supabase mocks
  createSupabaseClient: createStandardSupabaseClient,

  // Next.js mocks
  createNextRequest: createStandardNextRequest,
  createNextResponse: createStandardNextResponse,

  // Standard mock functions for common patterns
  mockIsSupabaseEnabled: vi.fn(() => true),
  mockIsDevelopmentMode: vi.fn(() => false),
  mockIsRealtimeEnabled: vi.fn(() => false),

  // Standard encryption mocks
  mockEncrypt: vi.fn(() => 'encrypted-data'),
  mockDecrypt: vi.fn(() => 'decrypted-data'),

  // Standard toast mock
  mockToast: vi.fn(),

  // Reset all mocks helper
  resetAllMocks: () => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.resetModules();
  },

  // Common assertion helpers
  expectMockCalled: (mockFn: any, times = 1) => {
    expect(mockFn).toHaveBeenCalledTimes(times);
  },

  expectMockCalledWith: (mockFn: any, ...args: any[]) => {
    expect(mockFn).toHaveBeenCalledWith(...args);
  },
};

// Define test environment constants BEFORE using them
const IS_FAST_MODE = process.env.VITEST_FAST_MODE === 'true';
const IS_CI = process.env.CI === '1';
const TEST_TYPE = process.env.TEST_TYPE || 'unit';

// Export test utilities for different test types
export const testUtils = {
  IS_FAST_MODE,
  IS_CI,
  TEST_TYPE,
  mockHelpers,
};

// Make helpers and utilities available globally for easy access in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).mockHelpers = mockHelpers;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).testUtils = testUtils;

// =============================================================================

// Mock Node.js crypto module for browser tests
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal();
  const actualObj = actual && typeof actual === 'object' ? actual : {};
  return {
    ...actualObj,
    randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0)),
    randomUUID: vi.fn(() => 'mock-uuid-12345'),
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => 'encrypted'),
      final: vi.fn(() => ''),
      getAuthTag: vi.fn(() => Buffer.from('auth-tag')),
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => 'decrypted'),
      final: vi.fn(() => ''),
    })),
    timingSafeEqual: vi.fn(() => true),
  };
});

// Mock encryption module that requires ENCRYPTION_KEY
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn(() => 'encrypted-data'),
  decrypt: vi.fn(() => 'decrypted-data'),
  encryptKey: vi.fn(() => 'encrypted-key'),
  decryptKey: vi.fn(() => 'decrypted-key'),
  maskKey: vi.fn((key) => (key ? 'masked-key' : '')),
}));

// Mock user-keys module that imports encryption
vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(() => Promise.resolve(null)),
}));

// Mock crypto as well for compatibility
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  const actualObj = actual && typeof actual === 'object' ? actual : {};
  const mockCrypto = {
    ...actualObj,
    randomUUID: vi.fn(() => 'mock-uuid-12345'),
    randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0)),
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => 'encrypted'),
      final: vi.fn(() => ''),
      getAuthTag: vi.fn(() => Buffer.from('auth-tag')),
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => 'decrypted'),
      final: vi.fn(() => ''),
    })),
    timingSafeEqual: vi.fn(() => true),
  };

  // Ensure default export is available
  return {
    ...mockCrypto,
    default: mockCrypto,
  };
});

// Mock CSS imports to prevent "Unknown file extension" errors
vi.mock('katex/dist/katex.min.css', () => ({}));
vi.mock('tailwindcss/tailwind.css', () => ({}));

// Mock streamdown which imports katex CSS
vi.mock('streamdown', () => ({
  Streamdown: ({ children, className }: any) => {
    const React = require('react');
    return React.createElement('div', { className }, children);
  },
}));

// Mock Lucide React icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();

  // Create a mock icon component
  const MockIcon = React.forwardRef(({ className, ...props }: any, ref: any) =>
    React.createElement('svg', {
      className,
      ...props,
      ref,
      'data-testid': 'mock-icon',
    })
  );
  MockIcon.displayName = 'MockIcon';

  // Create a proxy to intercept all icon requests
  const iconProxy = new Proxy(
    {},
    {
      get: (_target, _prop) => {
        // Return the mock icon for any requested icon
        return MockIcon;
      },
    }
  );

  return {
    ...actual,
    ...iconProxy,
  };
});

// Helper function to filter DOM props
function filterDOMProps(props: Record<string, any>): Record<string, any> {
  const domProps: Record<string, any> = {};

  Object.keys(props).forEach((key) => {
    // Allow standard HTML attributes
    if (
      key.startsWith('data-') ||
      key.startsWith('aria-') ||
      key === 'id' ||
      key === 'role' ||
      key === 'tabIndex' ||
      key === 'className' ||
      key === 'style' ||
      key === 'title'
    ) {
      domProps[key] = props[key];
    }
  });

  return domProps;
}

// Helper function to filter motion-specific props
function filterMotionProps(props: Record<string, any>): Record<string, any> {
  const {
    animate,
    initial,
    exit,
    transition,
    variants,
    whileHover,
    whileTap,
    whileFocus,
    whileInView,
    whileDrag,
    drag,
    dragConstraints,
    dragElastic,
    dragMomentum,
    dragTransition,
    onDrag,
    onDragStart,
    onDragEnd,
    layoutId,
    layout,
    layoutScroll,
    layoutRoot,
    // Additional motion props that shouldn't reach DOM
    style: motionStyle,
    ...domProps
  } = props;

  // Handle style prop carefully - merge if both exist
  const finalProps = filterDOMProps(domProps);
  if (motionStyle && typeof motionStyle === 'object') {
    finalProps.style = { ...finalProps.style, ...motionStyle };
  }

  return finalProps;
}

// Mock framer-motion globally with better DOM compatibility
vi.mock('framer-motion', () => {
  const MockMotionComponent = React.forwardRef((props: any, ref: any) => {
    const { children, as = 'div', ...restProps } = props;
    const domProps = filterMotionProps(restProps);
    return React.createElement(as, { ...domProps, ref }, children);
  });
  MockMotionComponent.displayName = 'MockMotionComponent';

  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tagName) => {
          const Component = React.forwardRef((props: any, ref: any) => {
            const { children, ...restProps } = props;
            const domProps = filterMotionProps(restProps);
            return React.createElement(
              tagName as string,
              { ...domProps, ref },
              children
            );
          });
          Component.displayName = `Motion${String(tagName).charAt(0).toUpperCase() + String(tagName).slice(1)}`;
          return Component;
        },
      }
    ),
    AnimatePresence: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    useAnimation: () => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      set: vi.fn(),
    }),
    useMotionValue: (initial: any) => ({
      get: vi.fn(() => initial),
      set: vi.fn(),
      on: vi.fn(),
      onChange: vi.fn(),
      destroy: vi.fn(),
    }),
    useTransform: () => ({
      get: vi.fn(() => 0),
      set: vi.fn(),
      on: vi.fn(),
      onChange: vi.fn(),
      destroy: vi.fn(),
    }),
  };
});

// Mock TextMorph component for tests globally
vi.mock('@/components/motion-primitives/text-morph', () => ({
  TextMorph: ({
    children,
    as: Component = 'span',
    className,
    style,
    ...props
  }: {
    children: React.ReactNode;
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  }) => {
    const Tag = Component as React.ElementType;
    const filteredProps = filterDOMProps(props);
    return React.createElement(
      Tag,
      {
        ...filteredProps,
        className,
        style,
        'aria-label': typeof children === 'string' ? children : undefined,
      },
      children
    );
  },
}));

// Mock matchMedia - ensure it's available globally
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
} else if (typeof global !== 'undefined') {
  (global as any).matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Mock HTMLCanvasElement.getContext for tests that use canvas
HTMLCanvasElement.prototype.getContext = vi
  .fn()
  .mockImplementation((contextType) => {
    if (contextType === '2d') {
      return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        canvas: { width: 300, height: 150 },
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        arcTo: vi.fn(),
        rect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        clip: vi.fn(),
        isPointInPath: vi.fn(() => false),
        isPointInStroke: vi.fn(() => false),
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        translate: vi.fn(),
        transform: vi.fn(),
        setTransform: vi.fn(),
        resetTransform: vi.fn(),
        createLinearGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        createRadialGradient: vi.fn(() => ({
          addColorStop: vi.fn(),
        })),
        createPattern: vi.fn(() => null),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(4),
          width: 1,
          height: 1,
        })),
        setLineDash: vi.fn(),
        getLineDash: vi.fn(() => []),
      };
    }
    return null;
  });

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: ResizeObserverCallback) {
    // Store callback for potential future use
    this.callback = callback;
  }
  private callback: ResizeObserverCallback;
};

// Mock Web APIs for navigator.clipboard - ensure consistency
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
  const setupClipboard = {
    writeText: vi.fn((_text: string) => {
      return Promise.resolve();
    }),
    readText: vi.fn(() => {
      return Promise.resolve('');
    }),
    read: vi.fn(() => Promise.resolve([])),
    write: vi.fn(() => Promise.resolve()),
  };

  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    configurable: true,
    value: setupClipboard,
  });
} else if (typeof global !== 'undefined' && !(global as any).navigator) {
  (global as any).navigator = {
    clipboard: {
      writeText: vi.fn((_text: string) => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve('')),
      read: vi.fn(() => Promise.resolve([])),
      write: vi.fn(() => Promise.resolve()),
    },
  };
}

// Mock WebRTC APIs
(global as any).RTCPeerConnection = vi.fn().mockImplementation(() => ({
  createOffer: vi.fn(() =>
    Promise.resolve({ sdp: 'mock-offer-sdp', type: 'offer' })
  ),
  createAnswer: vi.fn(() =>
    Promise.resolve({ sdp: 'mock-answer-sdp', type: 'answer' })
  ),
  setLocalDescription: vi.fn(() => Promise.resolve()),
  setRemoteDescription: vi.fn(() => Promise.resolve()),
  addTrack: vi.fn(),
  createDataChannel: vi.fn(() => ({
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
  })),
  close: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
  onconnectionstatechange: null,
  oniceconnectionstatechange: null,
  ondatachannel: null,
  generateCertificate: vi.fn(() => Promise.resolve({})),
}));

// Mock MediaDevices
if (typeof navigator !== 'undefined' && !navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn(() =>
        Promise.resolve({
          getTracks: () => [{ stop: vi.fn() }],
          getAudioTracks: () => [{ stop: vi.fn() }],
          getVideoTracks: () => [{ stop: vi.fn() }],
        })
      ),
      enumerateDevices: vi.fn(() => Promise.resolve([])),
    },
  });
} else if (
  typeof global !== 'undefined' &&
  !(global as any).navigator?.mediaDevices
) {
  if (!(global as any).navigator) {
    (global as any).navigator = {};
  }
  (global as any).navigator.mediaDevices = {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: vi.fn() }],
        getAudioTracks: () => [{ stop: vi.fn() }],
        getVideoTracks: () => [{ stop: vi.fn() }],
      })
    ),
    enumerateDevices: vi.fn(() => Promise.resolve([])),
  };
}

// Mock AudioContext
global.AudioContext = vi.fn().mockImplementation(() => ({
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
    smoothingTimeConstant: 0.8,
  }),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  close: vi.fn(),
  state: 'running',
  sampleRate: 44100,
}));
