import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { timingSafeEqual } from 'crypto'

// Rate limiting configuration
const RATE_LIMITS = {
  api_key_operations: {
    windowMs: 60000, // 1 minute
    maxRequests: 10
  },
  api_key_tests: {
    windowMs: 60000, // 1 minute
    maxRequests: 5
  },
  general_api: {
    windowMs: 60000, // 1 minute
    maxRequests: 60
  }
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting middleware
export async function rateLimit(
  req: NextRequest,
  limitKey: keyof typeof RATE_LIMITS
): Promise<NextResponse | null> {
  const supabase = await createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500 }
    )
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const limit = RATE_LIMITS[limitKey]
  const key = `${limitKey}:${user.id}`
  const now = Date.now()

  const current = rateLimitStore.get(key)
  
  if (!current || current.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs
    })
    return null // Allow request
  }

  if (current.count >= limit.maxRequests) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000)
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': limit.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(current.resetTime).toISOString()
        }
      }
    )
  }

  current.count++
  return null // Allow request
}

// CSRF token validation
export function validateCSRFToken(req: NextRequest): boolean {
  const token = req.headers.get('X-CSRF-Token')
  const cookie = req.cookies.get('csrf_token')?.value

  if (!token || !cookie) {
    return false
  }

  const tokenBuffer = Buffer.from(token)
  const cookieBuffer = Buffer.from(cookie)

  if (tokenBuffer.length !== cookieBuffer.length) {
    return false
  }

  return timingSafeEqual(tokenBuffer, cookieBuffer)
}

// Input sanitization
export function sanitizeInput(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '')
    
    // Limit string length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000)
    }
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    
    return sanitized
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput)
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {}
    const inputObj = input as Record<string, unknown>
    for (const key in inputObj) {
      if (inputObj.hasOwnProperty(key)) {
        // Limit object depth to prevent deeply nested attacks
        if (getObjectDepth(inputObj[key]) < 5) {
          sanitized[sanitizeInput(key) as string] = sanitizeInput(inputObj[key])
        }
      }
    }
    return sanitized
  }
  
  return input
}

// Get object depth
function getObjectDepth(obj: unknown, currentDepth = 0): number {
  if (!obj || typeof obj !== 'object') {
    return currentDepth
  }
  
  let maxDepth = currentDepth
  const objRecord = obj as Record<string, unknown>
  for (const key in objRecord) {
    if (objRecord.hasOwnProperty(key)) {
      const depth = getObjectDepth(objRecord[key], currentDepth + 1)
      maxDepth = Math.max(maxDepth, depth)
    }
  }
  
  return maxDepth
}

// API key usage tracking
export async function trackApiKeyUsage(
  userId: string,
  provider: string,
  supabase: unknown
): Promise<void> {
  try {
    // Update last_used timestamp
    await (supabase as { from: (table: string) => { update: (data: Record<string, unknown>) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => Promise<unknown> } } } })
      .from('user_keys')
      .update({ last_used: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('provider', provider)

    // Log audit event
    await (supabase as { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<unknown> } })
      .from('api_key_audit_log')
      .insert({
        user_id: userId,
        provider,
        action: 'accessed',
        metadata: { timestamp: new Date().toISOString() }
      })
  } catch (error) {
    console.error('Failed to track API key usage:', error)
    // Don't fail the request if tracking fails
  }
}

// Security headers middleware
export function securityHeaders(response: NextResponse): NextResponse {
  // HSTS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Prevent MIME sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )
  
  return response
}

// Validate request origin
export function validateOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  
  if (!origin && !referer) {
    // Allow requests without origin (e.g., direct API calls)
    return true
  }
  
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3001'
  ].filter(Boolean)
  
  const requestOrigin = origin || new URL(referer!).origin
  
  return allowedOrigins.includes(requestOrigin)
}

// Check for suspicious patterns in API keys
export function detectSuspiciousApiKey(apiKey: string): {
  isSuspicious: boolean
  reason?: string
} {
  // Check for common test/demo keys
  const testKeyPatterns = [
    /test/i,
    /demo/i,
    /sample/i,
    /example/i,
    /^sk-0{10,}/,
    /^1234567890/
  ]
  
  for (const pattern of testKeyPatterns) {
    if (pattern.test(apiKey)) {
      return {
        isSuspicious: true,
        reason: 'Appears to be a test or demo key'
      }
    }
  }
  
  // Check for weak keys (all same character, sequential, etc.)
  if (/^(.)\1+$/.test(apiKey)) {
    return {
      isSuspicious: true,
      reason: 'Key contains repeated characters'
    }
  }
  
  // Check entropy (simplified check)
  const uniqueChars = new Set(apiKey).size
  if (uniqueChars < apiKey.length * 0.3) {
    return {
      isSuspicious: true,
      reason: 'Key has low entropy'
    }
  }
  
  return { isSuspicious: false }
}

// Audit log helper
export async function logSecurityEvent(
  supabase: unknown,
  userId: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await (supabase as { from: (table: string) => { insert: (data: Record<string, unknown>) => Promise<unknown> } })
      .from('api_key_audit_log')
      .insert({
        user_id: userId,
        provider: metadata.provider || 'system',
        action,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}