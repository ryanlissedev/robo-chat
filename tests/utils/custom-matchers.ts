/**
 * Custom Vitest matchers for enhanced testing capabilities
 * Provides domain-specific assertions for better test readability and maintainability
 */

import { expect } from 'vitest';
// Import removed - using plain objects instead of MatcherResult/ExpectationResult types

// ============================================================================
// Type Definitions
// ============================================================================

interface CustomMatchers<R = unknown> {
  toBeValidEmail(): R;
  toBeValidUUID(): R;
  toBeValidTimestamp(): R;
  toBeValidJWT(): R;
  toBeWithinTimeRange(start: Date, end: Date): R;
  toMatchSupabaseUser(): R;
  toMatchSupabaseSession(): R;
  toMatchChatMessage(): R;
  toHaveValidAuthToken(): R;
  toBeValidFileUpload(): R;
  toBeEmptyOrNull(): R;
  toBeNonEmptyString(): R;
  toBeValidJSON(): R;
  toContainValidMarkdown(): R;
  toHaveStreamingResponse(): R;
  toBeValidAPIResponse(): R;
  toHaveErrorWithCode(code: string): R;
  toMatchApiKeyPattern(): R;
  toBeValidEncryptionKey(): R;
  toHaveValidPagination(): R;
  toBeValidConversation(): R;
  toHaveValidMetadata(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// ============================================================================
// Utility Functions
// ============================================================================

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidTimestamp = (timestamp: string): boolean => {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && timestamp === date.toISOString();
};

const isValidJWT = (token: string): boolean => {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  try {
    // Validate base64url encoding
    parts.forEach(part => {
      const decoded = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      if (!decoded) throw new Error('Invalid base64');
    });
    
    // Validate header
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    if (!header.alg || !header.typ) return false;
    
    // Validate payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (!payload.sub || !payload.aud) return false;
    
    return true;
  } catch {
    return false;
  }
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

// ============================================================================
// String Validation Matchers
// ============================================================================

expect.extend({
  toBeValidEmail(received: any) {
    const pass = typeof received === 'string' && isValidEmail(received);
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid email`
          : `Expected ${received} to be a valid email format`,
      actual: received,
      expected: 'valid email format',
    };
  },

  toBeValidUUID(received: any) {
    const pass = typeof received === 'string' && isValidUUID(received);
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID format`,
      actual: received,
      expected: 'valid UUID format',
    };
  },

  toBeValidTimestamp(received: any) {
    const pass = typeof received === 'string' && isValidTimestamp(received);
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid timestamp`
          : `Expected ${received} to be a valid ISO timestamp`,
      actual: received,
      expected: 'valid ISO timestamp',
    };
  },

  toBeValidJWT(received: any) {
    const pass = typeof received === 'string' && isValidJWT(received);
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid JWT`
          : `Expected ${received} to be a valid JWT token`,
      actual: received,
      expected: 'valid JWT token',
    };
  },

  toBeNonEmptyString(received: any) {
    const pass = typeof received === 'string' && received.trim().length > 0;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected "${received}" not to be a non-empty string`
          : `Expected "${received}" to be a non-empty string`,
      actual: received,
      expected: 'non-empty string',
    };
  },

  toBeEmptyOrNull(received: any) {
    const pass = received === null || received === undefined || 
                 (typeof received === 'string' && received.trim() === '') ||
                 (Array.isArray(received) && received.length === 0);
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be empty or null`
          : `Expected ${received} to be empty or null`,
      actual: received,
      expected: 'empty or null value',
    };
  },
});

// ============================================================================
// Time-based Matchers
// ============================================================================

expect.extend({
  toBeWithinTimeRange(received: any, start: Date, end: Date) {
    if (typeof received !== 'string' || !isValidTimestamp(received)) {
      return {
        pass: false,
        message: () => `Expected ${received} to be a valid timestamp`,
        actual: received,
        expected: 'valid timestamp',
      };
    }

    const receivedTime = new Date(received).getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();
    const pass = receivedTime >= startTime && receivedTime <= endTime;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be within ${start.toISOString()} and ${end.toISOString()}`
          : `Expected ${received} to be within ${start.toISOString()} and ${end.toISOString()}`,
      actual: received,
      expected: `timestamp between ${start.toISOString()} and ${end.toISOString()}`,
    };
  },
});

// ============================================================================
// Supabase-specific Matchers
// ============================================================================

expect.extend({
  toMatchSupabaseUser(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a Supabase User object`,
        actual: received,
        expected: 'Supabase User object',
      };
    }

    const requiredFields = ['id', 'email', 'created_at', 'updated_at', 'aud', 'role'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    const hasValidId = isValidUUID(received.id);
    const hasValidEmail = isValidEmail(received.email);
    const hasValidTimestamps = isValidTimestamp(received.created_at) && isValidTimestamp(received.updated_at);
    
    const pass = missingFields.length === 0 && hasValidId && hasValidEmail && hasValidTimestamps;
    
    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Expected Supabase User to have fields: ${missingFields.join(', ')}`;
        }
        if (!hasValidId) {
          return `Expected Supabase User to have valid UUID id, got: ${received.id}`;
        }
        if (!hasValidEmail) {
          return `Expected Supabase User to have valid email, got: ${received.email}`;
        }
        if (!hasValidTimestamps) {
          return `Expected Supabase User to have valid timestamps`;
        }
        return `Expected ${JSON.stringify(received)} not to match Supabase User format`;
      },
      actual: received,
      expected: 'valid Supabase User object',
    };
  },

  toMatchSupabaseSession(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a Supabase Session object`,
        actual: received,
        expected: 'Supabase Session object',
      };
    }

    const requiredFields = ['access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at', 'user'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    const hasValidTokens = isValidJWT(received.access_token) && typeof received.refresh_token === 'string';
    const hasValidExpiry = typeof received.expires_in === 'number' && typeof received.expires_at === 'number';
    const hasValidUser = received.user && typeof received.user === 'object';
    
    const pass = missingFields.length === 0 && hasValidTokens && hasValidExpiry && hasValidUser;
    
    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Expected Supabase Session to have fields: ${missingFields.join(', ')}`;
        }
        if (!hasValidTokens) {
          return `Expected Supabase Session to have valid tokens`;
        }
        if (!hasValidExpiry) {
          return `Expected Supabase Session to have valid expiry times`;
        }
        if (!hasValidUser) {
          return `Expected Supabase Session to have valid user object`;
        }
        return `Expected ${JSON.stringify(received)} not to match Supabase Session format`;
      },
      actual: received,
      expected: 'valid Supabase Session object',
    };
  },
});

// ============================================================================
// Chat-specific Matchers
// ============================================================================

expect.extend({
  toMatchChatMessage(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a Chat Message object`,
        actual: received,
        expected: 'Chat Message object',
      };
    }

    const requiredFields = ['id', 'role', 'content', 'timestamp'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    const hasValidRole = ['user', 'assistant', 'system'].includes(received.role);
    const hasValidContent = typeof received.content === 'string' && received.content.length > 0;
    const hasValidTimestamp = isValidTimestamp(received.timestamp);
    
    const pass = missingFields.length === 0 && hasValidRole && hasValidContent && hasValidTimestamp;
    
    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Expected Chat Message to have fields: ${missingFields.join(', ')}`;
        }
        if (!hasValidRole) {
          return `Expected Chat Message to have valid role (user, assistant, system), got: ${received.role}`;
        }
        if (!hasValidContent) {
          return `Expected Chat Message to have non-empty content`;
        }
        if (!hasValidTimestamp) {
          return `Expected Chat Message to have valid timestamp`;
        }
        return `Expected ${JSON.stringify(received)} not to match Chat Message format`;
      },
      actual: received,
      expected: 'valid Chat Message object',
    };
  },

  toBeValidConversation(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a Conversation object`,
        actual: received,
        expected: 'Conversation object',
      };
    }

    const requiredFields = ['id', 'title', 'messages', 'createdAt'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    const hasValidMessages = Array.isArray(received.messages);
    const hasValidTimestamp = isValidTimestamp(received.createdAt);
    
    const pass = missingFields.length === 0 && hasValidMessages && hasValidTimestamp;
    
    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Expected Conversation to have fields: ${missingFields.join(', ')}`;
        }
        if (!hasValidMessages) {
          return `Expected Conversation to have messages array`;
        }
        if (!hasValidTimestamp) {
          return `Expected Conversation to have valid timestamp`;
        }
        return `Expected ${JSON.stringify(received)} not to match Conversation format`;
      },
      actual: received,
      expected: 'valid Conversation object',
    };
  },
});

// ============================================================================
// API Response Matchers
// ============================================================================

expect.extend({
  toBeValidAPIResponse(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be an API Response object`,
        actual: received,
        expected: 'API Response object',
      };
    }

    const hasDataOrError = 'data' in received || 'error' in received;
    const hasValidStructure = typeof received === 'object' && received !== null;
    
    const pass = hasValidStructure && hasDataOrError;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${JSON.stringify(received)} not to be a valid API response`
          : `Expected API response to have 'data' or 'error' field`,
      actual: received,
      expected: 'valid API response with data or error',
    };
  },

  toHaveErrorWithCode(received: any, code: string) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be an error object`,
        actual: received,
        expected: 'error object',
      };
    }

    const hasError = 'error' in received && received.error;
    const hasCorrectCode = hasError && 
      (received.error.code === code || received.error.message?.includes(code));
    
    const pass = hasError && hasCorrectCode;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected error not to have code ${code}`
          : `Expected error to have code ${code}, got: ${received.error?.code || 'no code'}`,
      actual: received.error?.code || 'no error',
      expected: code,
    };
  },

  toHaveStreamingResponse(received: any) {
    const isResponse = received instanceof Response;
    const hasCorrectHeaders = isResponse && 
      received.headers.get('content-type')?.includes('text/stream') ||
      received.headers.get('content-type')?.includes('text/plain');
    const hasBody = isResponse && received.body;
    
    const pass = isResponse && hasCorrectHeaders && hasBody;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected response not to be a streaming response`
          : `Expected response to be a streaming response with correct headers and body`,
      actual: received,
      expected: 'streaming Response object',
    };
  },
});

// ============================================================================
// File and Content Matchers
// ============================================================================

expect.extend({
  toBeValidJSON(received: any) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string`,
        actual: received,
        expected: 'JSON string',
      };
    }

    try {
      JSON.parse(received);
      return {
        pass: true,
        message: () => `Expected ${received} not to be valid JSON`,
        actual: received,
        expected: 'valid JSON string',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to be valid JSON, got error: ${error instanceof Error ? error.message : String(error)}`,
        actual: received,
        expected: 'valid JSON string',
      };
    }
  },

  toContainValidMarkdown(received: any) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string`,
        actual: received,
        expected: 'markdown string',
      };
    }

    // Check for common markdown patterns
    const hasHeaders = /^#+\s/.test(received);
    const hasCodeBlocks = /```[\s\S]*```/.test(received);
    const hasBold = /\*\*[\s\S]*\*\*/.test(received);
    const hasItalic = /\*[\s\S]*\*/.test(received);
    const hasLinks = /\[[\s\S]*\]\([\s\S]*\)/.test(received);
    
    const pass = hasHeaders || hasCodeBlocks || hasBold || hasItalic || hasLinks;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to contain valid markdown`
          : `Expected ${received} to contain valid markdown syntax`,
      actual: received,
      expected: 'string with markdown syntax',
    };
  },

  toBeValidFileUpload(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a file upload object`,
        actual: received,
        expected: 'file upload object',
      };
    }

    const requiredFields = ['filename', 'mimetype', 'size'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    const hasValidFilename = typeof received.filename === 'string' && received.filename.length > 0;
    const hasValidMimetype = typeof received.mimetype === 'string' && received.mimetype.includes('/');
    const hasValidSize = typeof received.size === 'number' && received.size >= 0;
    
    const pass = missingFields.length === 0 && hasValidFilename && hasValidMimetype && hasValidSize;
    
    return {
      pass,
      message: () => {
        if (missingFields.length > 0) {
          return `Expected file upload to have fields: ${missingFields.join(', ')}`;
        }
        if (!hasValidFilename) {
          return `Expected file upload to have valid filename`;
        }
        if (!hasValidMimetype) {
          return `Expected file upload to have valid mimetype`;
        }
        if (!hasValidSize) {
          return `Expected file upload to have valid size`;
        }
        return `Expected ${JSON.stringify(received)} not to match file upload format`;
      },
      actual: received,
      expected: 'valid file upload object',
    };
  },
});

// ============================================================================
// Security and Encryption Matchers
// ============================================================================

expect.extend({
  toMatchApiKeyPattern(received: any) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string`,
        actual: received,
        expected: 'API key string',
      };
    }

    // Check common API key patterns
    const patterns = [
      /^[A-Za-z0-9_-]{32,}$/, // Generic base64-like
      /^sk-[A-Za-z0-9]{48}$/, // OpenAI-style
      /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, // JWT-style
    ];

    const pass = patterns.some(pattern => pattern.test(received));
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to match API key pattern`
          : `Expected ${received} to match a valid API key pattern`,
      actual: received,
      expected: 'valid API key format',
    };
  },

  toBeValidEncryptionKey(received: any) {
    if (typeof received !== 'string') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a string`,
        actual: received,
        expected: 'encryption key string',
      };
    }

    try {
      const decoded = Buffer.from(received, 'base64');
      const pass = decoded.length >= 32; // At least 256 bits
      
      return {
        pass,
        message: () => 
          pass 
            ? `Expected ${received} not to be a valid encryption key`
            : `Expected ${received} to be a valid base64-encoded encryption key (at least 32 bytes)`,
        actual: `${decoded.length} bytes`,
        expected: 'at least 32 bytes',
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to be valid base64-encoded encryption key`,
        actual: received,
        expected: 'base64-encoded encryption key',
      };
    }
  },
});

// ============================================================================
// Pagination and Metadata Matchers
// ============================================================================

expect.extend({
  toHaveValidPagination(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to be a pagination object`,
        actual: received,
        expected: 'pagination object',
      };
    }

    const hasPage = typeof received.page === 'number' && received.page >= 1;
    const hasLimit = typeof received.limit === 'number' && received.limit > 0;
    const hasTotal = typeof received.total === 'number' && received.total >= 0;
    
    const pass = hasPage && hasLimit && hasTotal;
    
    return {
      pass,
      message: () => {
        if (!hasPage) return `Expected pagination to have valid page number (>= 1)`;
        if (!hasLimit) return `Expected pagination to have valid limit (> 0)`;
        if (!hasTotal) return `Expected pagination to have valid total (>= 0)`;
        return `Expected ${JSON.stringify(received)} not to have valid pagination`;
      },
      actual: received,
      expected: 'valid pagination object',
    };
  },

  toHaveValidMetadata(received: any) {
    if (!received || typeof received !== 'object') {
      return {
        pass: false,
        message: () => `Expected ${received} to have metadata object`,
        actual: received,
        expected: 'object with metadata',
      };
    }

    const hasMetadata = 'metadata' in received && typeof received.metadata === 'object';
    const metadataNotNull = hasMetadata && received.metadata !== null;
    
    const pass = hasMetadata && metadataNotNull;
    
    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${JSON.stringify(received)} not to have valid metadata`
          : `Expected object to have valid metadata field`,
      actual: received.metadata,
      expected: 'valid metadata object',
    };
  },
});

// Export for manual usage if needed
export {
  isValidEmail,
  isValidUUID,
  isValidTimestamp,
  isValidJWT,
  formatDuration,
};