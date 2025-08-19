// Setup DOM environment FIRST before any other imports
import { Window } from 'happy-dom'

const window = new Window({ 
  url: 'https://localhost:3000',
  width: 1024,
  height: 768
})
const document = window.document

// Set up all necessary globals before importing testing library
// Use defineProperty to make them non-configurable
Object.defineProperty(globalThis, 'window', {
  value: window,
  writable: false,
  configurable: false
})

Object.defineProperty(globalThis, 'document', {
  value: document,
  writable: false,
  configurable: false
})

Object.defineProperty(globalThis, 'navigator', {
  value: window.navigator,
  writable: false,
  configurable: false
})

// Set up HTML element constructors
globalThis.HTMLElement = window.HTMLElement as any
globalThis.Element = window.Element as any
globalThis.HTMLAnchorElement = window.HTMLAnchorElement as any
globalThis.HTMLButtonElement = window.HTMLButtonElement as any
globalThis.HTMLFormElement = window.HTMLFormElement as any
globalThis.HTMLInputElement = window.HTMLInputElement as any
globalThis.HTMLSelectElement = window.HTMLSelectElement as any
globalThis.HTMLTextAreaElement = window.HTMLTextAreaElement as any
globalThis.HTMLDivElement = window.HTMLDivElement as any
globalThis.HTMLSpanElement = window.HTMLSpanElement as any
globalThis.HTMLImageElement = window.HTMLImageElement as any

// Set up event constructors
globalThis.MouseEvent = window.MouseEvent as any
globalThis.KeyboardEvent = window.KeyboardEvent as any
globalThis.Event = window.Event as any
globalThis.CustomEvent = window.CustomEvent as any

// Set up additional browser APIs
globalThis.DOMTokenList = window.DOMTokenList as any
globalThis.NodeList = window.NodeList as any
globalThis.Range = window.Range as any
globalThis.Selection = window.Selection as any

// Set up requestAnimationFrame and other timing functions
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16)
}
globalThis.cancelAnimationFrame = (id: number) => {
  clearTimeout(id)
}

// Set up storage APIs
globalThis.localStorage = window.localStorage as any
globalThis.sessionStorage = window.sessionStorage as any

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