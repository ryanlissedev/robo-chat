/**
 * Bundle optimization utilities for the chat application
 * Provides code splitting and lazy loading strategies
 */

import React, { type ComponentType, lazy } from 'react';

/**
 * Enhanced dynamic import with loading states and error boundaries
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    fallback?: ComponentType;
    errorFallback?: ComponentType;
    delay?: number;
  } = {}
): ComponentType<React.ComponentProps<T>> {
  const LazyComponent = lazy(() => {
    const promise = importFn();

    // Add artificial delay for better UX if specified
    if (options.delay) {
      return new Promise<{ default: T }>((resolve) => {
        setTimeout(() => promise.then(resolve), options.delay);
      });
    }

    return promise;
  });

  return (props: React.ComponentProps<T>) => {
    return (
      <React.Suspense fallback={options.fallback ? <options.fallback /> : null}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}

/**
 * Preload critical components for better performance
 */
export const preloadComponents = {
  /**
   * Preload chat components when user hovers over chat trigger
   */
  preloadChatComponents: () => {
    // Preload critical chat components
    import('@/components/app/chat/conversation');
    import('@/components/app/chat/message');
    import('@/components/app/chat-input/chat-input');
  },

  /**
   * Preload multi-chat components
   */
  preloadMultiChatComponents: () => {
    import('@/components/app/multi-chat/multi-chat');
    import('@/components/app/multi-chat/use-multi-chat');
  },

  /**
   * Preload heavy dependencies
   */
  preloadHeavyDependencies: () => {
    import('react-markdown');
    import('react-syntax-highlighter');
    import('motion/react');
  },

  /**
   * Preload AI SDK components
   */
  preloadAIComponents: () => {
    import('@ai-sdk/react');
    import('@ai-sdk/openai');
  },
};

/**
 * Lazy loaded components for better code splitting
 */
export const LazyComponents = {
  // Chat components
  MessageAssistant: createLazyComponent(
    () =>
      import('@/components/app/chat/message-assistant').then((mod) => ({
        default: mod.MessageAssistant,
      })),
    { delay: 0 }
  ),

  MessageUser: createLazyComponent(
    () =>
      import('@/components/app/chat/message-user').then((mod) => ({
        default: mod.MessageUser,
      })),
    { delay: 0 }
  ),

  FeedbackWidget: createLazyComponent(
    () =>
      import('@/components/app/chat/feedback-widget').then((mod) => ({
        default: mod.FeedbackWidget,
      })),
    { delay: 100 }
  ),

  DialogAuth: createLazyComponent(
    () =>
      import('@/components/app/chat/dialog-auth').then((mod) => ({
        default: mod.DialogAuth,
      })),
    { delay: 0 }
  ),

  // Multi-chat components
  MultiChat: createLazyComponent(
    () =>
      import('@/components/app/multi-chat/multi-chat').then((mod) => ({
        default: mod.MultiChat,
      })),
    { delay: 0 }
  ),

  MultiChatInput: createLazyComponent(
    () =>
      import('@/components/app/multi-chat/multi-chat-input').then((mod) => ({
        default: mod.MultiChatInput,
      })),
    { delay: 0 }
  ),

  // Heavy components
  CodeBlock: createLazyComponent(
    () =>
      import('@/components/ai-elements/code-block').then((mod) => ({
        default: mod.CodeBlock,
      })),
    { delay: 50 }
  ),

  WebPreview: createLazyComponent(
    () =>
      import('@/components/ai-elements/web-preview').then((mod) => ({
        default: mod.WebPreview,
      })),
    { delay: 100 }
  ),

  // Settings components
  SettingsContent: createLazyComponent(
    () =>
      import('@/components/app/layout/settings/settings-content').then(
        (mod) => ({ default: mod.SettingsContent })
      ),
    { delay: 200 }
  ),
};

/**
 * Bundle analysis utilities
 */
export const bundleAnalyzer = {
  /**
   * Get estimated bundle size for a component tree
   */
  getEstimatedBundleSize: (componentName: string): number => {
    const sizes: Record<string, number> = {
      chat: 150, // KB
      'multi-chat': 200,
      conversation: 80,
      message: 50,
      'chat-input': 60,
      settings: 120,
      feedback: 30,
    };

    return sizes[componentName] || 50;
  },

  /**
   * Check if component should be lazy loaded
   */
  shouldLazyLoad: (componentName: string, routePath?: string): boolean => {
    // Always lazy load heavy components
    const heavyComponents = [
      'settings',
      'feedback',
      'web-preview',
      'code-block',
    ];
    if (heavyComponents.includes(componentName)) {
      return true;
    }

    // Lazy load non-critical components on home page
    if (
      routePath === '/' &&
      !['chat', 'conversation', 'message'].includes(componentName)
    ) {
      return true;
    }

    return false;
  },

  /**
   * Get preload strategy for current route
   */
  getPreloadStrategy: (routePath: string) => {
    switch (routePath) {
      case '/':
        return {
          immediate: ['chat', 'conversation'],
          onHover: ['multi-chat', 'settings'],
          onIdle: ['feedback', 'web-preview'],
        };
      case '/c/[chatId]':
        return {
          immediate: ['chat', 'conversation', 'message'],
          onHover: ['settings', 'feedback'],
          onIdle: ['multi-chat', 'web-preview'],
        };
      case '/settings':
        return {
          immediate: ['settings'],
          onHover: ['chat'],
          onIdle: ['multi-chat', 'feedback'],
        };
      default:
        return {
          immediate: ['chat'],
          onHover: ['conversation', 'settings'],
          onIdle: ['multi-chat', 'feedback', 'web-preview'],
        };
    }
  },
};

/**
 * Resource hints for better performance
 */
export const resourceHints = {
  /**
   * Add preload hints for critical resources
   */
  addPreloadHints: () => {
    if (typeof window !== 'undefined') {
      // Preload critical fonts
      const fontLink = document.createElement('link');
      fontLink.rel = 'preload';
      fontLink.href = '/fonts/inter-var.woff2';
      fontLink.as = 'font';
      fontLink.type = 'font/woff2';
      fontLink.crossOrigin = 'anonymous';
      document.head.appendChild(fontLink);

      // Preload critical CSS
      const cssLink = document.createElement('link');
      cssLink.rel = 'preload';
      cssLink.href = '/styles/globals.css';
      cssLink.as = 'style';
      document.head.appendChild(cssLink);
    }
  },

  /**
   * Add prefetch hints for likely next resources
   */
  addPrefetchHints: (resources: string[]) => {
    if (typeof window !== 'undefined') {
      resources.forEach((resource) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = resource;
        document.head.appendChild(link);
      });
    }
  },

  /**
   * Add DNS prefetch for external domains
   */
  addDnsPrefetch: () => {
    if (typeof window !== 'undefined') {
      const domains = [
        '//api.openai.com',
        '//api.anthropic.com',
        '//fonts.googleapis.com',
        '//cdn.jsdelivr.net',
      ];

      domains.forEach((domain) => {
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = domain;
        document.head.appendChild(link);
      });
    }
  },
};
