// Setup DOM environment FIRST before any other imports
import { JSDOM } from 'jsdom'

// Create JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
})

const { window } = dom
const { document } = window

// Set up globals with defineProperty for better compatibility
Object.defineProperty(globalThis, 'window', {
  value: window,
  writable: true,
  enumerable: true,
  configurable: true
})

Object.defineProperty(globalThis, 'document', {
  value: document,
  writable: true,
  enumerable: true,
  configurable: true
})

Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  writable: true,
  enumerable: true,
  configurable: true
})

// Also set up direct globals for compatibility
global.window = window as any
global.document = document as any  
global.navigator = window.navigator as any

// Copy essential window properties to globalThis, avoiding readonly ones
const safePropertyList = [
  'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage',
  'location', 'history', 'screen', 'performance'
]

safePropertyList.forEach((property) => {
  if (window[property as keyof Window] && !(property in globalThis)) {
    try {
      Object.defineProperty(globalThis, property, {
        value: window[property as keyof Window],
        writable: true,
        configurable: true
      })
    } catch (e) {
      // Skip readonly properties
    }
  }
})

// Ensure critical DOM APIs are available
Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Element', { value: window.Element, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Document', { value: window.Document, writable: true, configurable: true })
Object.defineProperty(globalThis, 'Node', { value: window.Node, writable: true, configurable: true })

// Set up commonly used HTML elements
const elementTypes = [
  'HTMLElement', 'HTMLDivElement', 'HTMLSpanElement', 'HTMLParagraphElement',
  'HTMLButtonElement', 'HTMLInputElement', 'HTMLFormElement', 'HTMLSelectElement',
  'HTMLTextAreaElement', 'HTMLAnchorElement', 'HTMLImageElement', 'HTMLUListElement',
  'HTMLLIElement', 'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableCellElement'
]

elementTypes.forEach(elementType => {
  if (window[elementType as keyof Window]) {
    Object.defineProperty(globalThis, elementType, {
      value: window[elementType as keyof Window],
      writable: true,
      configurable: true
    })
  }
})

// Set up events
const eventTypes = [
  'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'InputEvent'
]

eventTypes.forEach(eventType => {
  if (window[eventType as keyof Window]) {
    Object.defineProperty(globalThis, eventType, {
      value: window[eventType as keyof Window],
      writable: true,
      configurable: true
    })
  }
})

// Set up additional browser APIs that React Testing Library might need
const browserAPIs = [
  'Range', 'Selection', 'DOMTokenList', 'NodeList', 'MutationObserver'
]

browserAPIs.forEach(api => {
  if (window[api as keyof Window]) {
    Object.defineProperty(globalThis, api, {
      value: window[api as keyof Window],
      writable: true,
      configurable: true
    })
  }
})

import '@testing-library/jest-dom'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// Extend Bun's expect with jest-dom matchers
declare module 'bun:test' {
  interface Matchers<T = unknown> extends TestingLibraryMatchers<T, void> {}
}

// Minimal setup with only essential environment variables
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true
  });
}

// Create a proper 32-byte encryption key for AES-256
const testKey = Buffer.alloc(32, 0) // 32 bytes of zeros
testKey.write('test-key-for-encryption-testing', 0) // Fill with test data
process.env.ENCRYPTION_KEY = testKey.toString('base64')
process.env.CSRF_SECRET = 'test-csrf-secret-32-chars-long-min'