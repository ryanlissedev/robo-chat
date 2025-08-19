# RoboRail Assistant - Code Style & Conventions

## TypeScript Configuration
- **Strict mode enabled**: All TypeScript strict checks are enforced
- **Target**: ES2017 for broad compatibility
- **Module resolution**: bundler (Next.js optimized)
- **Path aliases**: `@/*` maps to project root
- **Strict null checks**: Enabled for better type safety

## Code Style Guidelines

### Naming Conventions
- **Files**: kebab-case for components (`chat-input.tsx`), camelCase for utilities (`userStore.ts`)
- **Components**: PascalCase (`ChatInput`, `MessageList`)
- **Functions/Variables**: camelCase (`sendMessage`, `isLoading`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_MESSAGE_LENGTH`)
- **Types/Interfaces**: PascalCase (`MessageType`, `UserPreferences`)

### File Organization
```
app/                    # Next.js App Router pages
├── api/               # API routes
├── components/        # Page-specific components
├── hooks/            # Page-specific hooks
├── types/            # Type definitions
components/           # Reusable UI components
├── ui/              # shadcn/ui components
├── common/          # Common components
lib/                 # Core utilities and business logic
├── ai/              # AI-related utilities
├── models/          # AI model configurations
├── openproviders/   # AI provider integrations
├── security/        # Security utilities
├── supabase/        # Database utilities
tests/               # Test files
├── pages/           # Page object models for e2e tests
```

### Component Structure
```typescript
// Component imports
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Type definitions
interface ComponentProps {
  title: string
  onAction?: () => void
}

// Component implementation
export function Component({ title, onAction }: ComponentProps) {
  // State and hooks
  const [isLoading, setIsLoading] = useState(false)
  
  // Event handlers
  const handleClick = () => {
    setIsLoading(true)
    onAction?.()
  }
  
  // Render
  return (
    <div className="flex items-center gap-2">
      <h2>{title}</h2>
      <Button onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Action'}
      </Button>
    </div>
  )
}
```

### API Route Structure
```typescript
import { NextRequest } from 'next/server'

export const maxDuration = 60

interface RequestBody {
  message: string
  userId: string
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId }: RequestBody = await req.json()
    
    // Validation
    if (!message || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }
    
    // Business logic
    const result = await processMessage(message, userId)
    
    return new Response(JSON.stringify(result))
  } catch (error) {
    console.error('API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}
```

## Testing Conventions

### Unit Tests (Vitest)
- **File naming**: `*.test.ts` or `*.test.tsx`
- **Location**: Same directory as source file or `tests/` directory
- **Structure**: Describe blocks for grouping, descriptive test names

```typescript
import { describe, it, expect, vi } from 'vitest'
import { functionToTest } from './module'

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should handle normal case correctly', () => {
      const result = functionToTest('input')
      expect(result).toBe('expected')
    })
    
    it('should handle edge cases', () => {
      expect(() => functionToTest(null)).toThrow()
    })
  })
})
```

### E2E Tests (Playwright)
- **File naming**: `*.spec.ts`
- **Location**: `tests/` directory
- **Page Objects**: Use page object pattern for reusable interactions

```typescript
import { test, expect } from '@playwright/test'
import { ChatPage } from './pages/chat-page'

test.describe('Feature Name', () => {
  test('should perform expected behavior', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    
    await chatPage.sendMessage('test message')
    await expect(chatPage.lastMessage).toContainText('response')
  })
})
```

## Linting & Formatting
- **ESLint**: Next.js recommended config with TypeScript
- **Prettier**: Automatic formatting with Tailwind CSS plugin
- **Biome**: Additional linting and formatting
- **Ultracite**: Code formatting tool used in pre-commit hooks

## Import Organization
```typescript
// 1. React and Next.js imports
import { useState } from 'react'
import { NextRequest } from 'next/server'

// 2. Third-party libraries
import { clsx } from 'clsx'
import { Button } from '@radix-ui/react-button'

// 3. Internal imports (absolute paths)
import { cn } from '@/lib/utils'
import { ChatInput } from '@/components/chat-input'

// 4. Relative imports
import './styles.css'
```

## Error Handling
- **API Routes**: Always return proper HTTP status codes and error messages
- **Components**: Use error boundaries for React error handling
- **Async Operations**: Proper try-catch blocks with meaningful error messages
- **Type Safety**: Leverage TypeScript for compile-time error prevention

## Performance Guidelines
- **Code Splitting**: Use dynamic imports for large components
- **Memoization**: Use React.memo, useMemo, useCallback appropriately
- **Bundle Analysis**: Regular bundle size monitoring
- **Image Optimization**: Use Next.js Image component
- **Lazy Loading**: Implement for non-critical components