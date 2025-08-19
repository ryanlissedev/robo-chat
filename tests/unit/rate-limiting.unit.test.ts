import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Rate Limiting Unit Tests
 * Tests rate limiting calculations and logic in isolation
 */

describe('Rate Limiting Unit Tests', () => {
  // Mock current time for consistent testing
  const mockDate = new Date('2024-01-01T00:00:00Z')
  
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rate Limit Calculations', () => {
    interface RateLimitWindow {
      requests: number
      windowStart: number
      windowDuration: number
    }

    function calculateRateLimit(
      currentRequests: number,
      windowStart: number,
      windowDuration: number,
      maxRequests: number,
      currentTime: number = Date.now()
    ): {
      isAllowed: boolean
      remainingRequests: number
      resetTime: number
      windowEnd: number
    } {
      const windowEnd = windowStart + windowDuration
      const isWindowExpired = currentTime >= windowEnd
      
      // Reset window if expired
      const effectiveRequests = isWindowExpired ? 0 : currentRequests
      const effectiveWindowStart = isWindowExpired ? currentTime : windowStart
      const newWindowEnd = effectiveWindowStart + windowDuration
      
      const isAllowed = effectiveRequests < maxRequests
      const remainingRequests = Math.max(0, maxRequests - effectiveRequests - (isAllowed ? 1 : 0))
      
      return {
        isAllowed,
        remainingRequests,
        resetTime: newWindowEnd,
        windowEnd: newWindowEnd
      }
    }

    test('should allow requests within limit', () => {
      // Given: Rate limit window with available requests
      const maxRequests = 100
      const windowDuration = 60000 // 1 minute
      const currentRequests = 50
      const windowStart = Date.now()

      // When: Rate limit is calculated
      const result = calculateRateLimit(
        currentRequests,
        windowStart,
        windowDuration,
        maxRequests
      )

      // Then: Request should be allowed
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(49) // 100 - 50 - 1
      expect(result.resetTime).toBe(windowStart + windowDuration)
    })

    test('should deny requests when limit exceeded', () => {
      // Given: Rate limit window at maximum capacity
      const maxRequests = 100
      const windowDuration = 60000
      const currentRequests = 100
      const windowStart = Date.now()

      // When: Rate limit is calculated
      const result = calculateRateLimit(
        currentRequests,
        windowStart,
        windowDuration,
        maxRequests
      )

      // Then: Request should be denied
      expect(result.isAllowed).toBe(false)
      expect(result.remainingRequests).toBe(0)
      expect(result.resetTime).toBe(windowStart + windowDuration)
    })

    test('should reset window when expired', () => {
      // Given: Expired rate limit window
      const maxRequests = 100
      const windowDuration = 60000
      const currentRequests = 100 // Was at limit
      const windowStart = Date.now() - 70000 // Started 70 seconds ago (expired)

      // When: Rate limit is calculated
      const result = calculateRateLimit(
        currentRequests,
        windowStart,
        windowDuration,
        maxRequests
      )

      // Then: Window should reset and allow requests
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(99) // Fresh window: 100 - 1
      expect(result.resetTime).toBe(Date.now() + windowDuration)
    })

    test('should handle edge case at window boundary', () => {
      // Given: Request exactly at window expiry
      const maxRequests = 50
      const windowDuration = 30000
      const currentRequests = 49
      const windowStart = Date.now() - windowDuration // Exactly expired

      // When: Rate limit is calculated
      const result = calculateRateLimit(
        currentRequests,
        windowStart,
        windowDuration,
        maxRequests
      )

      // Then: Should start fresh window
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(49)
    })

    test('should calculate different limits for different time windows', () => {
      // Given: Different time window configurations
      const testCases = [
        { maxRequests: 60, windowDuration: 60000, expected: { perSecond: 1 } },     // 1/second
        { maxRequests: 1000, windowDuration: 3600000, expected: { perMinute: 16.67 } }, // ~16.67/minute
        { maxRequests: 10, windowDuration: 1000, expected: { perSecond: 10 } }      // 10/second
      ]

      testCases.forEach(({ maxRequests, windowDuration }) => {
        const result = calculateRateLimit(0, Date.now(), windowDuration, maxRequests)
        
        expect(result.isAllowed).toBe(true)
        expect(result.remainingRequests).toBe(maxRequests - 1)
        expect(result.resetTime).toBe(Date.now() + windowDuration)
      })
    })
  })

  describe('Sliding Window Rate Limiting', () => {
    interface SlidingWindow {
      timestamps: number[]
      maxRequests: number
      windowDuration: number
    }

    function slidingWindowRateLimit(
      window: SlidingWindow,
      currentTime: number = Date.now()
    ): {
      isAllowed: boolean
      remainingRequests: number
      oldestRequestTime: number | null
      nextResetTime: number | null
    } {
      const { timestamps, maxRequests, windowDuration } = window
      const windowStart = currentTime - windowDuration

      // Filter out requests outside current window
      const recentRequests = timestamps.filter(time => time >= windowStart)
      
      const isAllowed = recentRequests.length < maxRequests
      const remainingRequests = Math.max(0, maxRequests - recentRequests.length - (isAllowed ? 1 : 0))
      
      const oldestRequestTime = recentRequests.length > 0 ? Math.min(...recentRequests) : null
      const nextResetTime = oldestRequestTime ? oldestRequestTime + windowDuration : null

      return {
        isAllowed,
        remainingRequests,
        oldestRequestTime,
        nextResetTime
      }
    }

    test('should allow requests in sliding window', () => {
      // Given: Sliding window with some recent requests
      const currentTime = Date.now()
      const window: SlidingWindow = {
        timestamps: [
          currentTime - 30000, // 30 seconds ago
          currentTime - 15000, // 15 seconds ago
          currentTime - 5000   // 5 seconds ago
        ],
        maxRequests: 10,
        windowDuration: 60000 // 1 minute window
      }

      // When: Rate limit is checked
      const result = slidingWindowRateLimit(window, currentTime)

      // Then: Request should be allowed
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(6) // 10 - 3 - 1
      expect(result.oldestRequestTime).toBe(currentTime - 30000)
    })

    test('should deny requests when sliding window full', () => {
      // Given: Sliding window at capacity
      const currentTime = Date.now()
      const window: SlidingWindow = {
        timestamps: Array.from({ length: 10 }, (_, i) => currentTime - (i * 5000)), // 10 requests in last 45 seconds
        maxRequests: 10,
        windowDuration: 60000
      }

      // When: Rate limit is checked
      const result = slidingWindowRateLimit(window, currentTime)

      // Then: Request should be denied
      expect(result.isAllowed).toBe(false)
      expect(result.remainingRequests).toBe(0)
    })

    test('should exclude expired requests from sliding window', () => {
      // Given: Window with mix of recent and old requests
      const currentTime = Date.now()
      const window: SlidingWindow = {
        timestamps: [
          currentTime - 120000, // 2 minutes ago (expired)
          currentTime - 90000,  // 1.5 minutes ago (expired)
          currentTime - 30000,  // 30 seconds ago (valid)
          currentTime - 10000   // 10 seconds ago (valid)
        ],
        maxRequests: 5,
        windowDuration: 60000 // 1 minute window
      }

      // When: Rate limit is checked
      const result = slidingWindowRateLimit(window, currentTime)

      // Then: Only recent requests should count
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(2) // 5 - 2 - 1
      expect(result.oldestRequestTime).toBe(currentTime - 30000)
    })

    test('should calculate next reset time correctly', () => {
      // Given: Window with requests at different times
      const currentTime = Date.now()
      const window: SlidingWindow = {
        timestamps: [
          currentTime - 50000, // This will expire in 10 seconds
          currentTime - 30000,  // This will expire in 30 seconds
          currentTime - 10000   // This will expire in 50 seconds
        ],
        maxRequests: 3,
        windowDuration: 60000
      }

      // When: Rate limit is checked (at capacity)
      const result = slidingWindowRateLimit(window, currentTime)

      // Then: Next reset should be when oldest request expires
      expect(result.isAllowed).toBe(false)
      expect(result.nextResetTime).toBe((currentTime - 50000) + 60000)
    })
  })

  describe('User-Specific Rate Limiting', () => {
    interface UserRateLimit {
      userId: string
      requestCount: number
      windowStart: number
      isProUser: boolean
    }

    function calculateUserRateLimit(
      userLimit: UserRateLimit,
      windowDuration: number = 60000,
      currentTime: number = Date.now()
    ): {
      isAllowed: boolean
      remainingRequests: number
      maxRequests: number
      resetTime: number
      rateLimitTier: string
    } {
      const { userId, requestCount, windowStart, isProUser } = userLimit
      
      // Different limits based on user type
      const maxRequests = isProUser ? 200 : 60 // Pro users get higher limits
      const rateLimitTier = isProUser ? 'pro' : 'free'
      
      const windowEnd = windowStart + windowDuration
      const isWindowExpired = currentTime >= windowEnd
      
      // Reset if window expired
      const effectiveRequests = isWindowExpired ? 0 : requestCount
      const newResetTime = isWindowExpired ? currentTime + windowDuration : windowEnd
      
      const isAllowed = effectiveRequests < maxRequests
      const remainingRequests = Math.max(0, maxRequests - effectiveRequests - (isAllowed ? 1 : 0))
      
      return {
        isAllowed,
        remainingRequests,
        maxRequests,
        resetTime: newResetTime,
        rateLimitTier
      }
    }

    test('should apply different limits for free and pro users', () => {
      // Given: Free and pro users with same usage
      const currentTime = Date.now()
      const baseUserLimit = {
        userId: 'user123',
        requestCount: 50,
        windowStart: currentTime
      }

      const freeUserLimit: UserRateLimit = { ...baseUserLimit, isProUser: false }
      const proUserLimit: UserRateLimit = { ...baseUserLimit, isProUser: true }

      // When: Rate limits are calculated
      const freeResult = calculateUserRateLimit(freeUserLimit, 60000, currentTime)
      const proResult = calculateUserRateLimit(proUserLimit, 60000, currentTime)

      // Then: Pro user should have higher limits
      expect(freeResult.maxRequests).toBe(60)
      expect(proResult.maxRequests).toBe(200)
      
      expect(freeResult.remainingRequests).toBe(9)  // 60 - 50 - 1
      expect(proResult.remainingRequests).toBe(149) // 200 - 50 - 1
      
      expect(freeResult.rateLimitTier).toBe('free')
      expect(proResult.rateLimitTier).toBe('pro')
    })

    test('should handle free user hitting limit', () => {
      // Given: Free user at request limit
      const freeUserLimit: UserRateLimit = {
        userId: 'freeuser',
        requestCount: 60, // At free tier limit
        windowStart: Date.now(),
        isProUser: false
      }

      // When: Rate limit is calculated
      const result = calculateUserRateLimit(freeUserLimit)

      // Then: Request should be denied
      expect(result.isAllowed).toBe(false)
      expect(result.remainingRequests).toBe(0)
      expect(result.maxRequests).toBe(60)
    })

    test('should reset user limits when window expires', () => {
      // Given: User who hit limit in previous window
      const expiredUserLimit: UserRateLimit = {
        userId: 'resetuser',
        requestCount: 60, // Was at limit
        windowStart: Date.now() - 120000, // 2 minutes ago (expired)
        isProUser: false
      }

      // When: Rate limit is calculated
      const result = calculateUserRateLimit(expiredUserLimit)

      // Then: Should get fresh window
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(59) // Fresh 60 - 1
    })
  })

  describe('Global Rate Limiting', () => {
    interface GlobalRateLimit {
      totalRequests: number
      windowStart: number
      activeUsers: number
    }

    function calculateGlobalRateLimit(
      global: GlobalRateLimit,
      maxGlobalRequests: number = 10000,
      windowDuration: number = 60000,
      currentTime: number = Date.now()
    ): {
      isAllowed: boolean
      remainingRequests: number
      requestsPerUser: number
      resetTime: number
      utilizationPercent: number
    } {
      const { totalRequests, windowStart, activeUsers } = global
      
      const windowEnd = windowStart + windowDuration
      const isWindowExpired = currentTime >= windowEnd
      
      const effectiveRequests = isWindowExpired ? 0 : totalRequests
      const newResetTime = isWindowExpired ? currentTime + windowDuration : windowEnd
      
      const isAllowed = effectiveRequests < maxGlobalRequests
      const remainingRequests = Math.max(0, maxGlobalRequests - effectiveRequests - (isAllowed ? 1 : 0))
      const requestsPerUser = activeUsers > 0 ? Math.floor(effectiveRequests / activeUsers) : 0
      const utilizationPercent = (effectiveRequests / maxGlobalRequests) * 100
      
      return {
        isAllowed,
        remainingRequests,
        requestsPerUser,
        resetTime: newResetTime,
        utilizationPercent
      }
    }

    test('should enforce global rate limits', () => {
      // Given: Global rate limit approaching capacity
      const globalLimit: GlobalRateLimit = {
        totalRequests: 9500,
        windowStart: Date.now(),
        activeUsers: 150
      }

      // When: Global rate limit is calculated
      const result = calculateGlobalRateLimit(globalLimit, 10000)

      // Then: Should still allow requests but show high utilization
      expect(result.isAllowed).toBe(true)
      expect(result.remainingRequests).toBe(499) // 10000 - 9500 - 1
      expect(result.requestsPerUser).toBe(63) // 9500 / 150
      expect(result.utilizationPercent).toBe(95) // 9500 / 10000 * 100
    })

    test('should deny requests when global limit exceeded', () => {
      // Given: Global rate limit at capacity
      const globalLimit: GlobalRateLimit = {
        totalRequests: 10000,
        windowStart: Date.now(),
        activeUsers: 200
      }

      // When: Global rate limit is calculated
      const result = calculateGlobalRateLimit(globalLimit, 10000)

      // Then: Should deny requests
      expect(result.isAllowed).toBe(false)
      expect(result.remainingRequests).toBe(0)
      expect(result.utilizationPercent).toBe(100)
    })

    test('should calculate average requests per user', () => {
      // Given: Global usage with known user count
      const globalLimit: GlobalRateLimit = {
        totalRequests: 5000,
        windowStart: Date.now(),
        activeUsers: 100
      }

      // When: Global rate limit is calculated
      const result = calculateGlobalRateLimit(globalLimit)

      // Then: Should calculate correct average
      expect(result.requestsPerUser).toBe(50) // 5000 / 100
      expect(result.utilizationPercent).toBe(50) // 5000 / 10000 * 100
    })
  })

  describe('Rate Limit Headers and Responses', () => {
    interface RateLimitResponse {
      'X-RateLimit-Limit': number
      'X-RateLimit-Remaining': number
      'X-RateLimit-Reset': number
      'X-RateLimit-RetryAfter'?: number
    }

    function generateRateLimitHeaders(
      maxRequests: number,
      remainingRequests: number,
      resetTime: number,
      isAllowed: boolean,
      currentTime: number = Date.now()
    ): RateLimitResponse {
      const headers: RateLimitResponse = {
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': remainingRequests,
        'X-RateLimit-Reset': Math.floor(resetTime / 1000) // Unix timestamp in seconds
      }

      if (!isAllowed) {
        headers['X-RateLimit-RetryAfter'] = Math.ceil((resetTime - currentTime) / 1000)
      }

      return headers
    }

    test('should generate correct rate limit headers when allowed', () => {
      // Given: Allowed request with remaining capacity
      const maxRequests = 100
      const remainingRequests = 45
      const resetTime = Date.now() + 30000 // 30 seconds from now

      // When: Headers are generated
      const headers = generateRateLimitHeaders(
        maxRequests,
        remainingRequests,
        resetTime,
        true
      )

      // Then: Headers should be correct
      expect(headers['X-RateLimit-Limit']).toBe(100)
      expect(headers['X-RateLimit-Remaining']).toBe(45)
      expect(headers['X-RateLimit-Reset']).toBe(Math.floor(resetTime / 1000))
      expect(headers['X-RateLimit-RetryAfter']).toBeUndefined()
    })

    test('should include retry-after header when rate limited', () => {
      // Given: Rate limited request
      const maxRequests = 60
      const remainingRequests = 0
      const currentTime = Date.now()
      const resetTime = currentTime + 45000 // 45 seconds from now

      // When: Headers are generated for rate limited request
      const headers = generateRateLimitHeaders(
        maxRequests,
        remainingRequests,
        resetTime,
        false,
        currentTime
      )

      // Then: Should include retry-after header
      expect(headers['X-RateLimit-Limit']).toBe(60)
      expect(headers['X-RateLimit-Remaining']).toBe(0)
      expect(headers['X-RateLimit-Reset']).toBe(Math.floor(resetTime / 1000))
      expect(headers['X-RateLimit-RetryAfter']).toBe(45)
    })

    test('should handle edge case with immediate reset', () => {
      // Given: Rate limit that resets immediately
      const currentTime = Date.now()
      const resetTime = currentTime + 1000 // 1 second

      // When: Headers are generated
      const headers = generateRateLimitHeaders(50, 0, resetTime, false, currentTime)

      // Then: Retry-after should be 1 second
      expect(headers['X-RateLimit-RetryAfter']).toBe(1)
    })
  })

  describe('Rate Limit Bursting', () => {
    interface BurstRateLimit {
      tokens: number
      maxTokens: number
      refillRate: number // tokens per second
      lastRefill: number
    }

    function calculateTokenBucket(
      bucket: BurstRateLimit,
      requestCost: number = 1,
      currentTime: number = Date.now()
    ): {
      isAllowed: boolean
      remainingTokens: number
      nextRefillTime: number
      tokensToAdd: number
    } {
      const { tokens, maxTokens, refillRate, lastRefill } = bucket
      
      // Calculate time elapsed and tokens to add
      const timeElapsed = (currentTime - lastRefill) / 1000 // Convert to seconds
      const tokensToAdd = Math.floor(timeElapsed * refillRate)
      const newTokens = Math.min(maxTokens, tokens + tokensToAdd)
      
      // Check if request can be fulfilled
      const isAllowed = newTokens >= requestCost
      const remainingTokens = isAllowed ? newTokens - requestCost : newTokens
      
      // Calculate when next token will be available
      const nextRefillTime = currentTime + (1000 / refillRate) // Next token in milliseconds
      
      return {
        isAllowed,
        remainingTokens,
        nextRefillTime,
        tokensToAdd
      }
    }

    test('should allow burst requests when tokens available', () => {
      // Given: Token bucket with available tokens
      const bucket: BurstRateLimit = {
        tokens: 10,
        maxTokens: 10,
        refillRate: 1, // 1 token per second
        lastRefill: Date.now() - 5000 // 5 seconds ago
      }

      // When: Request is made
      const result = calculateTokenBucket(bucket, 3) // Request costs 3 tokens

      // Then: Request should be allowed
      expect(result.isAllowed).toBe(true)
      expect(result.tokensToAdd).toBe(5) // 5 seconds * 1 token/second
      expect(result.remainingTokens).toBe(12) // 10 + 5 - 3, but capped at maxTokens
    })

    test('should deny requests when insufficient tokens', () => {
      // Given: Token bucket with few tokens
      const bucket: BurstRateLimit = {
        tokens: 2,
        maxTokens: 10,
        refillRate: 0.5, // 0.5 tokens per second
        lastRefill: Date.now() - 1000 // 1 second ago
      }

      // When: Expensive request is made
      const result = calculateTokenBucket(bucket, 5) // Request costs 5 tokens

      // Then: Request should be denied
      expect(result.isAllowed).toBe(false)
      expect(result.tokensToAdd).toBe(0) // 1 second * 0.5 tokens/second = 0.5, floored to 0
      expect(result.remainingTokens).toBe(2) // No tokens consumed
    })

    test('should cap tokens at maximum bucket size', () => {
      // Given: Token bucket that would overflow
      const bucket: BurstRateLimit = {
        tokens: 8,
        maxTokens: 10,
        refillRate: 2, // 2 tokens per second
        lastRefill: Date.now() - 5000 // 5 seconds ago
      }

      // When: Small request is made
      const result = calculateTokenBucket(bucket, 1)

      // Then: Tokens should be capped at max
      expect(result.isAllowed).toBe(true)
      expect(result.tokensToAdd).toBe(10) // Would add 10 tokens
      expect(result.remainingTokens).toBe(9) // (8 + 10) capped to 10, minus 1 consumed
    })

    test('should calculate correct refill timing', () => {
      // Given: Empty token bucket
      const bucket: BurstRateLimit = {
        tokens: 0,
        maxTokens: 5,
        refillRate: 0.1, // 0.1 tokens per second (1 token every 10 seconds)
        lastRefill: Date.now()
      }

      // When: Request is made
      const result = calculateTokenBucket(bucket, 1)

      // Then: Should calculate next token availability
      expect(result.isAllowed).toBe(false)
      expect(result.nextRefillTime).toBe(Date.now() + 10000) // 10 seconds later
    })
  })
})