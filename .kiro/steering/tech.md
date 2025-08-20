# Technology Stack

## Core Framework
- **Next.js 15**: App Router with React Server Components
- **React 19**: Latest React with concurrent features
- **TypeScript 5**: Strict type checking enabled
- **Node.js 18+**: Runtime requirement

## UI & Styling
- **Tailwind CSS 4**: Utility-first CSS framework with custom theme
- **shadcn/ui**: Component library built on Radix UI primitives
- **Radix UI**: Accessible component primitives
- **Framer Motion**: Animation library for smooth transitions
- **Lucide React**: Icon library
- **next-themes**: Dark/light mode support

## AI & Language Models
- **Vercel AI SDK 5**: Core AI integration framework
- **OpenAI**: GPT-5 models (Mini/Standard/Pro) and GPT-4
- **Anthropic**: Claude models via @ai-sdk/anthropic
- **Google**: Gemini models via @ai-sdk/google
- **Mistral**: Mistral models via @ai-sdk/mistral
- **OpenRouter**: Multi-provider access
- **File Search**: OpenAI vector stores for document search

## Database & Backend
- **Supabase**: PostgreSQL database with real-time features
- **Supabase Auth**: User authentication and session management
- **Zustand**: Client-side state management
- **TanStack Query**: Server state management and caching

## Observability & Analytics
- **LangSmith**: LLM tracing and observability
- **Pino**: Structured logging
- **Custom metrics**: Token usage and performance tracking

## Development Tools
- **Biome**: Code formatting and linting (extends "ultracite" config)
- **ESLint**: Additional linting rules
- **Prettier**: Code formatting with Tailwind plugin
- **Husky**: Git hooks for pre-commit checks

## Common Commands

### Development
```bash
bun run dev          # Start development server with Turbopack
bun run build        # Build for production
bun run start        # Start production server
bun run lint         # Run ESLint
bun run type-check   # TypeScript type checking
```

### Database (Supabase)
```bash
bunx supabase migration up    # Run database migrations
bunx supabase start          # Start local Supabase
bunx supabase stop           # Stop local Supabase
```

### Docker
```bash
docker build -t base-chat .                    # Build Docker image
docker run -p 3000:3000 --env-file .env.local base-chat  # Run container
docker-compose up                              # Run with docker-compose
```

### Analysis
```bash
ANALYZE=true bun run build   # Bundle analysis
bun audit                    # Security audit
```

## Environment Configuration

### Required
- `OPENAI_API_KEY`: OpenAI API access
- `APP_MODE`: development/staging/production

### Optional
- `LANGSMITH_API_KEY`: Observability tracing
- `NEXT_PUBLIC_SUPABASE_URL`: Database connection
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Database access
- `SUPABASE_SERVICE_ROLE`: Admin database access
- `CSRF_SECRET`: Security token (32 chars)

## Build & Deployment
- **Vercel**: Recommended deployment platform
- **Docker**: Containerized deployment with standalone output
- **Self-hosted**: Node.js server deployment