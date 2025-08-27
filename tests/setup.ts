// Set up environment variables FIRST before any other imports
process.env.ENCRYPTION_KEY = Buffer.from('a'.repeat(32)).toString('base64');
process.env.NODE_ENV = 'test';

import 'jsdom-global/register';
import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';
import { configure } from '@testing-library/react';

// Import act from React Testing Library for React 19 compatibility
import { act } from '@testing-library/react';

// Configure React testing environment for React 19
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).IS_REACT_ACT_ENVIRONMENT = true;

// Make React and act available globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).act = act;

// Configure React Testing Library
configure({
  asyncUtilTimeout: 5000,
  getElementError: (message) => new Error(message),
  // Disable automatic act wrapping since we're handling it manually
  reactStrictMode: true,
});

// Ensure window object is available and properly configured
if (typeof window === 'undefined') {
  // This should not happen with jsdom but let's be safe
  console.warn('window is not defined, this should not happen with jsdom environment');
  // Create minimal window mock
  (global as any).window = {
    localStorage: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    },
    matchMedia: vi.fn().mockImplementation(query => ({
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
  // This should not happen with jsdom but let's be safe
  console.warn('document is not defined, jsdom environment may not be properly configured');
}

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
  isSupabaseEnabled: true,
  isDevelopmentMode: false,
  isRealtimeEnabled: false,
}));

// Mock Node.js crypto module for browser tests
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    default: actual.default || actual,
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
}));

// Mock user-keys module that imports encryption
vi.mock('@/lib/user-keys', () => ({
  getUserKey: vi.fn(() => Promise.resolve(null)),
}));

// Mock crypto as well for compatibility
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  const mockCrypto = {
    ...actual,
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

// Mock Lucide React icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  
  // Create a mock icon component
  const MockIcon = ({ className, ...props }: any) => 
    React.createElement('svg', {
      className,
      ...props,
      'data-testid': 'mock-icon'
    });
  
  return {
    ...actual,
    // Common icons used in the app
    Code: MockIcon,
    Settings: MockIcon,
    User: MockIcon,
    MessageCircle: MockIcon,
    Send: MockIcon,
    Copy: MockIcon,
    Check: MockIcon,
    X: MockIcon,
    Plus: MockIcon,
    Minus: MockIcon,
    ChevronDown: MockIcon,
    ChevronUp: MockIcon,
    ChevronLeft: MockIcon,
    ChevronRight: MockIcon,
    Search: MockIcon,
    Filter: MockIcon,
    Menu: MockIcon,
    Home: MockIcon,
    FileText: MockIcon,
    Upload: MockIcon,
    Download: MockIcon,
    Trash2: MockIcon,
    Edit: MockIcon,
    Save: MockIcon,
    Loader2: MockIcon,
    AlertCircle: MockIcon,
    Info: MockIcon,
    CheckCircle: MockIcon,
    XCircle: MockIcon,
    Eye: MockIcon,
    EyeOff: MockIcon,
    Lock: MockIcon,
    Unlock: MockIcon,
    Key: MockIcon,
    Mail: MockIcon,
    Phone: MockIcon,
    Calendar: MockIcon,
    Clock: MockIcon,
    Star: MockIcon,
    Heart: MockIcon,
    ThumbsUp: MockIcon,
    ThumbsDown: MockIcon,
    Share: MockIcon,
    ExternalLink: MockIcon,
    Link: MockIcon,
    Unlink: MockIcon,
    Image: MockIcon,
    Video: MockIcon,
    Music: MockIcon,
    File: MockIcon,
    Folder: MockIcon,
    Archive: MockIcon,
    Database: MockIcon,
    Server: MockIcon,
    Globe: MockIcon,
    Wifi: MockIcon,
    Bluetooth: MockIcon,
    Battery: MockIcon,
    Volume2: MockIcon,
    VolumeX: MockIcon,
    Play: MockIcon,
    Pause: MockIcon,
    Stop: MockIcon,
    SkipBack: MockIcon,
    SkipForward: MockIcon,
    FastForward: MockIcon,
    Rewind: MockIcon,
    Repeat: MockIcon,
    Shuffle: MockIcon,
    Mic: MockIcon,
    MicOff: MockIcon,
    Camera: MockIcon,
    CameraOff: MockIcon,
    Monitor: MockIcon,
    Smartphone: MockIcon,
    Tablet: MockIcon,
    Laptop: MockIcon,
    Printer: MockIcon,
    Headphones: MockIcon,
    Mouse: MockIcon,
    Keyboard: MockIcon,
    Gamepad2: MockIcon,
    Tv: MockIcon,
    Radio: MockIcon,
    Rss: MockIcon,
    Bookmark: MockIcon,
    Tag: MockIcon,
    Hash: MockIcon,
    AtSign: MockIcon,
    Percent: MockIcon,
    Dollar: MockIcon,
    Euro: MockIcon,
    Pound: MockIcon,
    Yen: MockIcon,
    CreditCard: MockIcon,
    Wallet: MockIcon,
    ShoppingCart: MockIcon,
    ShoppingBag: MockIcon,
    Gift: MockIcon,
    Package: MockIcon,
    Truck: MockIcon,
    Ship: MockIcon,
    Plane: MockIcon,
    Car: MockIcon,
    Bus: MockIcon,
    Train: MockIcon,
    Bike: MockIcon,
    Footprints: MockIcon,
    MapPin: MockIcon,
    Map: MockIcon,
    Compass: MockIcon,
    Navigation: MockIcon,
    Anchor: MockIcon,
    Umbrella: MockIcon,
    Sun: MockIcon,
    Moon: MockIcon,
    Cloud: MockIcon,
    CloudRain: MockIcon,
    CloudSnow: MockIcon,
    CloudLightning: MockIcon,
    Thermometer: MockIcon,
    Droplets: MockIcon,
    Wind: MockIcon,
    Flame: MockIcon,
    Zap: MockIcon,
    Bolt: MockIcon,
    Activity: MockIcon,
    TrendingUp: MockIcon,
    TrendingDown: MockIcon,
    BarChart: MockIcon,
    PieChart: MockIcon,
    LineChart: MockIcon,
    Target: MockIcon,
    Award: MockIcon,
    Medal: MockIcon,
    Trophy: MockIcon,
    Crown: MockIcon,
    Shield: MockIcon,
    ShieldCheck: MockIcon,
    ShieldAlert: MockIcon,
    ShieldX: MockIcon,
    Verified: MockIcon,
    UserCheck: MockIcon,
    UserPlus: MockIcon,
    UserMinus: MockIcon,
    UserX: MockIcon,
    Users: MockIcon,
    Team: MockIcon,
    Building: MockIcon,
    Building2: MockIcon,
    Factory: MockIcon,
    Store: MockIcon,
    Briefcase: MockIcon,
    HardHat: MockIcon,
    Wrench: MockIcon,
    Hammer: MockIcon,
    Screwdriver: MockIcon,
    Drill: MockIcon,
    Scissors: MockIcon,
    PaintBucket: MockIcon,
    Palette: MockIcon,
    Brush: MockIcon,
    Pen: MockIcon,
    PenTool: MockIcon,
    Pencil: MockIcon,
    Eraser: MockIcon,
    Ruler: MockIcon,
    Triangle: MockIcon,
    Square: MockIcon,
    Circle: MockIcon,
    Hexagon: MockIcon,
    Octagon: MockIcon,
    Pentagon: MockIcon,
    Diamond: MockIcon,
    Shapes: MockIcon,
    Move: MockIcon,
    RotateCw: MockIcon,
    RotateCcw: MockIcon,
    FlipHorizontal: MockIcon,
    FlipVertical: MockIcon,
    Maximize: MockIcon,
    Minimize: MockIcon,
    Maximize2: MockIcon,
    Minimize2: MockIcon,
    Expand: MockIcon,
    Shrink: MockIcon,
    ZoomIn: MockIcon,
    ZoomOut: MockIcon,
    Focus: MockIcon,
    Scan: MockIcon,
    QrCode: MockIcon,
    Barcode: MockIcon,
    ScanLine: MockIcon,
    Fingerprint: MockIcon,
    // Add any other icons that might be used
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
    animate, initial, exit, transition, variants, whileHover, whileTap,
    whileFocus, whileInView, whileDrag, drag, dragConstraints, dragElastic,
    dragMomentum, dragTransition, onDrag, onDragStart, onDragEnd, layoutId,
    layout, layoutScroll, layoutRoot, ...domProps
  } = props;
  
  return filterDOMProps(domProps);
}

// Mock framer-motion globally
vi.mock('framer-motion', () => {
  const MockMotionComponent = React.forwardRef((props: any, ref: any) => {
    const { children, ...restProps } = props;
    const domProps = filterMotionProps(restProps);
    return React.createElement('div', { ...domProps, ref }, children);
  });

  return {
    motion: new Proxy({}, {
      get: () => MockMotionComponent,
    }),
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn(),
    }),
    useMotionValue: (initial: any) => ({
      get: () => initial,
      set: vi.fn(),
      on: vi.fn(),
    }),
    useTransform: () => ({
      get: () => 0,
      set: vi.fn(),
    }),
  };
});

// Mock TextMorph component for tests globally
vi.mock('@/components/motion-primitives/text-morph', () => ({
  TextMorph: ({ children, as: Component = 'span', className, style, ...props }: { 
    children: string; 
    as?: React.ElementType;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
  }) => {
    const Tag = Component as React.ElementType;
    return React.createElement(Tag, {
      ...props,
      className,
      style,
      'aria-label': children,
    }, children);
  },
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

// Mock HTMLCanvasElement.getContext for tests that use canvas
HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType) => {
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
  observe = vi.fn()
  unobserve = vi.fn() 
  disconnect = vi.fn()
  constructor(callback: ResizeObserverCallback) {
    // Store callback for potential future use
    this.callback = callback;
  }
  private callback: ResizeObserverCallback;
};

// Mock Web APIs for navigator.clipboard - ensure consistency with vitest-setup.ts
if (!navigator.clipboard) {
  const setupClipboard = {
    writeText: vi.fn((text: string) => {
      console.log('[Setup Mock] Clipboard.writeText called with:', text);
      return Promise.resolve();
    }),
    readText: vi.fn(() => {
      console.log('[Setup Mock] Clipboard.readText called');
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
}