# 🧪 Testing Guide

## Testing Philosophy

RoboChat follows a comprehensive testing strategy with emphasis on reliability, maintainability, and developer experience. We use Test-Driven Development (TDD) practices and aim for high test coverage while maintaining test quality.

## Test Stack

- **Vitest**: Fast unit testing framework
- **Testing Library**: React component testing
- **Playwright**: End-to-end testing
- **MSW**: API mocking
- **Faker.js**: Test data generation
- **Coverage**: Istanbul/C8

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── components/         # React component tests
│   ├── hooks/              # Custom hook tests
│   ├── lib/                # Utility function tests
│   └── api/                # API handler tests
├── integration/            # Integration tests
│   ├── flows/              # User flow tests
│   └── api/                # API integration tests
├── e2e/                     # End-to-end tests
│   ├── auth/               # Authentication flows
│   ├── chat/               # Chat functionality
│   └── files/              # File handling
├── fixtures/               # Test data
├── mocks/                  # Mock implementations
└── utils/                  # Test utilities
```

## Running Tests

### Quick Commands
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test suite
npm test -- components/chat

# Run with UI
npm run test:ui

# Debug tests
npm run test:debug
```

### Test Types

#### Unit Tests
```bash
npm run test:unit
```

#### Integration Tests
```bash
npm run test:integration
```

#### E2E Tests
```bash
npm run test:e2e
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/components/chat-message.test.tsx
import { render, screen } from '@testing-library/react'
import { ChatMessage } from '@/app/components/chat/message'
import { vi } from 'vitest'

describe('ChatMessage', () => {
  const mockMessage = {
    id: '1',
    role: 'assistant' as const,
    content: 'Hello, how can I help?',
    createdAt: new Date().toISOString(),
  }

  it('should render message content', () => {
    render(<ChatMessage message={mockMessage} />)
    
    expect(screen.getByText('Hello, how can I help?')).toBeInTheDocument()
  })

  it('should display correct role icon', () => {
    render(<ChatMessage message={mockMessage} />)
    
    const icon = screen.getByTestId('role-icon')
    expect(icon).toHaveClass('assistant-icon')
  })

  it('should handle markdown content', () => {
    const markdownMessage = {
      ...mockMessage,
      content: '**Bold** and *italic* text',
    }
    
    render(<ChatMessage message={markdownMessage} />)
    
    const boldText = screen.getByText('Bold')
    expect(boldText).toHaveStyle({ fontWeight: 'bold' })
  })
})
```

### Hook Test Example

```typescript
// tests/unit/hooks/use-chat.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChat } from '@/app/hooks/use-chat'
import { server } from '@/tests/mocks/server'
import { rest } from 'msw'

describe('useChat', () => {
  it('should load messages', async () => {
    const { result } = renderHook(() => useChat('chat-1'))
    
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3)
    })
    
    expect(result.current.loading).toBe(false)
  })

  it('should send message', async () => {
    const { result } = renderHook(() => useChat('chat-1'))
    
    await act(async () => {
      await result.current.sendMessage('Hello')
    })
    
    expect(result.current.messages).toContainEqual(
      expect.objectContaining({
        content: 'Hello',
        role: 'user',
      })
    )
  })

  it('should handle errors', async () => {
    server.use(
      rest.post('/api/chat', (req, res, ctx) => {
        return res(ctx.status(500))
      })
    )
    
    const { result } = renderHook(() => useChat('chat-1'))
    
    await act(async () => {
      await result.current.sendMessage('Test')
    })
    
    expect(result.current.error).toBeTruthy()
  })
})
```

### API Test Example

```typescript
// tests/unit/api/chat.test.ts
import { POST } from '@/app/api/chat/route'
import { createMockRequest } from '@/tests/utils'
import { vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(() => ({ user: { id: 'user-1' } })),
}))

describe('POST /api/chat', () => {
  it('should stream response', async () => {
    const request = createMockRequest({
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4o',
    })
    
    const response = await POST(request)
    
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/event-stream')
  })

  it('should validate input', async () => {
    const request = createMockRequest({
      messages: [], // Invalid: empty messages
    })
    
    const response = await POST(request)
    
    expect(response.status).toBe(400)
    const error = await response.json()
    expect(error.error.code).toBe('INVALID_REQUEST')
  })

  it('should require authentication', async () => {
    vi.mocked(getSession).mockResolvedValueOnce(null)
    
    const request = createMockRequest({
      messages: [{ role: 'user', content: 'Hello' }],
    })
    
    const response = await POST(request)
    
    expect(response.status).toBe(401)
  })
})
```

## Integration Testing

### User Flow Test

```typescript
// tests/integration/flows/chat-flow.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/page'
import { mockAuth } from '@/tests/utils/auth'

describe('Chat Flow', () => {
  beforeEach(() => {
    mockAuth({ user: { id: 'test-user' } })
  })

  it('should complete full chat interaction', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Type message
    const input = screen.getByPlaceholderText('Type a message...')
    await user.type(input, 'What is the weather?')
    
    // Send message
    const sendButton = screen.getByRole('button', { name: 'Send' })
    await user.click(sendButton)
    
    // Wait for response
    await waitFor(() => {
      expect(screen.getByText(/weather/i)).toBeInTheDocument()
    })
    
    // Verify message saved
    expect(screen.getAllByTestId('chat-message')).toHaveLength(2)
  })

  it('should handle file attachments', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Upload file
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('Upload file')
    
    await user.upload(input, file)
    
    // Verify file displayed
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })
})
```

## E2E Testing

### Playwright Test Example

```typescript
// tests/e2e/chat/conversation.spec.ts
import { test, expect } from '@playwright/test'
import { loginUser, createChat } from '@/tests/e2e/helpers'

test.describe('Chat Conversation', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, 'test@example.com')
  })

  test('should send and receive messages', async ({ page }) => {
    await createChat(page)
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Hello AI')
    await page.click('[data-testid="send-button"]')
    
    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible()
    
    // Verify streaming
    const message = page.locator('[data-testid="assistant-message"]').first()
    await expect(message).toContainText('Hello')
  })

  test('should handle multiple chats', async ({ page }) => {
    // Create first chat
    await createChat(page)
    await page.fill('[data-testid="chat-input"]', 'First chat')
    await page.click('[data-testid="send-button"]')
    
    // Create second chat
    await page.click('[data-testid="new-chat"]')
    await page.fill('[data-testid="chat-input"]', 'Second chat')
    await page.click('[data-testid="send-button"]')
    
    // Switch back to first
    await page.click('[data-testid="chat-list"] >> text=First chat')
    
    // Verify correct chat loaded
    await expect(page.locator('[data-testid="user-message"]')).toContainText('First chat')
  })

  test('should export chat', async ({ page }) => {
    await createChat(page)
    
    // Add messages
    await page.fill('[data-testid="chat-input"]', 'Test message')
    await page.click('[data-testid="send-button"]')
    
    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-chat"]'),
    ])
    
    expect(download.suggestedFilename()).toContain('.json')
  })
})
```

## Test Data & Mocking

### Mock Server Setup

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

// tests/setup.ts
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Mock Handlers

```typescript
// tests/mocks/handlers/chat.ts
import { rest } from 'msw'

export const chatHandlers = [
  rest.post('/api/chat', async (req, res, ctx) => {
    const { messages } = await req.json()
    
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/event-stream'),
      ctx.body(`data: {"type":"text","content":"Hello from mock"}\ndata: [DONE]\n`)
    )
  }),
  
  rest.get('/api/chats/:id', (req, res, ctx) => {
    return res(
      ctx.json({
        id: req.params.id,
        title: 'Test Chat',
        messages: [],
      })
    )
  }),
]
```

### Test Fixtures

```typescript
// tests/fixtures/messages.ts
import { faker } from '@faker-js/faker'

export function createMockMessage(overrides = {}) {
  return {
    id: faker.string.uuid(),
    role: faker.helpers.arrayElement(['user', 'assistant']),
    content: faker.lorem.paragraph(),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  }
}

export function createMockChat(overrides = {}) {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.sentence(),
    messages: Array.from({ length: 5 }, createMockMessage),
    createdAt: faker.date.recent().toISOString(),
    ...overrides,
  }
}
```

## Test Utilities

### Custom Render

```typescript
// tests/utils/render.tsx
import { render as rtlRender } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/components/providers/theme'

function render(ui: React.ReactElement, options = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...options })
}

export * from '@testing-library/react'
export { render }
```

### Test Helpers

```typescript
// tests/utils/helpers.ts
export async function waitForStream(stream: ReadableStream) {
  const reader = stream.getReader()
  const chunks: string[] = []
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(new TextDecoder().decode(value))
  }
  
  return chunks.join('')
}

export function mockSupabase() {
  return {
    auth: {
      getUser: vi.fn(() => ({ data: { user: { id: 'test' } } })),
      signIn: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  }
}
```

## Coverage Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
        '*.config.js',
        '.next/',
        'public/',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests focused on single behavior

### Test Data
- Use factories for complex objects
- Avoid hardcoded test data
- Clean up after tests
- Use realistic data

### Mocking
- Mock external dependencies
- Avoid over-mocking
- Verify mock calls when relevant
- Reset mocks between tests

### Async Testing
- Always await async operations
- Use waitFor for DOM updates
- Handle loading states
- Test error scenarios

### Performance
- Run tests in parallel when possible
- Use test.skip for slow tests
- Optimize test setup
- Share expensive setup

## Debugging Tests

### VS Code Debug Config

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:debug"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Commands

```bash
# Run single test with debugging
npm run test:debug -- chat-message.test.tsx

# Run with Node inspector
node --inspect-brk ./node_modules/.bin/vitest run

# Use console.log debugging
DEBUG=* npm test
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      
      - name: Unit Tests
        run: npm run test:unit
      
      - name: Integration Tests
        run: npm run test:integration
      
      - name: E2E Tests
        run: npx playwright install && npm run test:e2e
      
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Common Testing Patterns

### Testing Streaming Responses

```typescript
test('should handle streaming', async () => {
  const stream = await chatStream('Hello')
  const chunks = []
  
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  
  expect(chunks).toContain(
    expect.objectContaining({ type: 'text' })
  )
})
```

### Testing File Uploads

```typescript
test('should upload file', async () => {
  const file = new File(['test'], 'test.txt')
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch('/api/files', {
    method: 'POST',
    body: formData,
  })
  
  expect(response.ok).toBe(true)
})
```

### Testing Auth Protected Routes

```typescript
test('should require auth', async () => {
  const { getByText } = render(<ProtectedPage />, {
    wrapper: ({ children }) => (
      <AuthProvider user={null}>
        {children}
      </AuthProvider>
    ),
  })
  
  expect(getByText('Please login')).toBeInTheDocument()
})
```

## Troubleshooting

### Common Issues

1. **Flaky Tests**
   - Add proper waits
   - Check for race conditions
   - Mock time-dependent code

2. **Memory Leaks**
   - Clean up timers
   - Unmount components
   - Close connections

3. **Slow Tests**
   - Use test.concurrent
   - Optimize setup
   - Mock heavy operations

4. **Coverage Gaps**
   - Test error paths
   - Cover edge cases
   - Test conditional logic