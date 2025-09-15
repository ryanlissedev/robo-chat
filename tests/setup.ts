import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Global setup for all tests

// Mock motion/react (the new framer-motion import)
vi.mock('motion/react', () => {
  const mockMotion = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      if (typeof component === 'string') {
        return { type: component, props: otherProps, children };
      }
      return { type: component, props: otherProps, children };
    };
    MotionComponent.displayName = `Motion(${typeof component === 'string' ? component : component.displayName || component.name || 'Component'})`;
    return MotionComponent;
  };

  return {
    motion: new Proxy(mockMotion, {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return mockMotion(prop);
        }
        return mockMotion;
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    Reorder: {
      Group: ({ children, ...props }: any) => ({ type: 'div', props: { ...props, children } }),
      Item: ({ children, ...props }: any) => ({ type: 'div', props: { ...props, children } }),
    },
  };
});

// Mock framer-motion for legacy imports
vi.mock('framer-motion', () => {
  const mockMotion = (component: any) => {
    const MotionComponent = (props: any) => {
      const { children, ...otherProps } = props;
      if (typeof component === 'string') {
        return { type: component, props: otherProps, children };
      }
      return { type: component, props: otherProps, children };
    };
    MotionComponent.displayName = `Motion(${typeof component === 'string' ? component : component.displayName || component.name || 'Component'})`;
    return MotionComponent;
  };

  return {
    motion: new Proxy(mockMotion, {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return mockMotion(prop);
        }
        return mockMotion;
      },
    }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    Reorder: {
      Group: ({ children, ...props }: any) => ({ type: 'div', props: { ...props, children } }),
      Item: ({ children, ...props }: any) => ({ type: 'div', props: { ...props, children } }),
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
    Trigger: ({ children, ...props }: any) => ({ type: 'button', props: { ...props, children } }),
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Content: ({ children, ...props }: any) => ({ type: 'div', props: { ...props, children } }),
  };
});

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
}));