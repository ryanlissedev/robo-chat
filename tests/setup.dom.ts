import '@testing-library/jest-dom'
import { JSDOM } from 'jsdom'

// Setup DOM environment for Bun tests
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
  resources: 'usable'
})

// Set globals for DOM testing
global.document = dom.window.document
global.window = dom.window as any
global.navigator = dom.window.navigator
global.HTMLElement = dom.window.HTMLElement
global.HTMLButtonElement = dom.window.HTMLButtonElement
global.HTMLAnchorElement = dom.window.HTMLAnchorElement

// Mock ResizeObserver for React Testing Library
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Set up proper 32-byte encryption key for tests
if (!process.env.NODE_ENV) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true,
    configurable: true
  });
}

const testKey = Buffer.alloc(32, 0)
testKey.write('test-key-for-encryption-testing', 0)
process.env.ENCRYPTION_KEY = testKey.toString('base64')
process.env.CSRF_SECRET = 'test-csrf-secret-32-chars-long-min'