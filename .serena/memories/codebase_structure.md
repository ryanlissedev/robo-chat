# RoboRail Assistant - Codebase Structure

## Project Root Structure
```
robo-chat/
├── app/                    # Next.js 15 App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── c/                 # Chat pages
│   ├── components/        # Page-specific components
│   ├── hooks/             # Page-specific hooks
│   ├── p/                 # Public pages
│   ├── settings/          # Settings pages
│   ├── share/             # Shared chat pages
│   ├── themes/            # Theme selection page
│   ├── types/             # Type definitions
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   ├── common/           # Common components
│   ├── icons/            # Custom icons
│   ├── motion-primitives/ # Animation components
│   └── prompt-kit/       # Prompt-related components
├── lib/                  # Core utilities and business logic
│   ├── ai/               # AI-related utilities
│   ├── chat-store/       # Chat state management
│   ├── hooks/            # Reusable hooks
│   ├── langsmith/        # LangSmith integration
│   ├── mcp/              # MCP (Model Context Protocol)
│   ├── model-store/      # Model state management
│   ├── models/           # AI model configurations
│   ├── openproviders/    # AI provider integrations
│   ├── prompt-engineering/ # Prompt optimization
│   ├── providers/        # React providers
│   ├── retrieval/        # RAG and document retrieval
│   ├── security/         # Security utilities
│   ├── server/           # Server-side utilities
│   ├── supabase/         # Database utilities
│   ├── tanstack-query/   # React Query setup
│   ├── tools/            # AI tools and functions
│   ├── user/             # User management
│   ├── user-preference-store/ # User preferences
│   └── user-store/       # User state management
├── tests/                # Test files
│   ├── pages/            # Page object models for e2e
│   ├── chat.spec.ts      # E2E chat tests
│   ├── global-setup.ts   # Global test setup
│   └── global-teardown.ts # Global test cleanup
├── data/                 # Document processing and knowledge base
├── docs/                 # Documentation
├── public/               # Static assets
├── supabase/             # Supabase configuration
│   └── migrations/       # Database migrations
└── utils/                # Utility functions
```

## Key Directories Explained

### `/app` - Next.js App Router
- **API Routes**: `/app/api/` contains all backend endpoints
  - `/chat/` - Main chat API with streaming support
  - `/voice/` - Voice interaction endpoints
  - `/auth/` - Authentication endpoints
- **Pages**: Each directory represents a route
- **Components**: Page-specific React components
- **Types**: TypeScript type definitions

### `/components` - Reusable UI Components
- **ui/**: shadcn/ui components (Button, Input, Dialog, etc.)
- **common/**: Application-specific reusable components
- **icons/**: Custom icon components
- **motion-primitives/**: Animation and motion components

### `/lib` - Core Business Logic
- **ai/**: AI model utilities and configurations
- **models/**: AI model definitions and provider mappings
- **openproviders/**: Integration with multiple AI providers
- **security/**: Encryption, CSRF protection, input sanitization
- **supabase/**: Database client and utilities
- **tools/**: AI function tools (file search, etc.)

### `/tests` - Testing Infrastructure
- **E2E Tests**: Playwright tests for user workflows
- **Unit Tests**: Co-located with source files (*.test.ts)
- **Page Objects**: Reusable test interaction patterns

## Important Files

### Configuration Files
- `next.config.ts` - Next.js configuration with Turbopack
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `playwright.config.ts` - E2E test configuration
- `vitest.config.ts` - Unit test configuration
- `package.json` - Dependencies and scripts (Bun-based)

### Environment & Security
- `.env.example` - Environment variable template
- `.env.local` - Local environment variables (not in git)
- `middleware.ts` - Next.js middleware for security headers

### Development Tools
- `Makefile` - Development commands and shortcuts
- `SETUP.sh` - Automated project setup script
- `lefthook.yml` - Git hooks configuration
- `biome.jsonc` - Biome linter configuration

## Data Flow Architecture

### Frontend → Backend
1. **User Input**: React components capture user interactions
2. **State Management**: Zustand stores manage application state
3. **API Calls**: Fetch requests to Next.js API routes
4. **Streaming**: Server-sent events for real-time AI responses

### AI Integration Flow
1. **Model Selection**: User chooses AI model (GPT-5, Claude, etc.)
2. **Provider Routing**: `openproviders` routes to correct AI service
3. **Streaming Response**: Real-time token streaming to frontend
4. **Tool Integration**: AI can call functions (file search, etc.)

### Database Integration
1. **Supabase Client**: Type-safe database operations
2. **Real-time Subscriptions**: Live updates for collaborative features
3. **Row Level Security**: User-based data access control
4. **Migrations**: Version-controlled schema changes

## Security Architecture

### Input Validation
- **Client-side**: React Hook Form with Zod validation
- **Server-side**: API route input sanitization
- **Database**: Parameterized queries and RLS

### Authentication & Authorization
- **Supabase Auth**: Email/password and OAuth providers
- **JWT Tokens**: Secure session management
- **Role-based Access**: Different permissions for user types

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **CSRF Protection**: Token-based request validation
- **Rate Limiting**: API endpoint protection
- **Content Security Policy**: XSS prevention

## Performance Optimizations

### Frontend
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js Image component
- **Bundle Analysis**: Regular size monitoring
- **Caching**: React Query for API response caching

### Backend
- **Streaming**: Real-time AI response delivery
- **Connection Pooling**: Efficient database connections
- **CDN**: Static asset delivery optimization
- **Compression**: Gzip/Brotli response compression

### AI Integration
- **Model Caching**: Efficient provider switching
- **Token Optimization**: Prompt engineering for efficiency
- **Parallel Processing**: Concurrent AI operations
- **Fallback Models**: Redundancy for reliability