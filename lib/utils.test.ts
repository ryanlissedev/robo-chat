import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { cn, formatNumber, debounce, isDev } from './utils'

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('merges class names correctly', () => {
      expect(cn('px-2 py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500')
      expect(cn('px-2', 'px-4')).toBe('px-4') // tailwind-merge should resolve conflicts
    })

    it('handles conditional classes', () => {
      expect(cn('base', true && 'conditional', false && 'hidden')).toBe('base conditional')
      expect(cn('base', undefined, null, 'valid')).toBe('base valid')
    })

    it('handles empty inputs', () => {
      expect(cn()).toBe('')
      expect(cn('')).toBe('')
      expect(cn(null, undefined)).toBe('')
    })
  })

  describe('formatNumber', () => {
    it('formats numbers with commas', () => {
      expect(formatNumber(1234)).toBe('1,234')
      expect(formatNumber(1234567)).toBe('1,234,567')
      expect(formatNumber(1000)).toBe('1,000')
    })

    it('handles small numbers', () => {
      expect(formatNumber(0)).toBe('0')
      expect(formatNumber(123)).toBe('123')
      expect(formatNumber(-123)).toBe('-123')
    })

    it('handles decimal numbers', () => {
      expect(formatNumber(1234.56)).toBe('1,234.56')
      expect(formatNumber(0.123)).toBe('0.123')
    })
  })

  describe('debounce', () => {
    it('delays function execution', async () => {
      let callCount = 0
      let lastArg: string | undefined
      const fn = (arg: string) => {
        callCount++
        lastArg = arg
      }
      const debouncedFn = debounce(fn, 50) // Reduced timeout for test speed

      debouncedFn('arg1')
      expect(callCount).toBe(0)

      // Wait for debounce timeout
      await new Promise(resolve => setTimeout(resolve, 60))
      expect(callCount).toBe(1)
      expect(lastArg).toBe('arg1')
    })

    it('cancels previous calls', async () => {
      let callCount = 0
      let lastArg: string | undefined
      const fn = (arg: string) => {
        callCount++
        lastArg = arg
      }
      const debouncedFn = debounce(fn, 50)

      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')

      await new Promise(resolve => setTimeout(resolve, 60))
      expect(callCount).toBe(1)
      expect(lastArg).toBe('third')
    })

    it('handles multiple arguments', async () => {
      let callArgs: any[] | undefined
      const fn = (...args: any[]) => {
        callArgs = args
      }
      const debouncedFn = debounce(fn, 50)

      debouncedFn('arg1', 'arg2', { key: 'value' })
      await new Promise(resolve => setTimeout(resolve, 60))

      expect(callArgs).toEqual(['arg1', 'arg2', { key: 'value' }])
    })
  })

  describe('isDev', () => {
    it('returns boolean value', () => {
      expect(typeof isDev).toBe('boolean')
      expect(isDev).toBe(false) // test environment, not development
    })
  })
})