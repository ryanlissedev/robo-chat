/// <reference types="vitest/globals" />

import React from 'react';
import { vi } from 'vitest';

/**
 * Mock component factory for React components with unknown props
 * Filters out unknown DOM props to prevent React warnings
 */
export const createMockComponent = (
  displayName: string,
  knownProps: string[] = []
) => {
  const MockComponent = React.forwardRef<HTMLElement, any>((props, ref) => {
    // Filter out unknown props to prevent React warnings
    const domProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          knownProps.includes(key) ||
          key.startsWith('data-') ||
          key.startsWith('aria-') ||
          [
            'className',
            'style',
            'id',
            'role',
            'tabIndex',
            'onClick',
            'onKeyDown',
            'children',
          ].includes(key)
      )
    );

    return React.createElement('div', {
      ...domProps,
      ref,
      'data-testid': displayName.toLowerCase(),
    });
  });

  MockComponent.displayName = displayName;
  return MockComponent;
};

/**
 * Mock PromptInput component that handles custom props without warnings
 */
export const MockPromptInput = createMockComponent('MockPromptInput', [
  'value',
  'onValueChange',
  'placeholder',
  'disabled',
  'autoFocus',
]);

/**
 * Mock PromptSystem component that handles custom props without warnings
 */
export const MockPromptSystem = createMockComponent('MockPromptSystem', [
  'value',
  'onValueChange',
  'onSuggestion',
  'suggestions',
  'isOpen',
  'onOpenChange',
]);

/**
 * Mock button component for testing
 */
export const MockButton = createMockComponent('MockButton', [
  'variant',
  'size',
  'disabled',
  'type',
  'form',
]);

/**
 * Enhanced clipboard mock utilities
 */
export const mockClipboardAPI = () => {
  const writeText = vi.fn(() => Promise.resolve());
  const readText = vi.fn(() => Promise.resolve(''));

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    writable: true,
    configurable: true,
  });

  return { writeText, readText };
};

/**
 * Mock window APIs for testing
 */
export const mockWindowAPIs = () => {
  // Mock matchMedia
  const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia,
  });

  // Mock window dimensions
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: 1024,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: 768,
  });

  // Mock scrollIntoView
  HTMLElement.prototype.scrollIntoView = vi.fn();

  return { mockMatchMedia };
};

/**
 * Mock React component with proper prop filtering
 */
export const mockReactComponent = (
  name: string,
  additionalProps: string[] = []
) => {
  const allProps = [
    'children',
    'className',
    'style',
    'id',
    'role',
    'tabIndex',
    'onClick',
    'onKeyDown',
    'onChange',
    'onFocus',
    'onBlur',
    ...additionalProps,
  ];

  return vi.fn((props: any) => {
    const filteredProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          allProps.includes(key) ||
          key.startsWith('data-') ||
          key.startsWith('aria-')
      )
    );

    return React.createElement('div', {
      ...filteredProps,
      'data-testid': `mock-${name.toLowerCase()}`,
    });
  });
};

/**
 * Utility to suppress specific React warnings in tests
 */
export const suppressReactWarnings = (patterns: string[]) => {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      patterns.some((pattern) => message.includes(pattern))
    ) {
      return; // Suppress the warning
    }
    originalError(...args);
  };

  return () => {
    console.error = originalError;
  };
};

/**
 * Test wrapper that automatically handles common React warnings
 */
export const withSuppressedWarnings = (testFn: () => void | Promise<void>) => {
  return async () => {
    const restore = suppressReactWarnings([
      'Unknown event handler property',
      'Invalid DOM property',
      'React does not recognize the',
    ]);

    try {
      await testFn();
    } finally {
      restore();
    }
  };
};
