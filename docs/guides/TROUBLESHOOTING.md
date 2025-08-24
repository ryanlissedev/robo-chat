# 🔧 Troubleshooting Guide

## Quick Fixes for Common Issues

### 🚨 Emergency Commands

```bash
# Clear all caches and reinstall
rm -rf node_modules package-lock.json
rm -rf .next .turbo
npm cache clean --force
npm install
npm run dev

# Reset database (development only!)
npm run db:reset
npm run db:migrate
npm run db:seed

# Fix TypeScript issues
npm run typecheck -- --noEmit
npm run lint:fix

# Kill stuck processes
lsof -ti:3000 | xargs kill -9  # Kill process on port 3000
pkill -f "next dev"             # Kill all Next.js dev processes
```

## Common Development Issues

### 1. Build & Compilation Errors

#### TypeScript Errors

**Problem**: `Type 'X' is not assignable to type 'Y'`

```typescript
// ❌ Error
const message: Message = {
  role: 'user',
  content: ['Hello'] // Error: string[] not assignable to string
}

// ✅ Solution
const message: Message = {
  role: 'user',
  content: 'Hello' // Correct type
}
```

**Fix Steps**:
1. Check the type definition: `cmd+click` on the type
2. Verify the expected shape
3. Use type assertions if needed: `as Type`
4. Update interfaces if requirements changed

#### Module Resolution Errors

**Problem**: `Cannot find module '@/components/...'`

**Solutions**:
```json
// tsconfig.json - Check path aliases
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./app/*"],
      "@/components/*": ["./app/components/*"]
    }
  }
}
```

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npm run typecheck
```

#### ESLint Errors

**Problem**: `'X' is defined but never used`

```bash
# Auto-fix most issues
npm run lint:fix

# Check specific file
npx eslint app/components/chat.tsx

# Disable rule for line (use sparingly!)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```

### 2. Runtime Errors

#### Hydration Mismatches

**Problem**: `Hydration failed because the initial UI does not match`

**Common Causes & Fixes**:

```typescript
// ❌ Problem: Date/time differences
function Component() {
  return <div>{new Date().toLocaleString()}</div>
}

// ✅ Solution: Use useEffect
function Component() {
  const [date, setDate] = useState<string>('')
  
  useEffect(() => {
    setDate(new Date().toLocaleString())
  }, [])
  
  return <div>{date || 'Loading...'}</div>
}
```

```typescript
// ❌ Problem: Browser-only APIs
function Component() {
  return <div>{window.location.href}</div>
}

// ✅ Solution: Check for browser
function Component() {
  const [url, setUrl] = useState('')
  
  useEffect(() => {
    setUrl(window.location.href)
  }, [])
  
  return <div>{url}</div>
}
```

#### Infinite Loops

**Problem**: `Too many re-renders`

```typescript
// ❌ Problem: Missing dependency array
useEffect(() => {
  setData(fetchData())
}) // Runs on every render!

// ✅ Solution: Add dependencies
useEffect(() => {
  fetchData().then(setData)
}, []) // Runs once

// ❌ Problem: Updating state in render
function Component() {
  const [count, setCount] = useState(0)
  setCount(count + 1) // Infinite loop!
  return <div>{count}</div>
}

// ✅ Solution: Use effects or callbacks
function Component() {
  const [count, setCount] = useState(0)
  
  const increment = () => setCount(c => c + 1)
  
  return <button onClick={increment}>{count}</button>
}
```

### 3. API & Network Issues

#### CORS Errors

**Problem**: `Access to fetch at 'X' from origin 'Y' has been blocked by CORS`

**Solutions**:

```typescript
// app/api/proxy/route.ts - Create proxy endpoint
export async function POST(request: Request) {
  const { url, ...options } = await request.json()
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Origin': 'https://allowed-origin.com'
    }
  })
  
  return new Response(response.body, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': response.headers.get('Content-Type') || 'application/json'
    }
  })
}
```

#### Authentication Errors

**Problem**: `401 Unauthorized`

**Debug Steps**:
```typescript
// Check token in browser
console.log('Token:', localStorage.getItem('token'))

// Verify headers
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})

// Debug in API route
export async function GET(request: Request) {
  const auth = request.headers.get('Authorization')
  console.log('Auth header:', auth)
  
  if (!auth?.startsWith('Bearer ')) {
    return new Response('No token', { status: 401 })
  }
  
  const token = auth.slice(7)
  // Verify token...
}
```

### 4. Database Issues

#### Connection Errors

**Problem**: `Can't connect to database`

**Check List**:
```bash
# 1. Check environment variables
cat .env.local | grep DATABASE_URL

# 2. Test connection
npx prisma db pull

# 3. Check Supabase status
curl https://[PROJECT_REF].supabase.co/rest/v1/

# 4. Reset connection pool
npm run db:reset-pool
```

#### Migration Errors

**Problem**: `Database schema is out of sync`

```bash
# Generate migration from schema
npx prisma migrate dev --name fix_schema

# Apply pending migrations
npx prisma migrate deploy

# Reset everything (DEVELOPMENT ONLY!)
npx prisma migrate reset
```

#### Query Errors

**Problem**: `Invalid query or syntax error`

```typescript
// Debug SQL queries
const result = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`
console.log('Query result:', result)

// Enable query logging
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
})
```

### 5. Environment & Configuration

#### Missing Environment Variables

**Problem**: `Environment variable X is not defined`

**Solution Checklist**:
```bash
# 1. Check .env.local exists
ls -la .env*

# 2. Copy from example
cp .env.example .env.local

# 3. Verify loading
console.log('Env:', {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
})

# 4. Restart dev server after changes
npm run dev
```

#### Port Already in Use

**Problem**: `Port 3000 is already in use`

```bash
# Find process using port
lsof -i :3000

# Kill specific process
kill -9 [PID]

# Or use different port
PORT=3001 npm run dev
```

### 6. Styling Issues

#### Tailwind Not Working

**Problem**: Classes not applying

```javascript
// tailwind.config.js - Check content paths
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ]
}
```

```bash
# Rebuild CSS
npm run build:css

# Clear cache
rm -rf .next
npm run dev
```

#### Dark Mode Issues

**Problem**: Theme not switching

```typescript
// Check theme provider
function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 7. Performance Issues

#### Slow Development Server

**Solutions**:
```bash
# 1. Clear caches
rm -rf .next node_modules/.cache

# 2. Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run dev

# 3. Disable source maps in development
GENERATE_SOURCEMAP=false npm run dev
```

#### Memory Leaks

**Detection**:
```typescript
// Add memory monitoring
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const used = process.memoryUsage()
    console.log('Memory:', {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
    })
  }, 10000)
}
```

**Common Causes**:
- Event listeners not cleaned up
- Intervals/timeouts not cleared
- Large objects in closure scope
- Circular references

### 8. Testing Issues

#### Tests Failing Locally

```bash
# Clear test cache
npm test -- --clearCache

# Run single test file
npm test -- chat.test.tsx

# Debug mode
npm test -- --inspect-brk

# Update snapshots
npm test -- -u
```

#### Mocking Issues

```typescript
// Mock module
jest.mock('@/lib/api', () => ({
  fetchData: jest.fn(() => Promise.resolve({ data: 'test' }))
}))

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: 'test' }),
    ok: true
  })
)

// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks()
})
```

### 9. Deployment Issues

#### Build Failures

**Common Vercel/Netlify Errors**:

```bash
# Type errors only in production
npm run build # Run locally first

# Environment variables missing
# Check deployment platform settings

# Module not found
# Check case sensitivity (Linux vs Mac/Windows)
```

#### Runtime Errors in Production

**Debug Strategy**:
1. Check production logs
2. Add error boundary
3. Enable source maps temporarily
4. Use Sentry or similar for error tracking

```typescript
// Error boundary
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo)
    // Send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong</div>
    }
    return this.props.children
  }
}
```

## AI-Specific Issues

### Streaming Response Issues

**Problem**: Stream cuts off or doesn't display

```typescript
// Check SSE implementation
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ messages })
})

if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`)
}

const reader = response.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value)
  console.log('Chunk:', chunk) // Debug output
}
```

### Token Limit Errors

**Problem**: `Maximum token limit exceeded`

```typescript
// Implement token counting
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

function truncateMessages(messages: Message[], maxTokens = 4000) {
  let tokenCount = 0
  const truncated = []
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i].content)
    if (tokenCount + tokens > maxTokens) break
    truncated.unshift(messages[i])
    tokenCount += tokens
  }
  
  return truncated
}
```

### Provider-Specific Errors

**OpenAI**:
- Rate limits: Implement exponential backoff
- API key issues: Check formatting and permissions

**Anthropic**:
- Model availability: Check region support
- Context window: Different limits per model

**Google AI**:
- Safety filters: May block certain content
- Quota limits: Check Google Cloud Console

## Debugging Tools & Techniques

### Browser DevTools

```javascript
// Useful console commands
console.table(data) // Display data in table
console.time('operation') // Start timer
console.timeEnd('operation') // End timer
console.trace() // Stack trace

// Break on property change
const obj = { value: 1 }
Object.defineProperty(obj, 'value', {
  set(val) {
    debugger // Breaks here
    this._value = val
  },
  get() {
    return this._value
  }
})
```

### React DevTools

1. Install browser extension
2. Check component props/state
3. Profile performance
4. Track re-renders

### Network Debugging

```bash
# Monitor API calls
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}' \
  -v

# Check response headers
curl -I http://localhost:3000/api/health
```

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Next.js Debug",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 9229,
      "env": {
        "NODE_OPTIONS": "--inspect"
      }
    }
  ]
}
```

## Getting Help

### Before Asking for Help

1. **Check error message carefully** - Google exact error
2. **Review recent changes** - `git diff`
3. **Isolate the problem** - Create minimal reproduction
4. **Check logs** - Browser console, terminal, server logs
5. **Search existing issues** - GitHub, Stack Overflow

### How to Report Issues

```markdown
## Issue Template

**Environment:**
- OS: [e.g., macOS 14]
- Node: [e.g., v20.0.0]
- Browser: [e.g., Chrome 120]

**Description:**
Clear description of the issue

**Steps to Reproduce:**
1. Step one
2. Step two
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Error Messages:**
```
Paste full error here
```

**Code Sample:**
```typescript
// Minimal code to reproduce
```

**Attempted Solutions:**
- What you've tried
- What didn't work
```

### Useful Resources

- **Next.js Errors**: https://nextjs.org/docs/messages
- **TypeScript Errors**: https://typescript.tv/errors
- **React Errors**: https://react.dev/reference/react
- **MDN Web Docs**: https://developer.mozilla.org
- **Stack Overflow**: https://stackoverflow.com/questions/tagged/nextjs

## Prevention Tips

### Code Quality

1. **Use TypeScript strictly** - Catch errors at compile time
2. **Write tests** - Catch bugs before production
3. **Lint regularly** - Maintain consistent code
4. **Review PRs carefully** - Catch issues early
5. **Monitor errors** - Use error tracking services

### Development Practices

1. **Commit frequently** - Easy to rollback
2. **Use feature branches** - Isolate changes
3. **Test locally first** - Before pushing
4. **Document changes** - Help future debugging
5. **Keep dependencies updated** - Security and bug fixes

---

Remember: Every error is a learning opportunity. Document your solutions to help others! 🚀