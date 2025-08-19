# RoboRail Assistant - Project Structure

## Root Directory Organization

### Configuration Files
- `package.json` - Dependencies and scripts (uses Bun as package manager)
- `next.config.ts` - Next.js configuration with Turbopack support
- `tsconfig.json` - TypeScript configuration
- `drizzle.config.ts` - Database ORM configuration
- `biome.jsonc` - Code formatting (extends Ultracite)
- `components.json` - shadcn/ui component configuration
- `playwright.config.ts` - E2E testing configuration

### Application Structure

#### `/app` - Next.js App Router
```
app/
├── api/                    # API routes
│   ├── chat/              # Chat-related endpoints
│   ├── models/            # AI model management
│   ├── user-keys/         # API key management
│   └── ...                # Other API endpoints
├── auth/                  # Authentication pages
├── c/[chatId]/           # Individual chat pages
├── p/[projectId]/        # Project-specific pages
├── settings/             # User settings
├── components/           # App-specific components
├── hooks/                # App-specific React hooks
├── types/                # App-level type definitions
├── layout.tsx            # Root layout
├── page.tsx              # Home page
└── globals.css           # Global styles with theme imports
```

#### `/lib` - Shared Libraries
```
lib/
├── ai/                   # AI model configurations
├── chat-store/           # Chat state management (Zustand)
├── db/                   # Database schema and operations (Drizzle)
├── hooks/                # Reusable React hooks
├── models/               # AI model definitions and types
├── openproviders/        # AI provider integrations
├── security/             # Encryption and security utilities
├── supabase/             # Supabase client configurations
├── user-store/           # User state management
└── utils/                # General utility functions
```

#### `/components` - Reusable UI Components
```
components/
├── ui/                   # shadcn/ui components (Radix-based)
├── prompt-kit/           # Chat and messaging components
├── common/               # Shared application components
├── icons/                # Provider and brand icons
└── motion-primitives/    # Animation components (Framer Motion)
```

#### `/tests` - Testing Infrastructure
```
tests/
├── unit/                 # Unit tests (Vitest)
├── integration/          # Integration tests (Vitest)
├── acceptance/           # Acceptance tests
├── repositories/         # Database repository tests
├── pages/                # Page object models (Playwright)
├── utils/                # Test utilities
└── *.e2e.ts             # End-to-end tests (Playwright)
```

### Data and Documentation

#### `/data` - RoboRail Technical Documentation
- `/pdf/` - Original PDF manuals
- `/extracted/` - Processed documentation
- `/json/` - Structured data for RAG
- `/csv/` - Dataset exports
- `/processed/` - Batch processing results

#### `/docs` - Project Documentation
- Installation guides (general and Windows-specific)
- Security documentation
- Analysis reports

#### `/supabase` - Database Management
- `/migrations/` - SQL migration files
- Database schema versioning

## Key Architectural Patterns

### File Naming Conventions
- **Components**: PascalCase (e.g., `ChatContainer.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useChat.ts`)
- **Utilities**: camelCase (e.g., `formatMessage.ts`)
- **API Routes**: kebab-case directories (e.g., `/api/user-keys/`)
- **Pages**: kebab-case for dynamic routes (e.g., `[chatId]`)

### Import Path Aliases
- `@/*` - Root directory alias for clean imports
- `@/components` - UI components
- `@/lib` - Shared libraries
- `@/app` - App-specific modules

### Component Organization
- **UI Components**: Generic, reusable components in `/components/ui/`
- **Feature Components**: Domain-specific components in `/app/components/`
- **Layout Components**: Page layouts and shells
- **Provider Components**: Context and state providers

### State Management Structure
- **Global State**: Zustand stores in `/lib/*-store/`
- **Server State**: TanStack Query for API data
- **Local State**: React hooks for component-specific state
- **Context Providers**: User, chat, model, and preference contexts

### Database Schema Organization
- **Core Entities**: Users, chats, messages, projects
- **Settings**: User preferences and retrieval settings
- **Security**: API keys, audit logs, feedback
- **Relations**: Comprehensive foreign key relationships
- **Indexing**: Performance-optimized queries

### Testing Strategy
- **Unit Tests**: Individual functions and components
- **Integration Tests**: Database operations and API endpoints
- **E2E Tests**: Complete user workflows
- **Acceptance Tests**: Business requirement validation