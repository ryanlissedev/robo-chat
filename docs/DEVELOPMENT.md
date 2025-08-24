# 🚀 Development Guide

## Prerequisites

### Required Software
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher (or yarn/pnpm)
- **Git**: Latest version
- **VS Code** (recommended) or your preferred IDE

### Required Accounts
- **Supabase Account**: For database and authentication
- **AI Provider API Keys**: At least one of:
  - OpenAI API key
  - Anthropic API key
  - Google AI API key
  - Other supported providers

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/robo-chat.git
cd robo-chat
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Configuration

Create `.env.local` file:
```bash
cp .env.example .env.local
```

Configure your environment variables:
```env
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
MISTRAL_API_KEY=...
PERPLEXITY_API_KEY=...
XAI_API_KEY=...
OPENROUTER_API_KEY=...

# Optional: Observability
LANGSMITH_API_KEY=ls-...
LANGSMITH_PROJECT=robo-chat
LANGSMITH_TRACING=true

# Optional: Analytics
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Security
CSRF_SECRET=generate-32-char-random-string
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=60
```

### 4. Database Setup

#### Option A: Use Supabase Cloud
1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env.local`
3. Run migrations:
```bash
npx supabase db push
```

#### Option B: Local Supabase
```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Get local credentials
supabase status
```

### 5. Database Migrations

Apply database schema:
```sql
-- Run in Supabase SQL editor
CREATE TABLE IF NOT EXISTS chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    model TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')),
    content JSONB,
    message_group_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own chats" ON chats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own chats" ON chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = messages.chat_id 
            AND chats.user_id = auth.uid()
        )
    );
```

## Development Workflow

### 1. Start Development Server
```bash
npm run dev
# App runs on http://localhost:3000
```

### 2. Project Structure
```
robo-chat/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   └── types/             # TypeScript types
├── lib/                    # Shared utilities
│   ├── ai/                # AI provider configs
│   ├── auth/              # Auth utilities
│   ├── cache/             # Caching logic
│   ├── db/                # Database utilities
│   └── tools/             # AI tools
├── public/                 # Static assets
├── tests/                  # Test files
└── docs/                   # Documentation
```

### 3. Development Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build           # Build for production
npm run start           # Start production server

# Testing
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:e2e        # E2E tests only
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report

# Code Quality
npm run lint            # ESLint
npm run lint:fix        # Fix linting issues
npm run type-check      # TypeScript check
npm run format          # Prettier formatting

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed data
npm run db:reset        # Reset database
```

## Code Style Guidelines

### TypeScript Best Practices
```typescript
// ✅ Good: Use type inference where possible
const message = "Hello" // Type inferred as string

// ✅ Good: Explicit types for function parameters
function processMessage(content: string, role: MessageRole): Message {
  return { content, role, timestamp: new Date() }
}

// ✅ Good: Use interfaces for object shapes
interface User {
  id: string
  email: string
  name?: string // Optional property
}

// ❌ Bad: Using 'any'
const data: any = fetchData() // Avoid any

// ✅ Good: Use 'unknown' for truly unknown types
const data: unknown = fetchData()
if (isValidData(data)) {
  // Type guard to narrow type
}
```

### React Component Patterns
```tsx
// ✅ Good: Functional component with TypeScript
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button 
      className={cn('btn', `btn-${variant}`)}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// ✅ Good: Custom hooks
function useChat(chatId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // Load chat logic
  }, [chatId])
  
  return { messages, loading }
}
```

### File Organization
```typescript
// components/chat/message.tsx
import { type FC } from 'react'
import { cn } from '@/lib/utils'
import type { Message } from '@/app/types'

interface MessageProps {
  message: Message
  isLast?: boolean
}

export const ChatMessage: FC<MessageProps> = ({ message, isLast }) => {
  // Component logic
}
```

## Common Development Tasks

### Adding a New AI Provider

1. Create provider configuration:
```typescript
// lib/ai/providers/new-provider.ts
import { createProvider } from '@/lib/ai/base'

export const newProvider = createProvider({
  name: 'new-provider',
  models: ['model-1', 'model-2'],
  defaultModel: 'model-1',
  apiKeyEnv: 'NEW_PROVIDER_API_KEY',
})
```

2. Register in provider registry:
```typescript
// lib/ai/registry.ts
import { newProvider } from './providers/new-provider'

export const providers = {
  // ... existing providers
  'new-provider': newProvider,
}
```

### Creating a New Tool

1. Define tool schema:
```typescript
// lib/tools/my-tool.ts
import { z } from 'zod'
import { createTool } from '@/lib/tools/base'

export const myTool = createTool({
  name: 'my_tool',
  description: 'Tool description',
  inputSchema: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    // Tool logic
    return { result: 'data' }
  },
})
```

2. Register tool:
```typescript
// lib/tools/index.ts
export const tools = {
  // ... existing tools
  my_tool: myTool,
}
```

### Adding a New Component

1. Create component file:
```tsx
// app/components/my-component.tsx
'use client'

import { type FC } from 'react'

interface MyComponentProps {
  title: string
}

export const MyComponent: FC<MyComponentProps> = ({ title }) => {
  return <div>{title}</div>
}
```

2. Add tests:
```tsx
// tests/unit/my-component.test.tsx
import { render, screen } from '@testing-library/react'
import { MyComponent } from '@/app/components/my-component'

describe('MyComponent', () => {
  it('renders title', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

## Debugging

### Chrome DevTools
1. Open Chrome DevTools (F12)
2. Use Network tab for API calls
3. Use Console for client-side logs
4. Use React DevTools extension

### VS Code Debugging
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug",
      "type": "node",
      "request": "launch",
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

### Server-Side Logging
```typescript
// Use server-side console
console.log('[API]', 'Processing request:', { userId, chatId })

// Or use logger utility
import { logger } from '@/lib/logger'
logger.info('Processing chat request', { userId, chatId })
```

## Performance Optimization

### 1. Code Splitting
```typescript
// Dynamic imports for heavy components
const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <Skeleton />,
  ssr: false, // Disable SSR if not needed
})
```

### 2. Image Optimization
```tsx
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={50}
  priority // For above-fold images
/>
```

### 3. API Route Optimization
```typescript
// Cache responses
export async function GET(request: Request) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate',
    },
  })
}
```

## Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### Type Errors
```bash
# Check types
npm run type-check

# Generate types from Supabase
npx supabase gen types typescript --local > app/types/database.types.ts
```

#### Database Connection Issues
```bash
# Check Supabase status
supabase status

# Reset local database
supabase db reset
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)