# Project Structure

## Architecture Overview

Base Chat follows Next.js 15 App Router conventions with a clean separation of concerns:
- **app/**: Next.js App Router pages and API routes
- **components/**: Reusable UI components organized by purpose
- **lib/**: Business logic, utilities, and integrations
- **public/**: Static assets

## Key Directories

### `/app` - Next.js App Router
```
app/
├── api/                    # API routes
│   ├── chat/              # Main chat endpoint
│   ├── settings/          # User settings management
│   └── user-*/            # User-related endpoints
├── components/            # Page-specific components
│   ├── chat/              # Chat interface components
│   ├── chat-input/        # Input area components
│   └── layout/            # Layout components
├── auth/                  # Authentication pages
├── settings/              # Settings pages
└── share/                 # Shared chat pages
```

### `/components` - Reusable UI Components
```
components/
├── ui/                    # shadcn/ui base components
├── ai-elements/           # AI-specific UI elements
├── common/                # Shared components (model selector, etc.)
├── icons/                 # Provider and brand icons
├── motion-primitives/     # Animation components
└── prompt-kit/            # Chat UI primitives
```

### `/lib` - Business Logic & Integrations
```
lib/
├── chat-store/            # Chat state management (Zustand)
├── models/                # AI model configurations
├── openproviders/         # AI provider integrations
├── supabase/              # Database client and utilities
├── user-store/            # User state management
├── tools/                 # AI tools (file search, etc.)
├── security/              # Security utilities
└── config.ts              # App configuration constants
```

## File Naming Conventions

### Components
- **React Components**: PascalCase (e.g., `ChatContainer.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useChatCore.ts`)
- **Utilities**: kebab-case (e.g., `chat-business-logic.ts`)

### API Routes
- **Route handlers**: `route.ts` in folder matching URL path
- **API utilities**: `api.ts` for shared logic, `utils.ts` for helpers

### Configuration Files
- **Environment**: `.env.example`, `.env.local`
- **TypeScript**: `tsconfig.json` with strict settings
- **Styling**: `globals.css` with Tailwind imports
- **Components**: `components.json` for shadcn/ui config

## State Management Patterns

### Client State (Zustand)
- **Chat Store**: Messages, conversations, session state
- **User Store**: Authentication, preferences, API keys
- **Model Store**: Selected models, provider configurations

### Server State (TanStack Query)
- API data fetching and caching
- Optimistic updates for chat messages
- Background refetching for user data

## Component Organization

### Chat Components (`app/components/chat/`)
- **Core Logic**: `use-chat-core.ts`, `use-chat-operations.ts`
- **UI Components**: `chat.tsx`, `conversation.tsx`, `message.tsx`
- **Specialized**: `reasoning.tsx`, `tool-invocation.tsx`

### Shared Components (`components/`)
- **Base UI**: Radix primitives in `ui/`
- **AI Elements**: Reusable AI interface components
- **Common**: Cross-app components like model selectors

## API Route Structure

### Chat API (`app/api/chat/`)
- **Main Handler**: `route.ts` - streaming chat completions
- **Business Logic**: `api.ts` - database operations
- **Utilities**: `utils.ts` - error handling, validation

### Pattern for New APIs
1. Create folder with descriptive name
2. Add `route.ts` with HTTP method handlers
3. Extract business logic to `api.ts` if complex
4. Add utilities to `utils.ts` if needed

## Import Conventions

### Path Aliases (tsconfig.json)
- `@/*`: Root directory alias
- Prefer absolute imports over relative for better refactoring

### Import Order (Prettier plugin)
1. External libraries
2. Internal modules (with @/ alias)
3. Relative imports
4. Type-only imports last

## Security Patterns

### API Protection
- CSRF tokens for state-changing requests
- Rate limiting on sensitive endpoints
- Input sanitization and validation
- Supabase RLS policies for data access

### Client Security
- CSP headers in middleware
- Secure cookie handling
- API key encryption in database
- User input sanitization

## Testing Structure (Future)
```
__tests__/
├── components/            # Component tests
├── api/                   # API route tests
├── lib/                   # Utility function tests
└── e2e/                   # End-to-end tests
```