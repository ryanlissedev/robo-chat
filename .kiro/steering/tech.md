# RoboRail Assistant - Technology Stack

## Core Technologies

### Frontend Framework
- **Next.js 15** (App Router) - React-based full-stack framework
- **React 19** - UI library with latest features
- **TypeScript** - Type-safe JavaScript development

### Runtime & Package Manager
- **Bun** - Fast JavaScript runtime and package manager
- **Node.js 18+** - Alternative runtime support

### UI & Styling
- **Tailwind CSS v4** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components built on Radix UI
- **Radix UI** - Unstyled, accessible UI primitives
- **Framer Motion** - Animation library
- **Phosphor Icons** - Icon library

### AI & Language Models
- **OpenAI GPT-5** - Primary language model with reasoning capabilities
- **Vercel AI SDK** - AI integration framework
- **Multiple Providers**: Anthropic, Google, XAI, Groq, DeepSeek, Mistral, Perplexity, Ollama
- **LangSmith** - LLM observability and tracing

### Database & Storage
- **Supabase** - Backend-as-a-Service (PostgreSQL)
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Primary database

### Development Tools
- **Biome** - Fast linter and formatter (extends Ultracite config)
- **Playwright** - End-to-end testing
- **Vitest** - Unit and integration testing
- **Husky + Lefthook** - Git hooks
- **ESLint** - JavaScript/TypeScript linting

## Common Commands

### Development
```bash
# Start development server with Turbopack
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Type checking
bun run type-check

# Linting
bun run lint
```

### Testing
```bash
# Run all unit tests
bun test

# Run unit tests with Vitest
bun run test:unit

# Run integration tests
bun run test:integration

# Run end-to-end tests
bun run test:e2e

# Run all tests (CI pipeline)
bun run test:all
```

### Database Operations
```bash
# Generate database migrations
bun run drizzle-kit generate

# Apply migrations
bun run drizzle-kit migrate

# Database introspection
bun run drizzle-kit introspect
```

### Deployment
```bash
# Docker build
docker build -t roborail-assistant .

# Docker run with environment
docker run -p 3000:3000 --env-file .env.local roborail-assistant
```

## Environment Configuration

### Required Variables
- `OPENAI_API_KEY` - OpenAI API key with GPT-5 access
- `ROBORAIL_MODE` - App mode (development/staging/production)

### Optional but Recommended
- `LANGSMITH_API_KEY` - LangSmith observability
- `LANGSMITH_PROJECT` - Project name for tracing
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE` - Service role key

### Security & Performance
- `CSRF_SECRET` - 32-character random string
- `RATE_LIMIT_ENABLED` - Enable rate limiting
- `MAX_REQUESTS_PER_MINUTE` - Rate limit threshold

## Architecture Patterns

### App Router Structure
- Uses Next.js 15 App Router for file-based routing
- Server and client components separation
- API routes in `app/api/` directory

### State Management
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management
- **Context Providers** - User, chat, and preference management

### Database Patterns
- **Drizzle ORM** with type-safe schema definitions
- **Relations** - Comprehensive foreign key relationships
- **Migrations** - Version-controlled schema changes
- **Indexing** - Performance-optimized database queries